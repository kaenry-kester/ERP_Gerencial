namespace Orion.Api.Data;

/// <summary>Foto do cliente (tirada pela webcam no cadastro). Uma por cliente; o arquivo fica no próprio banco.</summary>
public class ClienteFoto
{
    /// <summary>Aleatório (não sequencial): é o endereço público da foto, então não pode ser adivinhado.</summary>
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ClienteId { get; set; }
    public Cliente? Cliente { get; set; }

    /// <summary>image/jpeg, image/png ou image/webp (conferido pelo conteúdo do arquivo).</summary>
    public required string TipoConteudo { get; set; }

    public required byte[] Dados { get; set; }

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
}
