using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Orion.Api.Auth;
using Orion.Api.Data;

namespace Orion.Api.Usuarios;

public record CriarUsuarioRequest(string Nome, string Email, string Senha, bool Administrador, List<string>? Permissoes);

public record EditarUsuarioRequest(string Nome, bool Administrador, List<string>? Permissoes, bool Ativo);

/// <summary>
/// "Usuários e permissões" (como em Preferências → Usuários do Bling): o administrador
/// cria os usuários da empresa, cada um com login próprio, e escolhe os módulos que cada um acessa.
/// </summary>
public static class UsuarioEndpoints
{
    private const string EmailDuplicado = "Este e-mail já tem uma conta no Órion";

    public static void MapUsuarioEndpoints(this WebApplication app)
    {
        var grupo = app.MapGroup("/api/usuarios").RequireAuthorization();
        grupo.MapGet("/", Listar);
        grupo.MapPost("/", Criar);
        grupo.MapPut("/{id:guid}", Editar);
    }

    private static async Task<IResult> Listar(ClaimsPrincipal user, OrionDbContext db)
    {
        var (admin, negado) = await Administrador(user, db);
        if (admin is null) return negado!;

        var usuarios = await db.Usuarios
            .Where(u => u.EmpresaId == admin.EmpresaId)
            .OrderByDescending(u => u.Ativo)
            .ThenByDescending(u => u.Administrador)
            .ThenBy(u => u.Nome)
            .ToListAsync();
        return Results.Ok(usuarios.Select(UsuarioAtual.Dto));
    }

    private static async Task<IResult> Criar(
        CriarUsuarioRequest req, ClaimsPrincipal user, OrionDbContext db, IPasswordHasher<Usuario> hasher)
    {
        var (admin, negado) = await Administrador(user, db);
        if (admin is null) return negado!;

        var erros = Validacao.NovoUsuario(req);
        if (erros.Count > 0) return Results.ValidationProblem(erros);

        var email = req.Email.Trim().ToLowerInvariant();
        if (await db.Usuarios.AnyAsync(u => u.Email == email))
            return Results.Conflict(new { erro = EmailDuplicado, campo = "email" });

        var novo = new Usuario
        {
            Nome = req.Nome.Trim(),
            Email = email,
            EmpresaId = admin.EmpresaId,
            Administrador = req.Administrador,
            Permissoes = req.Administrador ? [] : Permissoes.Limpar(req.Permissoes),
        };
        novo.SenhaHash = hasher.HashPassword(novo, req.Senha);
        db.Usuarios.Add(novo);

        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            return Results.Conflict(new { erro = EmailDuplicado, campo = "email" });
        }

        return Results.Created($"/api/usuarios/{novo.Id}", UsuarioAtual.Dto(novo));
    }

    private static async Task<IResult> Editar(
        Guid id, EditarUsuarioRequest req, ClaimsPrincipal user, OrionDbContext db)
    {
        var (admin, negado) = await Administrador(user, db);
        if (admin is null) return negado!;

        var alvo = await db.Usuarios.SingleOrDefaultAsync(u => u.Id == id && u.EmpresaId == admin.EmpresaId);
        if (alvo is null) return Results.NotFound();

        var erros = Validacao.EdicaoUsuario(req);
        if (erros.Count > 0) return Results.ValidationProblem(erros);

        // Quem edita a si mesmo não pode se tirar de administrador nem se desativar (ficaria sem acesso).
        if (alvo.Id == admin.Id && (!req.Administrador || !req.Ativo))
            return Results.Conflict(new { erro = "Você não pode tirar o seu próprio acesso de administrador" });

        alvo.Nome = req.Nome.Trim();
        alvo.Administrador = req.Administrador;
        alvo.Permissoes = req.Administrador ? [] : Permissoes.Limpar(req.Permissoes);
        alvo.Ativo = req.Ativo;

        await db.SaveChangesAsync();
        return Results.Ok(UsuarioAtual.Dto(alvo));
    }

    /// <summary>Quem chamou, se for administrador ativo de uma empresa; senão, a resposta de erro.</summary>
    private static async Task<(Usuario? Admin, IResult? Negado)> Administrador(ClaimsPrincipal user, OrionDbContext db)
    {
        var usuario = await UsuarioAtual.Carregar(user, db);
        if (usuario is null) return (null, Results.Unauthorized());
        if (!usuario.Administrador)
            return (null, Results.Json(new { erro = "Só o administrador da empresa pode gerenciar usuários" },
                statusCode: StatusCodes.Status403Forbidden));
        return (usuario, null);
    }
}
