using System.Text.RegularExpressions;
using Orion.Api.Lojas;

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

    [GeneratedRegex(@"^[A-Z0-9]{12}[0-9]{2}$")]
    private static partial Regex CnpjFormatoRegex();

    public static string SoDigitos(string valor) => new(valor.Where(char.IsAsciiDigit).ToArray());

    /// <summary>Tira pontuação e espaços e deixa as letras maiúsculas (CNPJ alfanumérico).</summary>
    public static string NormalizarCnpj(string valor) =>
        new(valor.Where(char.IsAsciiLetterOrDigit).Select(char.ToUpperInvariant).ToArray());

    public static Dictionary<string, string[]> Cadastro(CadastroRequest req)
    {
        var erros = new Dictionary<string, string[]>();

        Nome(erros, "nome", req.Nome, "Digite seu nome", 120);
        Email(erros, "email", req.Email);

        var telefone = SoDigitos(req.Telefone ?? "");
        if (telefone.Length == 0) erros["telefone"] = ["Digite com DDD"];
        else if (telefone.Length is not (10 or 11)) erros["telefone"] = ["Número incompleto"];

        Senha(erros, "senha", req.Senha);
        return erros;
    }

    public static Dictionary<string, string[]> Loja(CriarLojaRequest req)
    {
        var erros = new Dictionary<string, string[]>();

        Nome(erros, "razaoSocial", req.RazaoSocial, "Digite o nome da companhia", 150);
        Nome(erros, "nomeFantasia", req.NomeFantasia, "Digite o nome fantasia", 100, minimo: 2);

        var cnpj = NormalizarCnpj(req.Cnpj ?? "");
        if (cnpj.Length == 0) erros["cnpj"] = ["Digite o CNPJ"];
        else if (cnpj.Length != 14) erros["cnpj"] = ["CNPJ incompleto"];
        else if (!CnpjValido(cnpj)) erros["cnpj"] = ["CNPJ inválido"];

        Nome(erros, "nomeDono", req.NomeDono, "Digite o nome do dono", 120);
        if (!erros.ContainsKey("nomeDono") && !req.NomeDono.Trim().Contains(' '))
            erros["nomeDono"] = ["Falta o sobrenome"];

        var cpf = SoDigitos(req.CpfDono ?? "");
        if (cpf.Length == 0) erros["cpfDono"] = ["Digite o CPF"];
        else if (cpf.Length != 11) erros["cpfDono"] = ["CPF incompleto"];
        else if (!CpfValido(cpf)) erros["cpfDono"] = ["CPF inválido"];

        Email(erros, "email", req.Email);

        var celular = SoDigitos(req.Celular ?? "");
        if (celular.Length == 0) erros["celular"] = ["Digite com DDD"];
        else if (celular.Length != 11) erros["celular"] = ["Número incompleto"];
        else if (celular[2] != '9' || celular[0] == '0') erros["celular"] = ["Celular inválido"];

        Senha(erros, "senha", req.Senha);
        return erros;
    }

    /// <summary>CPF com 11 dígitos e os dois dígitos verificadores corretos.</summary>
    public static bool CpfValido(string cpf)
    {
        if (cpf.Length != 11 || !cpf.All(char.IsAsciiDigit) || cpf.Distinct().Count() == 1) return false;

        int Digito(int tamanho)
        {
            var soma = 0;
            for (var i = 0; i < tamanho; i++) soma += (cpf[i] - '0') * (tamanho + 1 - i);
            var resto = soma * 10 % 11;
            return resto == 10 ? 0 : resto;
        }

        return Digito(9) == cpf[9] - '0' && Digito(10) == cpf[10] - '0';
    }

    /// <summary>
    /// CNPJ numérico ou alfanumérico (Receita Federal, a partir de julho/2026):
    /// 12 letras/dígitos + 2 dígitos verificadores. Cada caractere vale seu código ASCII − 48.
    /// </summary>
    public static bool CnpjValido(string cnpj)
    {
        if (!CnpjFormatoRegex().IsMatch(cnpj) || cnpj.Distinct().Count() == 1) return false;

        int Digito(int tamanho)
        {
            var soma = 0;
            for (var i = 0; i < tamanho; i++)
            {
                var peso = (tamanho - 1 - i) % 8 + 2;
                soma += (cnpj[i] - '0') * peso;
            }
            var resto = soma % 11;
            return resto < 2 ? 0 : 11 - resto;
        }

        return Digito(12) == cnpj[12] - '0' && Digito(13) == cnpj[13] - '0';
    }

    private static void Nome(Dictionary<string, string[]> erros, string campo, string? valor,
        string vazio, int maximo, int minimo = 3)
    {
        var nome = valor?.Trim() ?? "";
        if (nome.Length == 0) erros[campo] = [vazio];
        else if (nome.Length < minimo) erros[campo] = [$"Mínimo de {minimo} letras"];
        else if (nome.Length > maximo) erros[campo] = [$"Máximo de {maximo} letras"];
    }

    private static void Email(Dictionary<string, string[]> erros, string campo, string? valor)
    {
        var email = valor?.Trim() ?? "";
        if (email.Length == 0) erros[campo] = ["Digite o e-mail"];
        else if (email.Length > 254 || !EmailRegex().IsMatch(email)) erros[campo] = ["E-mail inválido"];
    }

    private static void Senha(Dictionary<string, string[]> erros, string campo, string? valor)
    {
        var senha = valor ?? "";
        if (senha.Length == 0) erros[campo] = ["Crie uma senha"];
        else if (senha.Length < 8
            || !MaiusculaRegex().IsMatch(senha)
            || !NumeroRegex().IsMatch(senha)
            || !EspecialRegex().IsMatch(senha))
            erros[campo] = ["Faltam requisitos"];
    }
}
