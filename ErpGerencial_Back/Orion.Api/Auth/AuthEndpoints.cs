using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Orion.Api.Data;

namespace Orion.Api.Auth;

public record CadastroRequest(string Nome, string Email, string Telefone, string NomeEmpresa, string Senha);
/// <summary>Dispositivo: token do "Lembrar de quem sou", quando o navegador tem um.</summary>
public record LoginRequest(string Email, string Senha, string? Dispositivo);
public record VerificarCodigoRequest(Guid DesafioId, string Codigo, bool Lembrar);
public record ReenviarCodigoRequest(Guid DesafioId);

public static class AuthEndpoints
{
    private const string EmailDuplicado = "Este e-mail já está cadastrado";

    public static void MapAuthEndpoints(this WebApplication app)
    {
        var grupo = app.MapGroup("/api/auth");
        grupo.MapPost("/cadastro", Cadastrar);
        grupo.MapPost("/login", Entrar).RequireRateLimiting(Politicas.Login);
        grupo.MapPost("/login/verificar", VerificarCodigo).RequireRateLimiting(Politicas.Codigo);
        grupo.MapPost("/login/reenviar", ReenviarCodigo).RequireRateLimiting(Politicas.Codigo);
        grupo.MapGet("/eu", Eu).RequireAuthorization();
    }

    /// <summary>
    /// Como no Bling: o cadastro cria a conta da pessoa e a empresa juntas,
    /// e quem cadastra é o administrador da empresa.
    /// </summary>
    private static async Task<IResult> Cadastrar(
        CadastroRequest req, OrionDbContext db, IPasswordHasher<Usuario> hasher, TokenService tokens)
    {
        var erros = Validacao.Cadastro(req);
        if (erros.Count > 0) return Results.ValidationProblem(erros);

        var email = req.Email.Trim().ToLowerInvariant();
        if (await db.Usuarios.AnyAsync(u => u.Email == email))
            return Results.Conflict(new { erro = EmailDuplicado, campo = "email" });

        var usuario = new Usuario
        {
            Nome = req.Nome.Trim(),
            Email = email,
            Telefone = Validacao.SoDigitos(req.Telefone),
            Administrador = true,
            Empresa = new Empresa { Nome = req.NomeEmpresa.Trim(), Email = email },
        };
        usuario.SenhaHash = hasher.HashPassword(usuario, req.Senha);
        db.Usuarios.Add(usuario);

        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // Dois cadastros com o mesmo e-mail ao mesmo tempo.
            return Results.Conflict(new { erro = EmailDuplicado, campo = "email" });
        }

        return Results.Created($"/api/usuarios/{usuario.Id}", UsuarioAtual.Sessao(usuario, tokens));
    }

    /// <summary>
    /// 1ª etapa: confere a senha. No navegador lembrado, entra direto; nos outros,
    /// envia o código por e-mail e responde 202 com o desafio (a tela pede o código).
    /// </summary>
    private static async Task<IResult> Entrar(
        LoginRequest req, OrionDbContext db, IPasswordHasher<Usuario> hasher, TokenService tokens,
        EmailService servicoEmail, CancellationToken ct)
    {
        var email = req.Email?.Trim().ToLowerInvariant() ?? "";
        var usuario = await db.Usuarios.Include(u => u.Empresa).SingleOrDefaultAsync(u => u.Email == email);

        // Mesma resposta para e-mail inexistente e senha errada.
        if (usuario is null
            || hasher.VerifyHashedPassword(usuario, usuario.SenhaHash, req.Senha ?? "")
                == PasswordVerificationResult.Failed)
            return Results.Unauthorized();

        // Só depois de conferir a senha, para não revelar quais contas existem.
        if (!usuario.Ativo) return UsuarioDesativado();

        if (await VerificacaoLogin.DispositivoLembrado(db, usuario, req.Dispositivo, ct))
        {
            await db.SaveChangesAsync(ct);
            return Results.Ok(UsuarioAtual.Sessao(usuario, tokens));
        }

        var verificacao = await VerificacaoLogin.EnviarCodigo(db, servicoEmail, usuario, null, ct);
        return verificacao is null
            ? FalhaNoEnvio()
            : Results.Json(verificacao, statusCode: StatusCodes.Status202Accepted);
    }

    /// <summary>2ª etapa: confere o código do e-mail e conclui o login.</summary>
    private static async Task<IResult> VerificarCodigo(
        VerificarCodigoRequest req, HttpContext http, OrionDbContext db, TokenService tokens, CancellationToken ct)
    {
        var desafio = await db.CodigosLogin
            .Include(c => c.Usuario).ThenInclude(u => u!.Empresa)
            .SingleOrDefaultAsync(c => c.Id == req.DesafioId, ct);

        if (desafio is null || desafio.UsadoEm is not null || desafio.NovoEmail is not null)
            return CodigoInvalido("Este código não vale mais. Entre de novo para receber outro.");
        if (desafio.ExpiraEm < DateTime.UtcNow)
            return CodigoInvalido("O código expirou. Peça um novo.");
        if (desafio.Tentativas >= VerificacaoLogin.MaximoTentativas)
            return CodigoInvalido("Muitas tentativas erradas. Entre de novo para receber outro código.");

        if (!VerificacaoLogin.CodigoConfere(desafio, req.Codigo ?? ""))
        {
            desafio.Tentativas++;
            await db.SaveChangesAsync(ct);
            var restantes = VerificacaoLogin.MaximoTentativas - desafio.Tentativas;
            return CodigoInvalido(restantes > 0
                ? $"Código incorreto. {(restantes == 1 ? "Resta 1 tentativa" : $"Restam {restantes} tentativas")}."
                : "Muitas tentativas erradas. Entre de novo para receber outro código.");
        }

        var usuario = desafio.Usuario!;
        if (!usuario.Ativo) return UsuarioDesativado();

        desafio.UsadoEm = DateTime.UtcNow;
        var dispositivo = req.Lembrar
            ? VerificacaoLogin.LembrarDispositivo(db, usuario, http.Request.Headers.UserAgent.ToString())
            : null;
        await db.SaveChangesAsync(ct);

        var sessao = UsuarioAtual.Sessao(usuario, tokens);
        return Results.Ok(new LoginVerificadoResponse(sessao.Token, sessao.Usuario, sessao.Empresa, dispositivo));
    }

    /// <summary>Envia um código novo para o mesmo desafio (no máximo um a cada 60 segundos).</summary>
    private static async Task<IResult> ReenviarCodigo(
        ReenviarCodigoRequest req, OrionDbContext db, EmailService email, CancellationToken ct)
    {
        var desafio = await db.CodigosLogin.Include(c => c.Usuario)
            .SingleOrDefaultAsync(c => c.Id == req.DesafioId, ct);
        if (desafio is null || desafio.UsadoEm is not null || desafio.NovoEmail is not null
            || desafio.Usuario is not { Ativo: true })
            return CodigoInvalido("Entre de novo para receber outro código.");

        var espera = desafio.EnviadoEm + VerificacaoLogin.IntervaloReenvio - DateTime.UtcNow;
        if (espera > TimeSpan.Zero)
            return Results.Json(new { erro = $"Aguarde {Math.Ceiling(espera.TotalSeconds)} segundos para pedir outro código." },
                statusCode: StatusCodes.Status429TooManyRequests);

        var verificacao = await VerificacaoLogin.EnviarCodigo(db, email, desafio.Usuario, desafio, ct);
        return verificacao is null ? FalhaNoEnvio() : Results.Ok(verificacao);
    }

    private static IResult CodigoInvalido(string mensagem) =>
        Results.BadRequest(new { erro = mensagem, campo = "codigo" });

    private static IResult FalhaNoEnvio() =>
        Results.Problem("Não foi possível enviar o código por e-mail. Tente de novo em instantes.", statusCode: 503);

    /// <summary>Sessão atualizada (empresa, administrador e permissões podem ter mudado).</summary>
    private static async Task<IResult> Eu(ClaimsPrincipal user, OrionDbContext db, TokenService tokens)
    {
        var usuario = await UsuarioAtual.Carregar(user, db);
        return usuario is null ? Results.Unauthorized() : Results.Ok(UsuarioAtual.Sessao(usuario, tokens));
    }

    private static IResult UsuarioDesativado() =>
        Results.Json(new { erro = "Seu acesso foi desativado pelo administrador da empresa" },
            statusCode: StatusCodes.Status403Forbidden);
}
