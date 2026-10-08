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

    /// <summary>CEP só com os 8 dígitos.</summary>
    public string? Cep { get; set; }
    public string? Logradouro { get; set; }
    public string? NumeroEndereco { get; set; }
    public string? Complemento { get; set; }
    public string? Bairro { get; set; }
    public string? Cidade { get; set; }
    public string? Uf { get; set; }

    /// <summary>De quantos em quantos meses o cliente precisa de manutenção.</summary>
    public int IntervaloManutencaoMeses { get; set; }

    /// <summary>Mensagem de WhatsApp só deste cliente (vazia: usa a mensagem automática da empresa).</summary>
    public string? MensagemWhatsapp { get; set; }

    /// <summary>
    /// TEMPORÁRIO, para testes: dia e hora em que o robô envia a mensagem (sem esperar a manutenção).
    /// Depois do envio, volta a ficar vazio.
    /// </summary>
    public DateTime? EnvioTesteEm { get; set; }

    /// <summary>Dia do cadastro (também é a base para a próxima manutenção).</summary>
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
    public DateTime AtualizadoEm { get; set; } = DateTime.UtcNow;
}
