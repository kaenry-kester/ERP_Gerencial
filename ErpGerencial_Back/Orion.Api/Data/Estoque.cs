namespace Orion.Api.Data;

/// <summary>
/// Uma mudança na quantidade de um produto: estoque inicial, ajuste manual, venda (cupom) ou cancelamento de venda.
/// Guarda o saldo depois da mudança e quem fez.
/// </summary>
public class MovimentoEstoque
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid EmpresaId { get; set; }

    public Guid ProdutoId { get; set; }

    /// <summary>inicial, ajuste, venda ou cancelamento.</summary>
    public required string Tipo { get; set; }

    /// <summary>Positivo entra, negativo sai.</summary>
    public decimal Quantidade { get; set; }

    /// <summary>Quantidade do produto depois deste movimento.</summary>
    public decimal SaldoApos { get; set; }

    /// <summary>Estoque inicial: o custo de cada unidade.</summary>
    public decimal? CustoUnitario { get; set; }

    public string? Observacao { get; set; }

    /// <summary>Venda e cancelamento: o cupom.</summary>
    public Guid? CupomId { get; set; }

    public Guid? UsuarioId { get; set; }
    public required string UsuarioNome { get; set; }

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
}
