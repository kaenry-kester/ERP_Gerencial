using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Orion.Api.Data;

namespace Orion.Api.Auth;

public record CadastroRequest(string Nome, string Email, string Telefone, string NomeEmpresa, string Senha);
/// <summary>Entra com e-mail ou com o celular (o mesmo cadastrado em Minha conta) e a senha.</summary>
public record LoginRequest(string? Email, string? Telefone, string Senha);

/// <summary>"Esqueci minha senha": o e-mail ou o celular da conta.</summary>
public record EsqueciSenhaRequest(string? Email, string? Telefone);
public record RedefinirSenhaRequest(Guid DesafioId, string Codigo, string NovaSenha);
public record ReenviarSenhaRequest(Guid DesafioId);

/// <summary>Resposta do "Esqueci minha senha": igual exista ou não a conta (não revela quem tem cadastro).</summary>
public record EsqueciSenhaResponse(Guid DesafioId, int ReenviarEmSegundos);

public static class AuthEndpoints
{
    private const string EmailDuplicado = "Este e-mail já está cadastrado";

    public static void MapAuthEndpoints(this WebApplication app)
    {
        var grupo = app.MapGroup("/api/auth");
        grupo.MapPost("/cadastro", Cadastrar);
        grupo.MapPost("/login", Entrar).RequireRateLimiting(Politicas.Login);
        grupo.MapGet("/eu", Eu).RequireAuthorization();
        grupo.MapPost("/renovar", Renovar).RequireAuthorization();
        grupo.MapPost("/senha/esqueci", EsqueciSenha).RequireRateLimiting(Politicas.Codigo);
        grupo.MapPost("/senha/reenviar", ReenviarSenha).RequireRateLimiting(Politicas.Codigo);
        grupo.MapPost("/senha/redefinir", RedefinirSenha).RequireRateLimiting(Politicas.Codigo);
    }

    /// <summary>Sessão nova (mais 8 horas) para quem está usando o sistema; o site chama sozinho antes de vencer.</summary>
    private static async Task<IResult> Renovar(ClaimsPrincipal user, OrionDbContext db, TokenService tokens)
    {
        var usuario = await UsuarioAtual.Carregar(user, db);
        return usuario is null ? Results.Unauthorized() : Results.Ok(UsuarioAtual.Sessao(usuario, tokens));
    }

    /// <summary>
    /// 1ª etapa do "Esqueci minha senha": manda um código para o e-mail da conta. A resposta é a mesma
    /// exista ou não a conta (um id qualquer, que só não vai aceitar código nenhum).
    /// </summary>
    private static async Task<IResult> EsqueciSenha(EsqueciSenhaRequest req, OrionDbContext db, EmailService email, CancellationToken ct)
    {
        var espera = (int)VerificacaoLogin.IntervaloReenvio.TotalSeconds;
        var usuario = await ContaDoAcesso(db, req.Email, req.Telefone, ct);
        if (usuario is null) return Results.Ok(new EsqueciSenhaResponse(Guid.CreateVersion7(), espera));

        var verificacao = await VerificacaoLogin.EnviarCodigo(db, email, usuario, null, ct, redefinirSenha: true);
        return verificacao is null
            ? Results.Problem("Não foi possível enviar o código por e-mail. Tente de novo em instantes.", statusCode: 503)
            : Results.Ok(new EsqueciSenhaResponse(verificacao.DesafioId, espera));
    }

    /// <summary>A conta do e-mail; ou do celular, quando só uma conta usa esse celular.</summary>
    private static async Task<Usuario?> ContaDoAcesso(OrionDbContext db, string? emailDigitado, string? telefoneDigitado, CancellationToken ct)
    {
        var emailLimpo = emailDigitado?.Trim().ToLowerInvariant();
        if (!string.IsNullOrEmpty(emailLimpo))
            return await db.Usuarios.SingleOrDefaultAsync(u => u.Email == emailLimpo && u.Ativo, ct);
        var telefone = Validacao.Telefone(telefoneDigitado);
        if (telefone.Length is not (10 or 11)) return null;
        var contas = await db.Usuarios.Where(u => u.Telefone == telefone && u.Ativo).Take(2).ToListAsync(ct);
        return contas.Count == 1 ? contas[0] : null;
    }

    private static async Task<IResult> ReenviarSenha(ReenviarSenhaRequest req, OrionDbContext db, EmailService email, CancellationToken ct)
    {
        var desafio = await db.CodigosLogin.Include(c => c.Usuario)
            .SingleOrDefaultAsync(c => c.Id == req.DesafioId && c.Finalidade == "senha" && c.UsadoEm == null, ct);
        var espera = (int)VerificacaoLogin.IntervaloReenvio.TotalSeconds;
        if (desafio is null) return Results.Ok(new EsqueciSenhaResponse(req.DesafioId, espera));

        var falta = desafio.EnviadoEm + VerificacaoLogin.IntervaloReenvio - DateTime.UtcNow;
        if (falta > TimeSpan.Zero)
            return Results.Json(new { erro = $"Aguarde {Math.Ceiling(falta.TotalSeconds)} segundos para pedir outro código." },
                statusCode: StatusCodes.Status429TooManyRequests);
        var verificacao = await VerificacaoLogin.EnviarCodigo(db, email, desafio.Usuario!, desafio, ct);
        return verificacao is null
            ? Results.Problem("Não foi possível enviar o código por e-mail. Tente de novo em instantes.", statusCode: 503)
            : Results.Ok(new EsqueciSenhaResponse(desafio.Id, espera));
    }

    /// <summary>2ª etapa: o código certo + a senha nova trocam a senha e já entram no sistema.</summary>
    private static async Task<IResult> RedefinirSenha(
        RedefinirSenhaRequest req, OrionDbContext db, IPasswordHasher<Usuario> hasher, TokenService tokens, CancellationToken ct)
    {
        var erros = new Dictionary<string, string[]>();
        Validacao.Senha(erros, "novaSenha", req.NovaSenha);
        if (erros.Count > 0) return Results.ValidationProblem(erros);

        static IResult Invalido(string mensagem) => Results.BadRequest(new { erro = mensagem, campo = "codigo" });
        var desafio = await db.CodigosLogin.Include(c => c.Usuario).ThenInclude(u => u!.Empresa)
            .SingleOrDefaultAsync(c => c.Id == req.DesafioId && c.Finalidade == "senha", ct);
        // Sem conta (ou id inventado): a mesma mensagem de código errado
        if (desafio is null) return Invalido("Código incorreto.");
        if (desafio.UsadoEm is not null) return Invalido("Este código já foi usado. Peça outro.");
        if (desafio.ExpiraEm < DateTime.UtcNow) return Invalido("O código expirou. Peça outro.");
        if (desafio.Tentativas >= VerificacaoLogin.MaximoTentativas) return Invalido("Muitas tentativas erradas. Peça outro código.");
        if (!VerificacaoLogin.CodigoConfere(desafio, req.Codigo ?? ""))
        {
            desafio.Tentativas++;
            await db.SaveChangesAsync(ct);
            var restantes = VerificacaoLogin.MaximoTentativas - desafio.Tentativas;
            return Invalido(restantes > 0
                ? $"Código incorreto. {(restantes == 1 ? "Resta 1 tentativa" : $"Restam {restantes} tentativas")}."
                : "Muitas tentativas erradas. Peça outro código.");
        }

        var usuario = desafio.Usuario!;
        if (!usuario.Ativo) return Invalido("Esta conta está desativada.");
        usuario.SenhaHash = hasher.HashPassword(usuario, req.NovaSenha);
        desafio.UsadoEm = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return Results.Ok(UsuarioAtual.Sessao(usuario, tokens));
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
    /// Login com e-mail ou com o celular e a senha: senha certa → sessão (sem código de verificação).
    /// </summary>
    private static async Task<IResult> Entrar(
        LoginRequest req, OrionDbContext db, IPasswordHasher<Usuario> hasher, TokenService tokens, CancellationToken ct)
    {
        bool SenhaConfere(Usuario u) =>
            hasher.VerifyHashedPassword(u, u.SenhaHash, req.Senha ?? "") != PasswordVerificationResult.Failed;

        Usuario? usuario;
        var telefone = Validacao.SoDigitos(req.Telefone ?? "");
        // Aceita com ou sem o +55 na frente
        if (telefone.Length is 12 or 13 && telefone.StartsWith("55")) telefone = telefone[2..];
        if (telefone.Length > 0)
        {
            // O celular não é único entre as contas: vale a conta desse celular cuja senha confere.
            var contas = (await db.Usuarios.Include(u => u.Empresa).Where(u => u.Telefone == telefone).ToListAsync(ct))
                .Where(SenhaConfere).ToList();
            if (contas.Count > 1)
                return Results.Json(new { erro = "Este celular está em mais de uma conta. Entre com o e-mail.", campo = "telefone" },
                    statusCode: StatusCodes.Status409Conflict);
            usuario = contas.SingleOrDefault();
        }
        else
        {
            var email = req.Email?.Trim().ToLowerInvariant() ?? "";
            usuario = await db.Usuarios.Include(u => u.Empresa).SingleOrDefaultAsync(u => u.Email == email, ct);
            if (usuario is not null && !SenhaConfere(usuario)) usuario = null;
        }

        // Mesma resposta para conta inexistente e senha errada.
        if (usuario is null) return Results.Unauthorized();

        // Só depois de conferir a senha, para não revelar quais contas existem.
        if (!usuario.Ativo) return UsuarioDesativado();

        return Results.Ok(UsuarioAtual.Sessao(usuario, tokens));
    }

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
