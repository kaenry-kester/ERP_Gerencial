namespace Orion.Api.Data;

/// <summary>Produto do catálogo de uma empresa.</summary>
public class Produto
{
    public Guid Id { get; set; } = Guid.CreateVersion7();

    public Guid EmpresaId { get; set; }
    public Empresa? Empresa { get; set; }

    /// <summary>ID mostrado na tela: 1, 2, 3... sequencial dentro da empresa, gerado automaticamente.</summary>
    public int Numero { get; set; }

    public required string Nome { get; set; }

    /// <summary>Código interno do produto (SKU). Não se repete na empresa.</summary>
    public string? Codigo { get; set; }

    /// <summary>Código de barras (EAN-13, EAN-8, UPC...), lido pelo leitor ou digitado. Não se repete na empresa.</summary>
    public string? CodigoBarras { get; set; }

    public decimal PrecoCusto { get; set; }
    public decimal PrecoVendaPf { get; set; }
    public decimal PrecoVendaPj { get; set; }

    /// <summary>Quantidade em estoque (aceita fração, ex.: 1,5 kg).</summary>
    public decimal Quantidade { get; set; }

    public string? Marca { get; set; }
    public string? Modelo { get; set; }
    public string? Cor { get; set; }
    public string? Voltagem { get; set; }
    public string? Observacao { get; set; }

    /// <summary>Unidade de venda (UN, KG, M, CX...).</summary>
    public string Unidade { get; set; } = "UN";
    /// <summary>Abaixo disso, o produto aparece como "estoque baixo".</summary>
    public decimal EstoqueMinimo { get; set; }


    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
    public DateTime AtualizadoEm { get; set; } = DateTime.UtcNow;
}
