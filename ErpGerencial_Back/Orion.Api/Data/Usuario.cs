namespace Orion.Api.Data;

public class Usuario
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public required string Nome { get; set; }

    /// <summary>Sempre salvo em minúsculas e sem espaços nas pontas. Um e-mail = uma conta.</summary>
    public required string Email { get; set; }

    /// <summary>Só dígitos, com DDD (10 ou 11).</summary>
    public string? Telefone { get; set; }

    public string SenhaHash { get; set; } = "";

    /// <summary>Empresa em que a pessoa trabalha (criada junto com a conta, no cadastro).</summary>
    public Guid EmpresaId { get; set; }
    public Empresa? Empresa { get; set; }

    /// <summary>Administrador: acessa tudo e gerencia a empresa e os usuários.</summary>
    public bool Administrador { get; set; }

    /// <summary>Módulos liberados para quem não é administrador (ids de Permissoes.Modulos).</summary>
    public List<string> Permissoes { get; set; } = [];

    /// <summary>Usuário desativado pelo administrador não consegue mais entrar.</summary>
    public bool Ativo { get; set; } = true;

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
}
