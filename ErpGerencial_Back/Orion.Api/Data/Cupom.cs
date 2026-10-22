namespace Orion.Api.Data;

/// <summary>
/// Cupom de venda / recibo emitido pela empresa (documento NÃO fiscal: não passa pela SEFAZ).
/// Os dados do emitente e do cliente são copiados na emissão, para a reimpressão sair igual à original
/// mesmo que os cadastros mudem depois. Não se exclui: cancela-se (com motivo), e o estoque volta.
/// </summary>
public class Cupom
{
    public Guid Id { get; set; } = Guid.CreateVersion7();

    public Guid EmpresaId { get; set; }
    public Empresa? Empresa { get; set; }

    /// <summary>Nº do cupom: 1, 2, 3... sequencial dentro da empresa, gerado automaticamente.</summary>
    public int Numero { get; set; }

    // ----- Emitente (a empresa, no momento da emissão) -----
    public required string EmitenteNome { get; set; }
    public string? EmitenteRazaoSocial { get; set; }
    public string? EmitenteDocumento { get; set; }
    public string? EmitenteEndereco { get; set; }
    public string? EmitenteCidade { get; set; }
    public string? EmitenteUf { get; set; }
    public string? EmitenteTelefone { get; set; }

    // ----- Cliente (opcional: sem cliente, sai "Consumidor") -----
    public Guid? ClienteId { get; set; }
    public string? ClienteNome { get; set; }
    /// <summary>CPF ou CNPJ sem pontuação.</summary>
    public string? ClienteDocumento { get; set; }
    public string? ClienteEndereco { get; set; }

    public List<CupomItem> Itens { get; set; } = [];

    /// <summary>Soma dos itens (no recibo avulso, sem itens, é o valor digitado).</summary>
    public decimal Subtotal { get; set; }
    public decimal Desconto { get; set; }
    public decimal Total { get; set; }

    /// <summary>dinheiro, pix, cartao-credito, cartao-debito, boleto, transferencia ou outro.</summary>
    public required string FormaPagamento { get; set; }
    /// <summary>Quanto foi pago na 1ª forma (null nos cupons antigos: o total).</summary>
    public decimal? ValorPagamento1 { get; set; }
    /// <summary>2ª forma de pagamento (venda paga em duas partes, ex.: parte no Pix e parte em dinheiro).</summary>
    public string? FormaPagamento2 { get; set; }
    public decimal? ValorPagamento2 { get; set; }
    /// <summary>Total pago (soma das formas); o troco é a diferença para o total da venda.</summary>
    public decimal? ValorRecebido { get; set; }

    /// <summary>"Correspondente a" do recibo (ex.: "Conserto da geladeira").</summary>
    public string? Referente { get; set; }
    public string? Observacao { get; set; }

    /// <summary>Nome de quem emitiu (impresso no cupom).</summary>
    public required string EmitidoPor { get; set; }
    public Guid? UsuarioId { get; set; }

    /// <summary>Vendedor da venda (por padrão, quem emitiu); o nome fica copiado.</summary>
    public Guid? VendedorId { get; set; }
    public string? VendedorNome { get; set; }

    public DateTime EmitidoEm { get; set; } = DateTime.UtcNow;

    public DateTime? CanceladoEm { get; set; }
    public string? MotivoCancelamento { get; set; }
}

/// <summary>Item do cupom: um produto do cadastro (dá baixa no estoque) ou um item avulso (ex.: serviço).</summary>
public class CupomItem
{
    public Guid Id { get; set; } = Guid.CreateVersion7();

    public Guid CupomId { get; set; }
    public Cupom? Cupom { get; set; }

    public int Ordem { get; set; }

    /// <summary>Produto do cadastro; null no item avulso (ou se o produto foi excluído depois).</summary>
    public Guid? ProdutoId { get; set; }

    public required string Descricao { get; set; }
    /// <summary>Código do produto, copiado na emissão.</summary>
    public string? Codigo { get; set; }
    /// <summary>Código de barras do produto, copiado na emissão.</summary>
    public string? CodigoBarras { get; set; }

    public decimal Quantidade { get; set; }
    public decimal ValorUnitario { get; set; }
    public decimal Total { get; set; }
    /// <summary>Preço de custo do produto na hora da venda (para o lucro no Financeiro); 0 no item avulso.</summary>
    public decimal CustoUnitario { get; set; }
}
