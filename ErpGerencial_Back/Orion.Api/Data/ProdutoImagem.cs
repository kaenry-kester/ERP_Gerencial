namespace Orion.Api.Data;

/// <summary>Imagem de um produto. O arquivo fica no próprio banco; a de menor Ordem é a capa.</summary>
public class ProdutoImagem
{
    /// <summary>Aleatório (não sequencial): é o endereço público da imagem, então não pode ser adivinhado.</summary>
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ProdutoId { get; set; }
    public Produto? Produto { get; set; }

    /// <summary>Posição na galeria: 0 é a capa.</summary>
    public int Ordem { get; set; }

    /// <summary>image/jpeg, image/png, image/webp ou image/gif (conferido pelo conteúdo do arquivo).</summary>
    public required string TipoConteudo { get; set; }

    public required byte[] Dados { get; set; }

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
}
