namespace Orion.Api.Data;

public class Loja
{
    public Guid Id { get; set; } = Guid.CreateVersion7();

    /// <summary>Conta (usuário) que cadastrou a loja.</summary>
    public Guid UsuarioId { get; set; }
    public Usuario? Usuario { get; set; }

    /// <summary>Nome da companhia, como no cartão do CNPJ.</summary>
    public required string RazaoSocial { get; set; }
    public required string NomeFantasia { get; set; }

    /// <summary>14 caracteres, sem pontuação. Pode ter letras (CNPJ alfanumérico).</summary>
    public required string Cnpj { get; set; }

    public required string NomeDono { get; set; }

    /// <summary>Só dígitos (11).</summary>
    public required string CpfDono { get; set; }

    public required string Email { get; set; }

    /// <summary>Só dígitos, com DDD (11).</summary>
    public required string Celular { get; set; }

    public string SenhaHash { get; set; } = "";
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
}
