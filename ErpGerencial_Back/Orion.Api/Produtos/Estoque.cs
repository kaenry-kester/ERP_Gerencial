using Orion.Api.Data;

namespace Orion.Api.Produtos;

/// <summary>
/// Toda mudança na quantidade de um produto passa por aqui: muda o saldo e registra a movimentação
/// (quem, quando, por quê e o saldo depois). Quem chama salva (SaveChanges) junto com o resto.
/// </summary>
public static class Estoque
{
    public static readonly string[] Tipos = ["inicial", "ajuste", "venda", "cancelamento"];

    public static MovimentoEstoque Movimentar(
        OrionDbContext db, Produto produto, string tipo, decimal quantidade, Usuario usuario,
        decimal? custoUnitario = null, string? observacao = null, Guid? cupomId = null)
    {
        produto.Quantidade = Math.Round(produto.Quantidade + quantidade, 3);
        produto.AtualizadoEm = DateTime.UtcNow;
        var movimento = new MovimentoEstoque
        {
            EmpresaId = produto.EmpresaId,
            ProdutoId = produto.Id,
            Tipo = tipo,
            Quantidade = Math.Round(quantidade, 3),
            SaldoApos = produto.Quantidade,
            CustoUnitario = custoUnitario,
            Observacao = observacao,
            CupomId = cupomId,
            UsuarioId = usuario.Id,
            UsuarioNome = usuario.Nome,
        };
        db.MovimentosEstoque.Add(movimento);
        return movimento;
    }

    /// <summary>Abaixo (ou igual) ao mínimo definido no produto.</summary>
    public static bool Baixo(Produto p) => p.EstoqueMinimo > 0 && p.Quantidade <= p.EstoqueMinimo;
}
