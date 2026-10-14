using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Orion.Api.Data;

namespace Orion.Api.Auth;

public record CadastroRequest(string Nome, string Email, string Telefone, string NomeEmpresa, string Senha);
/// <summary>Entra com e-mail ou com o celular (o mesmo cadastrado em Minha conta) e a senha.</summary>
public record LoginRequest(string? Email, string? Telefone, string Senha);

public static class AuthEndpoints
{
    private const string EmailDuplicado = "Este e-mail já está cadastrado";

    public static void MapAuthEndpoints(this WebApplication app)
    {
        var grupo = app.MapGroup("/api/auth");
        grupo.MapPost("/cadastro", Cadastrar);
        grupo.MapPost("/login", Entrar).RequireRateLimiting(Politicas.Login);
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
