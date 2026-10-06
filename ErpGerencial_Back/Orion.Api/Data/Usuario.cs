namespace Orion.Api.Data;

public class Usuario
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public required string Nome { get; set; }

    /// <summary>Sempre salvo em minúsculas e sem espaços nas pontas.</summary>
    public required string Email { get; set; }

    /// <summary>Só dígitos, com DDD (10 ou 11). Vazio em contas criadas com o Google.</summary>
    public string? Telefone { get; set; }

    /// <summary>Vazio em contas criadas com o Google (elas entram só pelo Google).</summary>
    public string? SenhaHash { get; set; }

    /// <summary>Identificador da conta Google ("sub" do token), quando ligada.</summary>
    public string? GoogleId { get; set; }

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
}
