using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using Orion.Api.Data;

namespace Orion.Api.Auth;

/// <summary>
/// Token de acesso da pessoa. Leva só a identidade; empresa, administrador e permissões
/// são lidos do banco a cada requisição (UsuarioAtual), para mudanças valerem na hora.
/// </summary>
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

    /// <summary>Id do usuário do token da requisição (null se o token não tiver um id válido).</summary>
    public static Guid? IdDe(ClaimsPrincipal principal) =>
        Guid.TryParse(principal.FindFirstValue(JwtRegisteredClaimNames.Sub), out var id) ? id : null;
}
