using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using Orion.Api.Data;

namespace Orion.Api.Auth;

public class TokenService(IConfiguration config)
{
    public const string Emissor = "orion-api";
    public const string Publico = "orion-front";

    private readonly SigningCredentials _credenciais = new(
        new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["Jwt:Chave"]!)),
        SecurityAlgorithms.HmacSha256);

    public string Gerar(Usuario usuario) =>
        new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Issuer = Emissor,
            Audience = Publico,
            Subject = new ClaimsIdentity(
            [
                new Claim(JwtRegisteredClaimNames.Sub, usuario.Id.ToString()),
                new Claim(JwtRegisteredClaimNames.Name, usuario.Nome),
                new Claim(JwtRegisteredClaimNames.Email, usuario.Email),
            ]),
            Expires = DateTime.UtcNow.AddHours(8),
            SigningCredentials = _credenciais,
        });
}
