using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Orion.Api.Auth;
using Orion.Api.Data;

namespace Orion.Api.Empresas;

public record CriarEmpresaRequest(string Nome, string? Documento);

public record EditarEmpresaRequest(string Nome, string? RazaoSocial, string? Documento, string? Email, string? Telefone);

public record EmpresaDto(
    Guid Id,
    string Nome,
    string? RazaoSocial,
    string? Documento,
    string? Email,
    string? Telefone,
    DateTime CriadoEm);

public static class EmpresaEndpoints
{
    private const string DocumentoDuplicado = "Já existe uma empresa com este CNPJ/CPF";

    public static void MapEmpresaEndpoints(this WebApplication app)
    {
        var grupo = app.MapGroup("/api/empresa").RequireAuthorization();
        grupo.MapPost("/", Criar);
        grupo.MapGet("/", Obter);
        grupo.MapPut("/", Editar);
    }

    /// <summary>Quem entrou pelo Google e ainda não tem empresa cria a sua e vira o administrador.</summary>
    private static async Task<IResult> Criar(
        CriarEmpresaRequest req, ClaimsPrincipal user, OrionDbContext db, TokenService tokens)
    {
        var usuario = await UsuarioAtual.Carregar(user, db);
        if (usuario is null) return Results.Unauthorized();
        if (usuario.EmpresaId is not null)
            return Results.Conflict(new { erro = "Sua conta já faz parte de uma empresa" });

        var erros = Validacao.NovaEmpresa(req);
        if (erros.Count > 0) return Results.ValidationProblem(erros);

        usuario.Empresa = new Empresa
        {
            Nome = req.Nome.Trim(),
            Documento = Documento(req.Documento),
            Email = usuario.Email,
        };
        usuario.Administrador = true;

        if (await Salvar(db) is { } conflito) return conflito;
        return Results.Ok(UsuarioAtual.Sessao(usuario, tokens));
    }

    private static async Task<IResult> Obter(ClaimsPrincipal user, OrionDbContext db)
    {
        var usuario = await UsuarioAtual.Carregar(user, db);
        if (usuario is null) return Results.Unauthorized();
        return usuario.Empresa is null ? Results.NotFound() : Results.Ok(Dto(usuario.Empresa));
    }

    private static async Task<IResult> Editar(EditarEmpresaRequest req, ClaimsPrincipal user, OrionDbContext db)
    {
        var usuario = await UsuarioAtual.Carregar(user, db);
        if (usuario is null) return Results.Unauthorized();
        if (usuario.Empresa is null || !usuario.Administrador) return Results.Forbid();

        var erros = Validacao.Empresa(req);
        if (erros.Count > 0) return Results.ValidationProblem(erros);

        var empresa = usuario.Empresa;
        empresa.Nome = req.Nome.Trim();
        empresa.RazaoSocial = Opcional(req.RazaoSocial);
        empresa.Documento = Documento(req.Documento);
        empresa.Email = Opcional(req.Email)?.ToLowerInvariant();
        empresa.Telefone = Opcional(Validacao.SoDigitos(req.Telefone ?? ""));

        if (await Salvar(db) is { } conflito) return conflito;
        return Results.Ok(Dto(empresa));
    }

    private static async Task<IResult?> Salvar(OrionDbContext db)
    {
        try
        {
            await db.SaveChangesAsync();
            return null;
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            return Results.Conflict(new { erro = DocumentoDuplicado, campo = "documento" });
        }
    }

    private static string? Opcional(string? valor) => string.IsNullOrWhiteSpace(valor) ? null : valor.Trim();

    private static string? Documento(string? valor) => Opcional(Validacao.NormalizarDocumento(valor ?? ""));

    private static EmpresaDto Dto(Empresa e) =>
        new(e.Id, e.Nome, e.RazaoSocial, e.Documento, e.Email, e.Telefone, e.CriadoEm);
}
