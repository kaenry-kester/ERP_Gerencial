namespace Orion.Api.Data;

/// <summary>Cliente de uma empresa, com endereço e o intervalo entre manutenções (ex.: troca de filtro).</summary>
public class Cliente
{
    public Guid Id { get; set; } = Guid.CreateVersion7();

    public Guid EmpresaId { get; set; }
    public Empresa? Empresa { get; set; }

    /// <summary>ID mostrado na tela: 1, 2, 3... sequencial dentro da empresa, gerado automaticamente.</summary>
    public int Numero { get; set; }

    public required string Nome { get; set; }

    /// <summary>Celular só com os dígitos (DDD + número).</summary>
    public required string Celular { get; set; }

    /// <summary>CPF (11) ou CNPJ (14, pode ter letras) sem pontuação. Opcional.</summary>
    public string? Documento { get; set; }

    /// <summary>CEP só com os 8 dígitos.</summary>
    public string? Cep { get; set; }
    public string? Logradouro { get; set; }
    public string? NumeroEndereco { get; set; }
    public string? Complemento { get; set; }
    public string? Bairro { get; set; }
    public string? Cidade { get; set; }
    public string? Uf { get; set; }

    /// <summary>
    /// Como a manutenção é marcada: "meses" (a cada N meses: a mensagem sai às 6h no mesmo dia do mês
    /// em que o intervalo foi salvo, e se repete) ou "data" (uma data e hora específica, uma vez só).
    /// </summary>
    public string TipoIntervalo { get; set; } = "meses";

    /// <summary>No tipo "meses": de quantos em quantos meses o cliente precisa de manutenção.</summary>
    public int? IntervaloManutencaoMeses { get; set; }

    /// <summary>Mensagem de WhatsApp só deste cliente (vazia: usa a mensagem padrão da empresa).</summary>
    public string? MensagemWhatsapp { get; set; }

    /// <summary>
    /// Dia e hora do próximo envio da mensagem de WhatsApp (é também a próxima manutenção).
    /// Depois do envio: no tipo "meses", o robô marca o seguinte (+ N meses, às 6h); no tipo "data", fica vazio.
    /// </summary>
    public DateTime? EnvioEm { get; set; }

    /// <summary>Dia do cadastro.</summary>
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
    public DateTime AtualizadoEm { get; set; } = DateTime.UtcNow;
}
