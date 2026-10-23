using System.Net.Http.Json;
using System.Text.Json;

namespace Orion.Api.WhatsApp;

/// <summary>
/// A mensagem não saiu (motivo em português, vai para o histórico de envios).
/// Passageiro (o padrão): WhatsApp desconectado, conexão caiu, Evolution fora do ar — a mensagem fica na fila e é
/// tentada de novo. Definitivo: não adianta tentar de novo (ex.: o número do cliente não tem WhatsApp).
/// </summary>
public class ErroEnvio(string mensagem, bool passageiro = true) : Exception(mensagem)
{
    public bool Passageiro { get; } = passageiro;
}

/// <summary>Para conectar um celular: o QR Code (imagem "data:image/png;base64,...") e o código de 8 letras.</summary>
public record ConexaoWhatsapp(string? QrCode, string? Codigo);

/// <summary>
/// Envio pelo WhatsApp através da Evolution API (pasta ErpGerencial_Automacao/evolution-api, roda em localhost:8080).
/// Cada celular que envia é uma "instância" da Evolution com o nome igual ao número (só dígitos, com DDD). O celular é
/// conectado pelo próprio site (Mensagem automática → QR Code), ou por `python lembretes.py conectar &lt;celular&gt;`.
/// Configuração (user-secrets): Evolution:Url (padrão http://localhost:8080) e Evolution:Chave.
/// </summary>
public class EvolutionApi(HttpClient http, IConfiguration config)
{
    private string Url => (config["Evolution:Url"] ?? "http://localhost:8080").TrimEnd('/');

    public bool Configurada => !string.IsNullOrWhiteSpace(config["Evolution:Chave"]);

    /// <summary>Chama a Evolution e devolve (código HTTP, resposta). ErroEnvio se ela não estiver rodando.</summary>
    private async Task<(int Status, JsonElement Corpo)> Chamar(HttpMethod metodo, string caminho, object? dados, CancellationToken ct)
    {
        using var pedido = new HttpRequestMessage(metodo, Url + caminho);
        pedido.Headers.Add("apikey", config["Evolution:Chave"]);
        if (dados is not null) pedido.Content = JsonContent.Create(dados);
        try
        {
            using var resposta = await http.SendAsync(pedido, ct);
            if ((int)resposta.StatusCode == 401) throw new ErroEnvio("A Evolution API recusou a chave: confira Evolution:Chave");
            var texto = await resposta.Content.ReadAsStringAsync(ct);
            JsonElement corpo;
            try
            {
                corpo = string.IsNullOrWhiteSpace(texto) ? default : JsonDocument.Parse(texto).RootElement.Clone();
            }
            catch (JsonException)
            {
                corpo = JsonSerializer.SerializeToElement(new { response = new { message = texto } });
            }
            return ((int)resposta.StatusCode, corpo);
        }
        catch (HttpRequestException)
        {
            throw new ErroEnvio($"A Evolution API (WhatsApp) não está rodando em {Url}");
        }
        catch (TaskCanceledException) when (!ct.IsCancellationRequested)
        {
            throw new ErroEnvio("A Evolution API demorou demais para responder (o celular está conectado?)");
        }
    }

    /// <summary>O celular que envia está conectado ao WhatsApp.</summary>
    public async Task<bool> Conectado(string remetente, CancellationToken ct) => await Estado(remetente, ct) == "open";

    /// <summary>"open" (conectado), "connecting", "close" ou "inexistente" (este celular nunca foi conectado).</summary>
    public async Task<string> Estado(string remetente, CancellationToken ct)
    {
        var (status, corpo) = await Chamar(HttpMethod.Get, $"/instance/connectionState/{Uri.EscapeDataString(remetente)}", null, ct);
        if (status == 404) return "inexistente";
        return status < 300 && corpo.ValueKind == JsonValueKind.Object
            && corpo.TryGetProperty("instance", out var instancia)
            && instancia.TryGetProperty("state", out var estado) && estado.GetString() is { Length: > 0 } e
            ? e
            : "close";
    }

    /// <summary>
    /// Começa a conectar o celular: cria a instância dele (se ainda não existir) e pede um QR Code novo.
    /// O QR muda a cada ~20 segundos; o site chama de novo para mostrar o atual.
    /// </summary>
    public async Task<ConexaoWhatsapp> IniciarConexao(string remetente, CancellationToken ct)
    {
        if (await Estado(remetente, ct) == "inexistente")
        {
            var (criado, resposta) = await Chamar(HttpMethod.Post, "/instance/create",
                new { instanceName = remetente, integration = "WHATSAPP-BAILEYS", qrcode = false }, ct);
            if (criado >= 300) throw new ErroEnvio($"Não foi possível criar a conexão: {Detalhe(resposta)}");
        }
        var (status, corpo) = await Chamar(HttpMethod.Get, $"/instance/connect/{Uri.EscapeDataString(remetente)}?number=55{remetente}", null, ct);
        if (status >= 300) throw new ErroEnvio($"Não foi possível gerar o QR Code: {Detalhe(corpo)}");
        string? Texto(string nome) => corpo.ValueKind == JsonValueKind.Object && corpo.TryGetProperty(nome, out var v)
            && v.ValueKind == JsonValueKind.String && v.GetString() is { Length: > 0 } t ? t : null;
        var qr = Texto("base64");
        return new ConexaoWhatsapp(qr is not null && qr.StartsWith("data:image") ? qr : null, Texto("pairingCode"));
    }

    /// <summary>
    /// Envia para um celular brasileiro (só dígitos, com DDD). Com imagem, ela vai como foto e o texto como legenda.
    /// ErroEnvio se o número não tiver WhatsApp ou o WhatsApp não aceitar.
    /// </summary>
    public async Task Enviar(string remetente, string destino, string texto, byte[]? imagem, string? tipoImagem, CancellationToken ct)
    {
        var instancia = Uri.EscapeDataString(remetente);

        // Confere se o número tem WhatsApp (a Evolution também acerta o nono dígito dos celulares).
        var (status, corpo) = await Chamar(HttpMethod.Post, $"/chat/whatsappNumbers/{instancia}", new { numbers = new[] { $"55{destino}" } }, ct);
        if (status >= 300) throw new ErroEnvio($"Não foi possível conferir o número: {Detalhe(corpo)}");
        var numero = corpo.ValueKind == JsonValueKind.Array && corpo.GetArrayLength() > 0 ? corpo[0] : default;
        if (numero.ValueKind != JsonValueKind.Object || !numero.TryGetProperty("exists", out var existe) || !existe.GetBoolean())
            throw new ErroEnvio("Este celular não tem WhatsApp ou o número está errado", passageiro: false);
        var para = numero.TryGetProperty("jid", out var jid) && jid.GetString() is { Length: > 0 } j ? j : $"55{destino}";

        // "delay": mostra "digitando..." por um instante antes de enviar, como uma pessoa faria.
        (status, corpo) = imagem is { Length: > 0 }
            ? await Chamar(HttpMethod.Post, $"/message/sendMedia/{instancia}", new
            {
                number = para,
                mediatype = "image",
                mimetype = tipoImagem ?? "image/jpeg",
                caption = texto,
                media = Convert.ToBase64String(imagem),
                fileName = tipoImagem switch { "image/png" => "imagem.png", "image/webp" => "imagem.webp", _ => "imagem.jpg" },
                delay = 1500,
            }, ct)
            : await Chamar(HttpMethod.Post, $"/message/sendText/{instancia}", new { number = para, text = texto, delay = 1500 }, ct);

        var aceita = corpo.ValueKind == JsonValueKind.Object && corpo.TryGetProperty("key", out var chave)
            && chave.TryGetProperty("id", out var id) && !string.IsNullOrEmpty(id.GetString());
        if (status >= 300 || !aceita) throw new ErroEnvio($"O WhatsApp não aceitou a mensagem: {Detalhe(corpo)}");
    }

    /// <summary>Tira a mensagem de erro da resposta da Evolution ({"response": {"message": [...]}}).</summary>
    private static string Detalhe(JsonElement corpo)
    {
        if (corpo.ValueKind == JsonValueKind.Object && corpo.TryGetProperty("response", out var r)
            && r.ValueKind == JsonValueKind.Object && r.TryGetProperty("message", out var m))
            return m.ValueKind == JsonValueKind.Array ? string.Join("; ", m.EnumerateArray().Select(x => x.ToString())) : m.ToString();
        return corpo.ValueKind == JsonValueKind.Undefined ? "sem resposta" : corpo.ToString();
    }
}
