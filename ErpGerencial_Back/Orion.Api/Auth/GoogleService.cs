using System.Text.Json.Serialization;
using Google.Apis.Auth;

namespace Orion.Api.Auth;

/// <summary>
/// Login com o Google pelo fluxo de "código de autorização" (janela popup do Google):
/// o front recebe um código, a API troca o código pelo id_token direto com o Google
/// (usando o Client Secret) e confere a assinatura e o público do token.
///
/// Configuração (user-secrets): Google:ClientId e Google:ClientSecret.
/// </summary>
public class GoogleService(IHttpClientFactory http, IConfiguration config, ILogger<GoogleService> log)
{
    private const string UrlToken = "https://oauth2.googleapis.com/token";

    public string? ClientId => config["Google:ClientId"];
    private string? ClientSecret => config["Google:ClientSecret"];

    public bool Configurado => !string.IsNullOrWhiteSpace(ClientId) && !string.IsNullOrWhiteSpace(ClientSecret);

    /// <summary>Dados da conta Google, ou null se o código for inválido ou vencido.</summary>
    public async Task<GoogleJsonWebSignature.Payload?> ValidarCodigo(string codigo, CancellationToken ct)
    {
        using var resposta = await http.CreateClient().PostAsync(UrlToken, new FormUrlEncodedContent(
            new Dictionary<string, string>
            {
                ["code"] = codigo,
                ["client_id"] = ClientId!,
                ["client_secret"] = ClientSecret!,
                // Valor fixo do fluxo em popup do Google Identity Services.
                ["redirect_uri"] = "postmessage",
                ["grant_type"] = "authorization_code",
            }), ct);

        if (!resposta.IsSuccessStatusCode)
        {
            log.LogWarning("Google recusou o código: {Status} {Corpo}",
                (int)resposta.StatusCode, await resposta.Content.ReadAsStringAsync(ct));
            return null;
        }

        var tokens = await resposta.Content.ReadFromJsonAsync<RespostaToken>(ct);
        if (string.IsNullOrEmpty(tokens?.IdToken)) return null;

        try
        {
            return await GoogleJsonWebSignature.ValidateAsync(tokens.IdToken,
                new GoogleJsonWebSignature.ValidationSettings { Audience = [ClientId!] });
        }
        catch (InvalidJwtException ex)
        {
            log.LogWarning(ex, "id_token do Google inválido");
            return null;
        }
    }

    private sealed record RespostaToken([property: JsonPropertyName("id_token")] string? IdToken);
}
