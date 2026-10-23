using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Orion.Api.Tests.Infra;

/// <summary>Uma API de teste para todas as classes (o banco é recriado uma vez por execução).</summary>
[CollectionDefinition("api")]
public class ColecaoApi : ICollectionFixture<ApiDeTeste>;

public record Resposta(HttpStatusCode Status, JsonElement Json)
{
    public override string ToString() => $"{(int)Status} {Json}";

    public JsonElement this[string campo] => Json.GetProperty(campo);
    public decimal Decimal(string campo) => Json.GetProperty(campo).GetDecimal();
    public string? Texto(string campo) => Json.GetProperty(campo).ValueKind == JsonValueKind.Null ? null : Json.GetProperty(campo).GetString();
}

public static class Http
{
    private static async Task<Resposta> Ler(HttpResponseMessage r)
    {
        var texto = await r.Content.ReadAsStringAsync();
        var json = string.IsNullOrWhiteSpace(texto) ? default : JsonDocument.Parse(texto).RootElement.Clone();
        return new Resposta(r.StatusCode, json);
    }

    public static async Task<Resposta> Get(this HttpClient http, string rota) => await Ler(await http.GetAsync(rota));
    public static async Task<Resposta> Post(this HttpClient http, string rota, object? corpo = null) =>
        await Ler(await http.PostAsJsonAsync(rota, corpo ?? new { }));
    public static async Task<Resposta> Put(this HttpClient http, string rota, object corpo) =>
        await Ler(await http.PutAsJsonAsync(rota, corpo));

    /// <summary>Produto simples com estoque, para vender.</summary>
    public static async Task<Resposta> NovoProduto(this HttpClient http, string nome, decimal preco, decimal quantidade,
        decimal custo = 0, string? codigoBarras = null, decimal estoqueMinimo = 0)
    {
        var r = await http.Post("/api/produtos", new
        {
            nome, codigo = $"P{Random.Shared.Next(1000, 999999)}", codigoBarras, precoCusto = custo, precoVendaPf = preco,
            precoVendaPj = preco, quantidade, estoqueMinimo,
        });
        Assert.Equal(HttpStatusCode.Created, r.Status);
        return r;
    }

    public static async Task<Resposta> Vender(this HttpClient http, object corpo) => await http.Post("/api/cupons", corpo);
}
