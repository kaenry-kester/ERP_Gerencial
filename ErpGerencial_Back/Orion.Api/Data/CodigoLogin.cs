namespace Orion.Api.Data;

/// <summary>
/// Código de 6 dígitos: no login (depois da senha, por e-mail ou WhatsApp, a pessoa escolhe) ou na troca de
/// e-mail (enviado ao e-mail novo, para provar que ele é da pessoa). O código em si não é guardado: só o hash.
/// </summary>
public class CodigoLogin
{
    public Guid Id { get; set; } = Guid.CreateVersion7();

    public Guid UsuarioId { get; set; }
    public Usuario? Usuario { get; set; }

    /// <summary>SHA-256 de "id:código", em hexadecimal.</summary>
    public required string CodigoHash { get; set; }

    public DateTime ExpiraEm { get; set; }

    /// <summary>Quando o código atual foi enviado (controla o "Reenviar código").</summary>
    public DateTime EnviadoEm { get; set; } = DateTime.UtcNow;

    /// <summary>Tentativas erradas; ao chegar no limite, a pessoa precisa entrar de novo.</summary>
    public int Tentativas { get; set; }

    /// <summary>Preenchido na troca de e-mail: o e-mail novo, que recebe o código. Vazio no login.</summary>
    public string? NovoEmail { get; set; }

    /// <summary>Por onde o código atual foi enviado: "email" ou "whatsapp" (vazio enquanto a pessoa não escolheu).</summary>
    public string? Canal { get; set; }

    /// <summary>"senha" no "Esqueci minha senha"; vazio nos outros usos.</summary>
    public string? Finalidade { get; set; }

    public DateTime? UsadoEm { get; set; }
    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
}
