using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using Orion.Api.Data;

namespace Orion.Api.Auth;

/// <summary>
/// Dois tipos de acesso: a conta da pessoa (vê e cria lojas) e a loja
/// (entra com CNPJ e senha e trabalha dentro dela). A claim "tipo" separa os dois.
/// </summary>
public class TokenService(IConfiguration config)
{
    public const string Emissor = "orion-api";
    public const string Publico = "orion-front";

    public const string ClaimTipo = "tipo";
    public const string TipoUsuario = "usuario";
    public const string TipoLoja = "loja";

    private readonly SigningCredentials _credenciais = new(
        new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Chave"]!)),
        SecurityAlgorithms.HmacSha256);

    public string GerarUsuario(Usuario usuario) => Gerar(TipoUsuario,
    [
        new Claim(JwtRegisteredClaimNames.Sub, usuario.Id.ToString()),
        new Claim(JwtRegisteredClaimNames.Name, usuario.Nome),
        new Claim(JwtRegisteredClaimNames.Email, usuario.Email),
    ]);

    public string GerarLoja(Loja loja) => Gerar(TipoLoja,
    [
        new Claim(JwtRegisteredClaimNames.Sub, loja.Id.ToString()),
        new Claim(JwtRegisteredClaimNames.Name, loja.NomeFantasia),
    ]);

    private string Gerar(string tipo, Claim[] claims) =>
        new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Issuer = Emissor,
            Audience = Publico,
            Subject = new ClaimsIdentity([.. claims, new Claim(ClaimTipo, tipo)]),
            Expires = DateTime.UtcNow.AddHours(8),
            SigningCredentials = _credenciais,
        });

    /// <summary>Id (usuário ou loja) do token da requisição.</summary>
    public static Guid IdDe(ClaimsPrincipal principal) =>
        Guid.Parse(principal.FindFirstValue(JwtRegisteredClaimNames.Sub)!);
}
