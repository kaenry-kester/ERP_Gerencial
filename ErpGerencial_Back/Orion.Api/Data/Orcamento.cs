namespace Orion.Api.Data;

/// <summary>
/// Orçamento: uma tabela de serviços (serviço, observação, preço, quantidade e data) para um cliente.
/// Fica "aberto" enquanto é montado; ao finalizar, vira um cupom com os mesmos itens e não muda mais.
/// </summary>
public class Orcamento
{
    public Guid Id { get; set; } = Guid.CreateVersion7();

    public Guid EmpresaId { get; set; }

    /// <summary>Nº do orçamento: 1, 2, 3... sequencial dentro da empresa.</summary>
    public int Numero { get; set; }

    /// <summary>Cliente do cadastro (opcional); o nome fica copiado.</summary>
    public Guid? ClienteId { get; set; }
    public string? ClienteNome { get; set; }

    public string? Observacao { get; set; }

    public List<OrcamentoItem> Itens { get; set; } = [];

    public decimal Total { get; set; }

    /// <summary>"aberto" ou "finalizado".</summary>
    public string Situacao { get; set; } = "aberto";

    /// <summary>Cupom gerado ao finalizar.</summary>
    public Guid? CupomId { get; set; }
    public int? CupomNumero { get; set; }
    public DateTime? FinalizadoEm { get; set; }

    /// <summary>Quem fez o orçamento.</summary>
    public required string CriadoPor { get; set; }
    public Guid? UsuarioId { get; set; }

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
    public DateTime AtualizadoEm { get; set; } = DateTime.UtcNow;
}

/// <summary>Linha do orçamento.</summary>
public class OrcamentoItem
{
    public Guid Id { get; set; } = Guid.CreateVersion7();

    public Guid OrcamentoId { get; set; }
    public Orcamento? Orcamento { get; set; }

    public int Ordem { get; set; }

    public required string Servico { get; set; }
    public string? Observacao { get; set; }
    public decimal Preco { get; set; }
    public decimal Quantidade { get; set; }
    public DateOnly? Data { get; set; }
    public decimal Total { get; set; }
}
