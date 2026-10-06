using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Orion.Api.Data;

namespace Orion.Api.Auth;

public record CadastroRequest(string Nome, string Email, string Telefone, string Senha);
public record LoginRequest(string Email, string Senha);
public record AuthResponse(string Token, string Nome, string Email);

public static class AuthEndpoints
{
    private const string EmailDuplicado = "Este e-mail já está cadastrado";

    public static void MapAuthEndpoints(this WebApplication app)
    {
        var grupo = app.MapGroup("/api/auth");
        grupo.MapPost("/cadastro", Cadastrar);
        grupo.MapPost("/login", Entrar);
    }

    private static async Task<IResult> Cadastrar(
        CadastroRequest req, OrionDbContext db, IPasswordHasher<Usuario> hasher, TokenService tokens)
    {
        var erros = Validacao.Cadastro(req);
        if (erros.Count > 0) return Results.ValidationProblem(erros);

        var email = req.Email.Trim().ToLowerInvariant();
        if (await db.Usuarios.AnyAsync(u => u.Email == email))
            return Results.Conflict(new { erro = EmailDuplicado });

        var usuario = new Usuario
        {
            Nome = req.Nome.Trim(),
            Email = email,
            Telefone = Validacao.SoDigitos(req.Telefone),
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
            return Results.Conflict(new { erro = EmailDuplicado });
        }

        return Results.Created($"/api/usuarios/{usuario.Id}",
            new AuthResponse(tokens.Gerar(usuario), usuario.Nome, usuario.Email));
    }

    private static async Task<IResult> Entrar(
        LoginRequest req, OrionDbContext db, IPasswordHasher<Usuario> hasher, TokenService tokens)
    {
        var email = req.Email?.Trim().ToLowerInvariant() ?? "";
        var usuario = await db.Usuarios.SingleOrDefaultAsync(u => u.Email == email);

        // Mesma resposta para e-mail inexistente e senha errada.
        if (usuario is null
            || hasher.VerifyHashedPassword(usuario, usuario.SenhaHash, req.Senha ?? "")
                == PasswordVerificationResult.Failed)
            return Results.Unauthorized();

        return Results.Ok(new AuthResponse(tokens.Gerar(usuario), usuario.Nome, usuario.Email));
    }
}
