namespace Orion.Api.Data;

/// <summary>
/// Navegador marcado com "Lembrar de quem sou": por 30 dias, o login nele não pede o código por e-mail.
/// O navegador guarda o token; aqui fica só o hash.
/// </summary>
public class DispositivoConfiavel
{
    public Guid Id { get; set; } = Guid.CreateVersion7();

    public Guid UsuarioId { get; set; }
    public Usuario? Usuario { get; set; }

    /// <summary>SHA-256 do token, em hexadecimal.</summary>
    public required string TokenHash { get; set; }

    /// <summary>Navegador e sistema (User-Agent), para a pessoa reconhecer o dispositivo depois.</summary>
    public string? Descricao { get; set; }

    public DateTime ExpiraEm { get; set; }
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
    public DateTime UltimoUsoEm { get; set; } = DateTime.UtcNow;
}
