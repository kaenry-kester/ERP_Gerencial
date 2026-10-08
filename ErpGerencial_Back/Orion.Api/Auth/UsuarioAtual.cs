using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Orion.Api.Data;

namespace Orion.Api.Auth;

/// <summary>Resposta comum de login, cadastro e /api/auth/eu.</summary>
public record SessaoResponse(string Token, UsuarioDto Usuario, EmpresaResumo Empresa);

public record UsuarioDto(
    Guid Id,
    string Nome,
    string Email,
    bool Administrador,
    List<string> Permissoes,
    bool Ativo,
    DateTime CriadoEm);

public record EmpresaResumo(Guid Id, string Nome);

public static class UsuarioAtual
{
    /// <summary>
    /// Carrega quem fez a requisição, com a empresa. Null quando o token é de uma conta
    /// que não existe mais ou foi desativada — as rotas respondem 401 e o front pede login de novo.
    /// </summary>
    public static async Task<Usuario?> Carregar(ClaimsPrincipal principal, OrionDbContext db, CancellationToken ct = default)
    {
        var id = TokenService.IdDe(principal);
        if (id is null) return null;
        var usuario = await db.Usuarios.Include(u => u.Empresa).SingleOrDefaultAsync(u => u.Id == id, ct);
        return usuario is { Ativo: true } ? usuario : null;
    }

    public static UsuarioDto Dto(Usuario u) =>
        new(u.Id, u.Nome, u.Email, u.Administrador, u.Permissoes, u.Ativo, u.CriadoEm);

    public static SessaoResponse Sessao(Usuario u, TokenService tokens) =>
        new(tokens.Gerar(u), Dto(u), new EmpresaResumo(u.EmpresaId, u.Empresa!.Nome));
}
