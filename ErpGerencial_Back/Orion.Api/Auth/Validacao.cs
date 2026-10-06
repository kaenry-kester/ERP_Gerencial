using System.Text.RegularExpressions;

namespace Orion.Api.Auth;

/// <summary>Mesmas regras de ErpGerencial_Front/src/utils/validacao.ts.</summary>
public static partial class Validacao
{
    [GeneratedRegex(@"^\S+@\S+\.\S+$")]
    private static partial Regex EmailRegex();

    [GeneratedRegex(@"\p{Lu}")]
    private static partial Regex MaiusculaRegex();

    [GeneratedRegex(@"\d")]
    private static partial Regex NumeroRegex();

    [GeneratedRegex(@"[^\p{L}\d\s]")]
    private static partial Regex EspecialRegex();

    public static string SoDigitos(string valor) => new(valor.Where(char.IsAsciiDigit).ToArray());

    public static Dictionary<string, string[]> Cadastro(CadastroRequest req)
    {
        var erros = new Dictionary<string, string[]>();

        var nome = req.Nome?.Trim() ?? "";
        if (nome.Length == 0) erros["nome"] = ["Digite seu nome"];
        else if (nome.Length < 3) erros["nome"] = ["Mínimo de 3 letras"];
        else if (nome.Length > 120) erros["nome"] = ["Máximo de 120 letras"];

        var email = req.Email?.Trim() ?? "";
        if (email.Length == 0) erros["email"] = ["Digite seu e-mail"];
        else if (email.Length > 254 || !EmailRegex().IsMatch(email)) erros["email"] = ["E-mail inválido"];

        var telefone = SoDigitos(req.Telefone ?? "");
        if (telefone.Length == 0) erros["telefone"] = ["Digite com DDD"];
        else if (telefone.Length is not (10 or 11)) erros["telefone"] = ["Número incompleto"];

        var senha = req.Senha ?? "";
        if (senha.Length == 0) erros["senha"] = ["Crie uma senha"];
        else if (senha.Length < 8
            || !MaiusculaRegex().IsMatch(senha)
            || !NumeroRegex().IsMatch(senha)
            || !EspecialRegex().IsMatch(senha))
            erros["senha"] = ["Faltam requisitos"];

        return erros;
    }
}
