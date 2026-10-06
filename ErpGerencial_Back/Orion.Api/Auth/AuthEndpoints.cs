using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Orion.Api.Data;

namespace Orion.Api.Auth;

public record CadastroRequest(string Nome, string Email, string Telefone, string Senha);
public record LoginRequest(string Email, string Senha);
public record AuthResponse(string Token, string Nome, string Email);
public record GoogleRequest(string Codigo);
public record GoogleConfigResponse(string? ClientId);

/// <summary>ContaNova: a conta acabou de ser criada (o front leva ao cadastro da loja).</summary>
public record GoogleAuthResponse(string Token, string Nome, string Email, bool ContaNova);

public static class AuthEndpoints
{
    private const string EmailDuplicado = "Este e-mail já está cadastrado";

    public static void MapAuthEndpoints(this WebApplication app)
    {
        var grupo = app.MapGroup("/api/auth");
        grupo.MapPost("/cadastro", Cadastrar);
        grupo.MapPost("/login", Entrar).RequireRateLimiting(Politicas.Login);

        // Client ID é público (vai para o navegador); null = Google ainda não configurado.
        grupo.MapGet("/google/config", (GoogleService google) =>
            Results.Ok(new GoogleConfigResponse(google.Configurado ? google.ClientId : null)));
        grupo.MapPost("/google", EntrarComGoogle).RequireRateLimiting(Politicas.Login);
    }

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

        return Results.Created($"/api/usuarios/{usuario.Id}",
            new AuthResponse(tokens.GerarUsuario(usuario), usuario.Nome, usuario.Email));
    }

    private static async Task<IResult> Entrar(
        LoginRequest req, OrionDbContext db, IPasswordHasher<Usuario> hasher, TokenService tokens)
    {
        var email = req.Email?.Trim().ToLowerInvariant() ?? "";
        var usuario = await db.Usuarios.SingleOrDefaultAsync(u => u.Email == email);

        // Mesma resposta para e-mail inexistente, senha errada e conta que só entra pelo Google.
        if (usuario?.SenhaHash is null
            || hasher.VerifyHashedPassword(usuario, usuario.SenhaHash, req.Senha ?? "")
                == PasswordVerificationResult.Failed)
            return Results.Unauthorized();

        return Results.Ok(new AuthResponse(tokens.GerarUsuario(usuario), usuario.Nome, usuario.Email));
    }

    /// <summary>
    /// Entra ou cria a conta com o Google. Se já existe conta com o mesmo e-mail
    /// (verificado pelo Google), a conta Google é ligada a ela.
    /// </summary>
    private static async Task<IResult> EntrarComGoogle(
        GoogleRequest req, GoogleService google, OrionDbContext db, TokenService tokens, CancellationToken ct)
    {
        if (!google.Configurado)
            return Results.Problem("O acesso com o Google ainda não foi configurado.", statusCode: 503);
        if (string.IsNullOrWhiteSpace(req.Codigo)) return Results.Unauthorized();

        var conta = await google.ValidarCodigo(req.Codigo, ct);
        if (conta is null) return Results.Unauthorized();
        if (!conta.EmailVerified || string.IsNullOrEmpty(conta.Email))
            return Results.BadRequest(new { erro = "Seu e-mail do Google ainda não foi verificado" });

        var email = conta.Email.Trim().ToLowerInvariant();
        var usuario = await db.Usuarios.SingleOrDefaultAsync(u => u.GoogleId == conta.Subject, ct)
            ?? await db.Usuarios.SingleOrDefaultAsync(u => u.Email == email, ct);

        var contaNova = false;
        if (usuario is null)
        {
            var nome = (conta.Name ?? conta.GivenName ?? email.Split('@')[0]).Trim();
            usuario = new Usuario
            {
                Nome = nome.Length > 120 ? nome[..120] : nome,
                Email = email,
                GoogleId = conta.Subject,
            };
            db.Usuarios.Add(usuario);
            contaNova = true;
        }
        else if (usuario.GoogleId is null)
        {
            usuario.GoogleId = conta.Subject;
        }
        else if (usuario.GoogleId != conta.Subject)
        {
            return Results.Conflict(new { erro = "Este e-mail já está ligado a outra conta Google" });
        }

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // Dois cliques ao mesmo tempo criando a mesma conta.
            return Results.Conflict(new { erro = "Tente entrar com o Google de novo" });
        }

        return Results.Ok(new GoogleAuthResponse(tokens.GerarUsuario(usuario), usuario.Nome, usuario.Email, contaNova));
    }
}
