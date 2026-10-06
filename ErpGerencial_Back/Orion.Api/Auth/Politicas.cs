namespace Orion.Api.Auth;

public static class Politicas
{
    /// <summary>Token da conta da pessoa (cadastro/login com e-mail).</summary>
    public const string Usuario = "Usuario";

    /// <summary>Token de uma loja (login com CNPJ e senha).</summary>
    public const string Loja = "Loja";

    /// <summary>Limite de tentativas nas rotas de login.</summary>
    public const string Login = "Login";
}
