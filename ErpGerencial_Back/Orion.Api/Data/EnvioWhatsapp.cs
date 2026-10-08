namespace Orion.Api.Data;

/// <summary>
/// Uma mensagem automática de manutenção enviada (ou tentada) para um cliente.
/// Um cliente recebe no máximo uma mensagem por data de manutenção.
/// </summary>
public class EnvioWhatsapp
{
    public Guid Id { get; set; } = Guid.CreateVersion7();

    public Guid EmpresaId { get; set; }

    public Guid ClienteId { get; set; }
    public Cliente? Cliente { get; set; }

    /// <summary>A data de manutenção que motivou o envio (no teste agendado: o dia do teste).</summary>
    public DateOnly DataReferencia { get; set; }

    /// <summary>"manutencao" (no dia da manutenção) ou "agendado" (teste com data e hora escolhidas).</summary>
    public string Tipo { get; set; } = "manutencao";

    /// <summary>Celular do cliente (só dígitos, com DDD) no momento do envio.</summary>
    public required string Telefone { get; set; }

    /// <summary>Texto final, já com nome, data e empresa preenchidos.</summary>
    public required string Mensagem { get; set; }

    /// <summary>"enviado", "teste" (modo teste do robô: nada saiu de verdade) ou "erro" (o robô tenta de novo).</summary>
    public required string Status { get; set; }

    public string? Erro { get; set; }

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
}
