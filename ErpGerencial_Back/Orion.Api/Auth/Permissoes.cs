using System.Security.Claims;
using Orion.Api.Data;

namespace Orion.Api.Auth;

/// <summary>
/// Dois tipos de usuário: o administrador pode tudo; o funcionário só vê produtos, vê clientes e
/// cadastra clientes (não mexe em produtos, não edita clientes e não acessa o financeiro).
/// Ids iguais aos de ErpGerencial_Front/src/pages/erp/modulos.ts.
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
    /// <summary>Emitir, consultar, imprimir e cancelar cupons e recibos (por enquanto só o administrador).</summary>
    public const string CupomFiscal = "cupom-fiscal";
    /// <summary>Histórico de cada cliente (página "Número de ordem de serviço"; por enquanto só o administrador).</summary>
    public const string OrdemServico = "ordem-servico";

    /// <summary>Tudo o que um funcionário pode fazer (fixo: não depende do que estiver gravado no usuário).</summary>
    public static readonly IReadOnlyList<string> Funcionario = [Produtos, Clientes, ClientesCadastrar];

    /// <summary>Permissões gravadas no usuário e enviadas ao site: o administrador tem todas, sem lista.</summary>
    public static List<string> De(bool administrador) => administrador ? [] : [.. Funcionario];

    public static bool Tem(Usuario usuario, string permissao) =>
        usuario.Administrador || Funcionario.Contains(permissao);

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
