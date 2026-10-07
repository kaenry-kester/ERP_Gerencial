namespace Orion.Api.Auth;

public static class Politicas
{
    /// <summary>Limite de tentativas nas rotas de login.</summary>
    public const string Login = "Login";

    /// <summary>Limite de tentativas nas rotas do código por e-mail (conferir e reenviar).</summary>
    public const string Codigo = "Codigo";

    /// <summary>Limite das ações de "Minha conta" que conferem a senha (trocar senha/e-mail, excluir).</summary>
    public const string Conta = "Conta";
}
