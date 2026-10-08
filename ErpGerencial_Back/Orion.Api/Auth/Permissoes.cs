using System.Security.Claims;
using Orion.Api.Data;

namespace Orion.Api.Auth;

/// <summary>
/// Permissões que o administrador marca para cada usuário (ids iguais aos de
/// ErpGerencial_Front/src/pages/erp/modulos.ts). O administrador tem todas.
/// Cadastrar/editar incluem automaticamente "ver" do mesmo módulo.
/// </summary>
public static class Permissoes
{
    public const string Produtos = "produtos";
    public const string ProdutosCadastrar = "produtos-cadastrar";
    public const string ProdutosEditar = "produtos-editar";
    public const string Clientes = "clientes";
    public const string ClientesCadastrar = "clientes-cadastrar";
    public const string ClientesEditar = "clientes-editar";
    public const string Financeiro = "financeiro";

    public static readonly IReadOnlySet<string> Modulos = new HashSet<string>
    {
        Produtos, ProdutosCadastrar, ProdutosEditar,
        Clientes, ClientesCadastrar, ClientesEditar,
        Financeiro,
    };

    /// <summary>Mantém só ids conhecidos, sem repetir, e acrescenta o "ver" de quem pode cadastrar/editar.</summary>
    public static List<string> Limpar(IEnumerable<string>? ids)
    {
        var lista = (ids ?? []).Where(Modulos.Contains).Distinct().ToList();
        foreach (var id in lista.ToList())
        {
            var modulo = id.Split('-')[0];
            if (modulo != id && !lista.Contains(modulo)) lista.Add(modulo);
        }
        return lista;
    }

    public static bool Tem(Usuario usuario, string permissao) =>
        usuario.Administrador || usuario.Permissoes.Contains(permissao);

    /// <summary>Quem chamou, se tiver a permissão; senão, a resposta de erro (401 ou 403).</summary>
    public static async Task<(Usuario? Usuario, IResult? Negado)> Exigir(
        ClaimsPrincipal user, OrionDbContext db, string permissao)
    {
        var usuario = await UsuarioAtual.Carregar(user, db);
        if (usuario is null) return (null, Results.Unauthorized());
        if (!Tem(usuario, permissao))
            return (null, Results.Json(new { erro = "Você não tem permissão para isso" },
                statusCode: StatusCodes.Status403Forbidden));
        return (usuario, null);
    }
}
