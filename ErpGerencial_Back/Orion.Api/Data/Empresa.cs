namespace Orion.Api.Data;

/// <summary>
/// A conta da empresa (como no Bling: uma conta = uma empresa). Tudo do ERP — produtos,
/// estoque, clientes, vendas — pertence a uma empresa, e os usuários trabalham dentro dela.
/// </summary>
public class Empresa
{
    public Guid Id { get; set; } = Guid.CreateVersion7();

    /// <summary>Nome que aparece no sistema (nome fantasia).</summary>
    public required string Nome { get; set; }

    public string? RazaoSocial { get; set; }

    /// <summary>CNPJ (14, pode ter letras) ou CPF (11) sem pontuação. Opcional no cadastro.</summary>
    public string? Documento { get; set; }

    public string? Email { get; set; }

    /// <summary>Só dígitos, com DDD.</summary>
    public string? Telefone { get; set; }

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    // ----- Mensagem automática (WhatsApp) -----

    /// <summary>Celular (WhatsApp) que envia as mensagens, só dígitos com DDD.</summary>
    public string? WhatsappRemetente { get; set; }

    /// <summary>Mensagem padrão enviada aos clientes (na data e hora de cada um); aceita {nome}, {data} e {empresa}.</summary>
    public string? MensagemManutencao { get; set; }

    public List<Usuario> Usuarios { get; set; } = [];
}
