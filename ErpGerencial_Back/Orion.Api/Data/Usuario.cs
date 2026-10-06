namespace Orion.Api.Data;

public class Usuario
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public required string Nome { get; set; }

    /// <summary>Sempre salvo em minúsculas e sem espaços nas pontas.</summary>
    public required string Email { get; set; }

    /// <summary>Só dígitos, com DDD (10 ou 11).</summary>
    public required string Telefone { get; set; }

    public string SenhaHash { get; set; } = "";
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
}
