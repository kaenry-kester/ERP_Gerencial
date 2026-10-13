using System.Net.Http.Json;
using System.Text.Json;

namespace Orion.Api.WhatsApp;

/// <summary>
/// Envio de mensagens pelo WhatsApp do número remetente da empresa, pela Evolution API
/// (a mesma que o robô de mensagens automáticas usa; cada número é uma "instância" com o nome igual aos dígitos).
/// Configuração (user-secrets): Evolution:Url (padrão http://localhost:8080) e Evolution:Chave.
/// </summary>
public class WhatsAppService(HttpClient http, IConfiguration config, ILogger<WhatsAppService> log)
{
    /// <summary>
    /// True quando a mensagem foi aceita pelo WhatsApp. False se a Evolution estiver fora do ar, o número remetente
    /// não estiver conectado ou o destino não tiver WhatsApp (o motivo vai para o log).
    /// </summary>
    public async Task<bool> Enviar(string remetente, string destino, string texto, CancellationToken ct)
    {
        var chave = config["Evolution:Chave"];
        if (string.IsNullOrWhiteSpace(chave))
        {
            log.LogError("WhatsApp não enviado: Evolution:Chave não configurada.");
            return false;
        }
        var url = (config["Evolution:Url"] ?? "http://localhost:8080").TrimEnd('/');
        var instancia = Uri.EscapeDataString(remetente);

        try
        {
            using var estado = await Pedir(HttpMethod.Get, $"{url}/instance/connectionState/{instancia}", chave, null, ct);
            if (!estado.IsSuccessStatusCode
                || (await estado.Content.ReadFromJsonAsync<JsonElement>(ct)).GetProperty("instance").GetProperty("state").GetString() != "open")
            {
                log.LogWarning("WhatsApp não enviado: o número remetente {Remetente} não está conectado.", remetente);
                return false;
            }

            // Confere se o destino tem WhatsApp (a Evolution também acerta o nono dígito dos celulares).
            using var numeros = await Pedir(HttpMethod.Post, $"{url}/chat/whatsappNumbers/{instancia}", chave,
                new { numbers = new[] { $"55{destino}" } }, ct);
            var numero = numeros.IsSuccessStatusCode
                ? (await numeros.Content.ReadFromJsonAsync<JsonElement>(ct)).EnumerateArray().FirstOrDefault()
                : default;
            if (numero.ValueKind != JsonValueKind.Object || !numero.GetProperty("exists").GetBoolean())
            {
                log.LogWarning("WhatsApp não enviado: {Destino} não tem WhatsApp.", destino);
                return false;
            }

            using var envio = await Pedir(HttpMethod.Post, $"{url}/message/sendText/{instancia}", chave,
                new { number = numero.GetProperty("jid").GetString(), text = texto }, ct);
            if (!envio.IsSuccessStatusCode)
            {
                log.LogWarning("WhatsApp não enviado: a Evolution respondeu {Status}.", (int)envio.StatusCode);
                return false;
            }
            return true;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException
                                       or KeyNotFoundException or InvalidOperationException)
        {
            if (ct.IsCancellationRequested) throw;
            log.LogError(ex, "WhatsApp não enviado: falha ao falar com a Evolution API em {Url}.", url);
            return false;
        }
    }

    private Task<HttpResponseMessage> Pedir(HttpMethod metodo, string url, string chave, object? corpo, CancellationToken ct)
    {
        var pedido = new HttpRequestMessage(metodo, url) { Content = corpo is null ? null : JsonContent.Create(corpo) };
        pedido.Headers.Add("apikey", chave);
        return http.SendAsync(pedido, ct);
    }
}
