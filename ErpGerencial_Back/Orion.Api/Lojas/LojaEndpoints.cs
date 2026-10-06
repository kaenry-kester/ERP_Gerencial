using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Orion.Api.Auth;
using Orion.Api.Data;

namespace Orion.Api.Lojas;

public record CriarLojaRequest(
    string RazaoSocial,
    string NomeFantasia,
    string Cnpj,
    string NomeDono,
    string CpfDono,
    string Email,
    string Celular,
    string Senha);

public record LojaLoginRequest(string Cnpj, string Senha);

/// <summary>Resumo mostrado na lista "Suas lojas".</summary>
public record LojaResumo(Guid Id, string RazaoSocial, string NomeFantasia, string Cnpj);

/// <summary>Dados mostrados dentro da loja (sem a senha).</summary>
public record LojaDetalhe(
    Guid Id,
    string RazaoSocial,
    string NomeFantasia,
    string Cnpj,
    string NomeDono,
    string Email,
    string Celular,
    DateTime CriadoEm);

public record LojaAuthResponse(string Token, LojaDetalhe Loja);

public static class LojaEndpoints
{
    private const string CnpjDuplicado = "Este CNPJ já está cadastrado";

    public static void MapLojaEndpoints(this WebApplication app)
    {
        var grupo = app.MapGroup("/api/lojas");

        // Conta da pessoa: lista e cria as próprias lojas.
        grupo.MapGet("/", Listar).RequireAuthorization(Politicas.Usuario);
        grupo.MapPost("/", Criar).RequireAuthorization(Politicas.Usuario);

        // Acesso à loja: CNPJ + senha da loja.
        grupo.MapPost("/login", Entrar).RequireRateLimiting(Politicas.Login);
        grupo.MapGet("/atual", Atual).RequireAuthorization(Politicas.Loja);
    }

    private static async Task<IResult> Listar(ClaimsPrincipal user, OrionDbContext db)
    {
        var usuarioId = TokenService.IdDe(user);
        var lojas = await db.Lojas
            .Where(l => l.UsuarioId == usuarioId)
            .OrderBy(l => l.CriadoEm)
            .Select(l => new LojaResumo(l.Id, l.RazaoSocial, l.NomeFantasia, l.Cnpj))
            .ToListAsync();
        return Results.Ok(lojas);
    }

    private static async Task<IResult> Criar(
        CriarLojaRequest req, ClaimsPrincipal user, OrionDbContext db, IPasswordHasher<Loja> hasher)
    {
        var erros = Validacao.Loja(req);
        if (erros.Count > 0) return Results.ValidationProblem(erros);

        var usuarioId = TokenService.IdDe(user);
        // Token válido de uma conta que já não existe (ex.: banco recriado).
        if (!await db.Usuarios.AnyAsync(u => u.Id == usuarioId)) return Results.Unauthorized();

        var cnpj = Validacao.NormalizarCnpj(req.Cnpj);
        if (await db.Lojas.AnyAsync(l => l.Cnpj == cnpj))
            return Results.Conflict(new { erro = CnpjDuplicado, campo = "cnpj" });

        var loja = new Loja
        {
            UsuarioId = usuarioId,
            RazaoSocial = req.RazaoSocial.Trim(),
            NomeFantasia = req.NomeFantasia.Trim(),
            Cnpj = cnpj,
            NomeDono = req.NomeDono.Trim(),
            CpfDono = Validacao.SoDigitos(req.CpfDono),
            Email = req.Email.Trim().ToLowerInvariant(),
            Celular = Validacao.SoDigitos(req.Celular),
        };
        loja.SenhaHash = hasher.HashPassword(loja, req.Senha);
        db.Lojas.Add(loja);

        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // Duas lojas com o mesmo CNPJ ao mesmo tempo.
            return Results.Conflict(new { erro = CnpjDuplicado, campo = "cnpj" });
        }

        return Results.Created($"/api/lojas/{loja.Id}",
            new LojaResumo(loja.Id, loja.RazaoSocial, loja.NomeFantasia, loja.Cnpj));
    }

    private static async Task<IResult> Entrar(
        LojaLoginRequest req, OrionDbContext db, IPasswordHasher<Loja> hasher, TokenService tokens)
    {
        var cnpj = Validacao.NormalizarCnpj(req.Cnpj ?? "");
        var loja = await db.Lojas.SingleOrDefaultAsync(l => l.Cnpj == cnpj);

        // Mesma resposta para CNPJ inexistente e senha errada.
        if (loja is null
            || hasher.VerifyHashedPassword(loja, loja.SenhaHash, req.Senha ?? "")
                == PasswordVerificationResult.Failed)
            return Results.Unauthorized();

        return Results.Ok(new LojaAuthResponse(tokens.GerarLoja(loja), Detalhe(loja)));
    }

    private static async Task<IResult> Atual(ClaimsPrincipal user, OrionDbContext db)
    {
        var loja = await db.Lojas.FindAsync(TokenService.IdDe(user));
        return loja is null ? Results.Unauthorized() : Results.Ok(Detalhe(loja));
    }

    private static LojaDetalhe Detalhe(Loja l) =>
        new(l.Id, l.RazaoSocial, l.NomeFantasia, l.Cnpj, l.NomeDono, l.Email, l.Celular, l.CriadoEm);
}
