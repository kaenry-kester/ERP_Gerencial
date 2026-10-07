using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Orion.Api.Auth;
using Orion.Api.Data;

namespace Orion.Api.Conta;

/// <summary>
/// O que acontece ao excluir a conta:
/// conta = só a pessoa sai (a empresa continua com outro administrador);
/// conta-e-empresa = ela é a única administradora: a empresa e os usuários dela saem junto.
/// </summary>
public record ContaDto(
    Guid Id,
    string Nome,
    string Email,
    string? Telefone,
    bool Administrador,
    string? Empresa,
    DateTime CriadoEm,
    string Exclusao);

public record EditarContaRequest(string Nome, string? Telefone);
public record TrocarSenhaRequest(string? SenhaAtual, string NovaSenha);
public record TrocarEmailRequest(string NovoEmail, string? Senha);
public record ConfirmarEmailRequest(Guid DesafioId, string Codigo);
public record ReenviarEmailRequest(Guid DesafioId);
public record ExcluirContaRequest(string? Senha, string Confirmacao);

public record DispositivoDto(Guid Id, string? Descricao, DateTime CriadoEm, DateTime UltimoUsoEm, DateTime ExpiraEm, bool Atual);

/// <summary>"Minha conta": dados da pessoa, e-mail, senha, computadores lembrados e exclusão da conta.</summary>
public static class ContaEndpoints
{
    /// <summary>Cabeçalho com o token do "Lembrar de quem sou", para marcar "este computador" na lista.</summary>
    private const string CabecalhoDispositivo = "X-Dispositivo";

    public static void MapContaEndpoints(this WebApplication app)
    {
        var grupo = app.MapGroup("/api/conta").RequireAuthorization();
        grupo.MapGet("/", Obter);
        grupo.MapPut("/", Editar);
        grupo.MapPost("/senha", TrocarSenha).RequireRateLimiting(Politicas.Conta);
        grupo.MapPost("/email", PedirTrocaDeEmail).RequireRateLimiting(Politicas.Conta);
        grupo.MapPost("/email/confirmar", ConfirmarTrocaDeEmail).RequireRateLimiting(Politicas.Codigo);
        grupo.MapPost("/email/reenviar", ReenviarCodigoDoEmail).RequireRateLimiting(Politicas.Codigo);
        grupo.MapGet("/dispositivos", ListarDispositivos);
        grupo.MapDelete("/dispositivos/{id:guid}", EsquecerDispositivo);
        grupo.MapDelete("/dispositivos", EsquecerTodos);
        grupo.MapPost("/excluir", Excluir).RequireRateLimiting(Politicas.Conta);
    }

    private static async Task<IResult> Obter(ClaimsPrincipal user, OrionDbContext db)
    {
        var usuario = await UsuarioAtual.Carregar(user, db);
        return usuario is null ? Results.Unauthorized() : Results.Ok(await Dto(db, usuario));
    }

    private static async Task<IResult> Editar(EditarContaRequest req, ClaimsPrincipal user, OrionDbContext db)
    {
        var usuario = await UsuarioAtual.Carregar(user, db);
        if (usuario is null) return Results.Unauthorized();

        var erros = new Dictionary<string, string[]>();
        Validacao.Nome(erros, "nome", req.Nome, "Digite seu nome", 120);
        var telefone = Validacao.SoDigitos(req.Telefone ?? "");
        if (telefone.Length > 0 && telefone.Length is not (10 or 11)) erros["telefone"] = ["Número incompleto"];
        if (erros.Count > 0) return Results.ValidationProblem(erros);

        usuario.Nome = req.Nome.Trim();
        usuario.Telefone = telefone.Length > 0 ? telefone : null;
        await db.SaveChangesAsync();
        return Results.Ok(await Dto(db, usuario));
    }

    /// <summary>Troca a senha; os computadores lembrados são esquecidos.</summary>
    private static async Task<IResult> TrocarSenha(
        TrocarSenhaRequest req, ClaimsPrincipal user, OrionDbContext db, IPasswordHasher<Usuario> hasher)
    {
        var usuario = await UsuarioAtual.Carregar(user, db);
        if (usuario is null) return Results.Unauthorized();
        if (!SenhaConfere(usuario, req.SenhaAtual, hasher))
            return Results.BadRequest(new { erro = "A senha atual está incorreta", campo = "senhaAtual" });

        var erros = new Dictionary<string, string[]>();
        Validacao.Senha(erros, "novaSenha", req.NovaSenha);
        if (erros.Count > 0) return Results.ValidationProblem(erros);

        usuario.SenhaHash = hasher.HashPassword(usuario, req.NovaSenha);
        // Quem tinha a senha antiga não continua entrando sem código em outros computadores.
        await db.DispositivosConfiaveis.Where(d => d.UsuarioId == usuario.Id).ExecuteDeleteAsync();
        await db.SaveChangesAsync();
        return Results.Ok(await Dto(db, usuario));
    }

    /// <summary>1ª etapa da troca de e-mail: confere a senha e envia um código para o e-mail novo.</summary>
    private static async Task<IResult> PedirTrocaDeEmail(
        TrocarEmailRequest req, ClaimsPrincipal user, OrionDbContext db, IPasswordHasher<Usuario> hasher,
        EmailService email, CancellationToken ct)
    {
        var usuario = await UsuarioAtual.Carregar(user, db, ct);
        if (usuario is null) return Results.Unauthorized();
        if (!SenhaConfere(usuario, req.Senha, hasher))
            return Results.BadRequest(new { erro = "A senha está incorreta", campo = "senha" });

        var erros = new Dictionary<string, string[]>();
        Validacao.Email(erros, "novoEmail", req.NovoEmail);
        if (erros.Count > 0) return Results.ValidationProblem(erros);

        var novo = req.NovoEmail.Trim().ToLowerInvariant();
        if (novo == usuario.Email)
            return Results.BadRequest(new { erro = "Este já é o seu e-mail", campo = "novoEmail" });
        if (await db.Usuarios.AnyAsync(u => u.Email == novo, ct))
            return Results.Conflict(new { erro = "Este e-mail já tem uma conta no Órion", campo = "novoEmail" });

        var verificacao = await VerificacaoLogin.EnviarCodigo(db, email, usuario, null, ct, novo);
        return verificacao is null
            ? Results.Problem("Não foi possível enviar o código por e-mail. Tente de novo em instantes.", statusCode: 503)
            : Results.Json(verificacao, statusCode: StatusCodes.Status202Accepted);
    }

    /// <summary>2ª etapa: o código que chegou no e-mail novo confirma a troca.</summary>
    private static async Task<IResult> ConfirmarTrocaDeEmail(
        ConfirmarEmailRequest req, ClaimsPrincipal user, OrionDbContext db, CancellationToken ct)
    {
        var usuario = await UsuarioAtual.Carregar(user, db, ct);
        if (usuario is null) return Results.Unauthorized();

        var desafio = await db.CodigosLogin.SingleOrDefaultAsync(
            c => c.Id == req.DesafioId && c.UsuarioId == usuario.Id && c.NovoEmail != null, ct);
        if (desafio is null || desafio.UsadoEm is not null)
            return CodigoInvalido("Este código não vale mais. Peça a troca de novo.");
        if (desafio.ExpiraEm < DateTime.UtcNow)
            return CodigoInvalido("O código expirou. Peça um novo.");
        if (desafio.Tentativas >= VerificacaoLogin.MaximoTentativas)
            return CodigoInvalido("Muitas tentativas erradas. Peça a troca de novo.");

        if (!VerificacaoLogin.CodigoConfere(desafio, req.Codigo ?? ""))
        {
            desafio.Tentativas++;
            await db.SaveChangesAsync(ct);
            var restantes = VerificacaoLogin.MaximoTentativas - desafio.Tentativas;
            return CodigoInvalido(restantes > 0
                ? $"Código incorreto. {(restantes == 1 ? "Resta 1 tentativa" : $"Restam {restantes} tentativas")}."
                : "Muitas tentativas erradas. Peça a troca de novo.");
        }

        // Alguém pode ter criado conta com este e-mail enquanto o código estava no ar.
        if (await db.Usuarios.AnyAsync(u => u.Email == desafio.NovoEmail && u.Id != usuario.Id, ct))
            return Results.Conflict(new { erro = "Este e-mail já tem uma conta no Órion", campo = "novoEmail" });

        usuario.Email = desafio.NovoEmail!;
        desafio.UsadoEm = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        return Results.Ok(await Dto(db, usuario));
    }

    private static async Task<IResult> ReenviarCodigoDoEmail(
        ReenviarEmailRequest req, ClaimsPrincipal user, OrionDbContext db, EmailService email, CancellationToken ct)
    {
        var usuario = await UsuarioAtual.Carregar(user, db, ct);
        if (usuario is null) return Results.Unauthorized();

        var desafio = await db.CodigosLogin.SingleOrDefaultAsync(
            c => c.Id == req.DesafioId && c.UsuarioId == usuario.Id && c.NovoEmail != null && c.UsadoEm == null, ct);
        if (desafio is null) return CodigoInvalido("Peça a troca de e-mail de novo.");

        var espera = desafio.EnviadoEm + VerificacaoLogin.IntervaloReenvio - DateTime.UtcNow;
        if (espera > TimeSpan.Zero)
            return Results.Json(new { erro = $"Aguarde {Math.Ceiling(espera.TotalSeconds)} segundos para pedir outro código." },
                statusCode: StatusCodes.Status429TooManyRequests);

        var verificacao = await VerificacaoLogin.EnviarCodigo(db, email, usuario, desafio, ct);
        return verificacao is null
            ? Results.Problem("Não foi possível enviar o código por e-mail. Tente de novo em instantes.", statusCode: 503)
            : Results.Ok(verificacao);
    }

    private static async Task<IResult> ListarDispositivos(HttpContext http, ClaimsPrincipal user, OrionDbContext db)
    {
        var usuario = await UsuarioAtual.Carregar(user, db);
        if (usuario is null) return Results.Unauthorized();

        var token = http.Request.Headers[CabecalhoDispositivo].ToString();
        var hashAtual = string.IsNullOrEmpty(token) ? null : VerificacaoLogin.Hash(token);
        var agora = DateTime.UtcNow;
        var dispositivos = await db.DispositivosConfiaveis
            .Where(d => d.UsuarioId == usuario.Id && d.ExpiraEm > agora)
            .OrderByDescending(d => d.UltimoUsoEm)
            .ToListAsync();
        return Results.Ok(dispositivos.Select(d =>
            new DispositivoDto(d.Id, d.Descricao, d.CriadoEm, d.UltimoUsoEm, d.ExpiraEm, d.TokenHash == hashAtual)));
    }

    private static async Task<IResult> EsquecerDispositivo(Guid id, ClaimsPrincipal user, OrionDbContext db)
    {
        var usuario = await UsuarioAtual.Carregar(user, db);
        if (usuario is null) return Results.Unauthorized();
        var apagados = await db.DispositivosConfiaveis
            .Where(d => d.Id == id && d.UsuarioId == usuario.Id)
            .ExecuteDeleteAsync();
        return apagados == 0 ? Results.NotFound() : Results.NoContent();
    }

    private static async Task<IResult> EsquecerTodos(ClaimsPrincipal user, OrionDbContext db)
    {
        var usuario = await UsuarioAtual.Carregar(user, db);
        if (usuario is null) return Results.Unauthorized();
        await db.DispositivosConfiaveis.Where(d => d.UsuarioId == usuario.Id).ExecuteDeleteAsync();
        return Results.NoContent();
    }

    /// <summary>Exclui a conta (e a empresa, quando a pessoa é a única nela). Pede a senha e "EXCLUIR".</summary>
    private static async Task<IResult> Excluir(
        ExcluirContaRequest req, ClaimsPrincipal user, OrionDbContext db, IPasswordHasher<Usuario> hasher)
    {
        var usuario = await UsuarioAtual.Carregar(user, db);
        if (usuario is null) return Results.Unauthorized();

        if (!string.Equals(req.Confirmacao?.Trim(), "EXCLUIR", StringComparison.Ordinal))
            return Results.BadRequest(new { erro = "Digite EXCLUIR para confirmar", campo = "confirmacao" });
        if (!SenhaConfere(usuario, req.Senha, hasher))
            return Results.BadRequest(new { erro = "A senha está incorreta", campo = "senha" });

        var exclusao = await TipoDeExclusao(db, usuario);

        await using var transacao = await db.Database.BeginTransactionAsync();
        var empresaId = usuario.EmpresaId;
        if (exclusao == "conta-e-empresa")
        {
            // Única administradora: sai a empresa inteira (usuários, códigos e dispositivos vão junto).
            await db.Usuarios.Where(u => u.EmpresaId == empresaId).ExecuteDeleteAsync();
            await db.Empresas.Where(e => e.Id == empresaId).ExecuteDeleteAsync();
        }
        else
        {
            db.Usuarios.Remove(usuario); // códigos e computadores lembrados saem junto (cascade)
            await db.SaveChangesAsync();
        }
        await transacao.CommitAsync();

        return Results.Ok(new { excluida = exclusao });
    }

    private static bool SenhaConfere(Usuario usuario, string? senha, IPasswordHasher<Usuario> hasher) =>
        hasher.VerifyHashedPassword(usuario, usuario.SenhaHash, senha ?? "") != PasswordVerificationResult.Failed;

    private static async Task<string> TipoDeExclusao(OrionDbContext db, Usuario usuario)
    {
        var outros = await db.Usuarios.Where(u => u.EmpresaId == usuario.EmpresaId && u.Id != usuario.Id).ToListAsync();
        if (outros.Count == 0) return "conta-e-empresa";
        // Quem não é administrador, ou tem outro administrador ativo na empresa, sai sozinho.
        if (!usuario.Administrador || outros.Any(u => u.Administrador && u.Ativo)) return "conta";
        return "conta-e-empresa";
    }

    private static async Task<ContaDto> Dto(OrionDbContext db, Usuario u) =>
        new(u.Id, u.Nome, u.Email, u.Telefone, u.Administrador,
            u.Empresa?.Nome, u.CriadoEm, await TipoDeExclusao(db, u));

    private static IResult CodigoInvalido(string mensagem) =>
        Results.BadRequest(new { erro = mensagem, campo = "codigo" });
}
