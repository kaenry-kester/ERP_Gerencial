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

    // ---------- Campos da ficha "Registro de Cliente" (todos opcionais) ----------

    /// <summary>Produto que o cliente comprou (texto livre; o site sugere os produtos cadastrados).</summary>
    public string? Produto { get; set; }

    /// <summary>RG (pessoa física) ou inscrição estadual (empresa), como foi digitado.</summary>
    public string? RgInscricao { get; set; }

    public DateOnly? DataNascimento { get; set; }

    /// <summary>Ponto de referência do endereço (ex.: "ao lado da padaria").</summary>
    public string? PontoReferencia { get; set; }

    /// <summary>Telefones só com os dígitos (DDD + número).</summary>
    public string? TelefoneResidencial { get; set; }
    public string? TelefoneComercial { get; set; }

    /// <summary>Segundo celular (o primeiro, obrigatório, é o que recebe o WhatsApp).</summary>
    public string? Celular2 { get; set; }

    public string? Conjuge { get; set; }

    /// <summary>Aparelho do cliente (ex.: "Purificador"), com marca, modelo e uma observação livre.</summary>
    public string? Item { get; set; }
    public string? Marca { get; set; }
    public string? Modelo { get; set; }
    public string? Observacao { get; set; }

    /// <summary>Dia da compra do produto.</summary>
    public DateOnly? DataCompra { get; set; }

    /// <summary>CEP só com os 8 dígitos.</summary>
    public string? Cep { get; set; }
    public string? Logradouro { get; set; }
    public string? NumeroEndereco { get; set; }
    public string? Complemento { get; set; }
    public string? Bairro { get; set; }
    public string? Cidade { get; set; }
    public string? Uf { get; set; }

    /// <summary>
    /// Como a manutenção é marcada: "meses" (a cada N meses, no horário escolhido, e se repete) ou "data"
    /// (cadastros antigos: uma data e hora específica, uma vez só). Hoje o cadastro sempre grava "meses".
    /// </summary>
    public string TipoIntervalo { get; set; } = "meses";

    /// <summary>
    /// De quanto em quanto tempo a mensagem se repete (em IntervaloUnidade). Calculado pela diferença entre o momento
    /// do cadastro e o próximo envio escolhido: hoje 16h30, envio 17h → 30 minutos; 14/10 → 14/12 → 2 meses.
    /// Vazio: sem envios automáticos.
    /// </summary>
    public int? IntervaloQuantidade { get; set; }

    /// <summary>"minutos", "horas", "dias", "semanas" ou "meses".</summary>
    public string IntervaloUnidade { get; set; } = "meses";

    /// <summary>Mensagem de WhatsApp só deste cliente (vazia: usa a mensagem padrão da empresa).</summary>
    public string? MensagemWhatsapp { get; set; }

    /// <summary>
    /// Dia e hora do próximo envio da mensagem de WhatsApp (é também a próxima manutenção).
    /// Depois do envio: no tipo "meses", o robô marca o seguinte (+ o intervalo); no tipo "data", fica vazio.
    /// Vazio: envios automáticos cancelados.
    /// </summary>
    public DateTime? EnvioEm { get; set; }

    /// <summary>Dia do cadastro.</summary>
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
    public DateTime AtualizadoEm { get; set; } = DateTime.UtcNow;
}
