namespace Orion.Api.Data;

public class Usuario
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public required string Nome { get; set; }

    /// <summary>Sempre salvo em minúsculas e sem espaços nas pontas. Um e-mail = uma conta.</summary>
    public required string Email { get; set; }

    /// <summary>Só dígitos, com DDD (10 ou 11). Vazio em contas criadas com o Google.</summary>
    public string? Telefone { get; set; }

    /// <summary>Vazio em contas criadas com o Google (elas entram só pelo Google).</summary>
    public string? SenhaHash { get; set; }

    /// <summary>Identificador da conta Google ("sub" do token), quando ligada.</summary>
    public string? GoogleId { get; set; }

    /// <summary>Empresa em que a pessoa trabalha. Vazio só entre o cadastro pelo Google e a criação da empresa.</summary>
    public Guid? EmpresaId { get; set; }
    public Empresa? Empresa { get; set; }

    /// <summary>Administrador: acessa tudo e gerencia a empresa e os usuários.</summary>
    public bool Administrador { get; set; }

    /// <summary>Módulos liberados para quem não é administrador (ids de Permissoes.Modulos).</summary>
    public List<string> Permissoes { get; set; } = [];

    /// <summary>Usuário desativado pelo administrador não consegue mais entrar.</summary>
    public bool Ativo { get; set; } = true;

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
}
