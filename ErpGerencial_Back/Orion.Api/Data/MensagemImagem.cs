namespace Orion.Api.Data;

/// <summary>
/// Imagem enviada junto com a mensagem automática de WhatsApp (o texto vai como legenda). ClienteId vazio: imagem da
/// mensagem padrão da empresa; preenchido: imagem da mensagem personalizada daquele cliente.
/// </summary>
public class MensagemImagem
{
    /// <summary>Aleatório (não sequencial): é o endereço público da imagem, então não pode ser adivinhado.</summary>
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid EmpresaId { get; set; }
    public Guid? ClienteId { get; set; }

    /// <summary>image/jpeg, image/png ou image/webp (conferido pelo conteúdo do arquivo).</summary>
    public required string TipoConteudo { get; set; }

    public required byte[] Dados { get; set; }

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
}
