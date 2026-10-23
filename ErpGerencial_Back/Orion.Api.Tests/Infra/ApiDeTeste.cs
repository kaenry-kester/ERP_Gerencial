using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Npgsql;
using Microsoft.EntityFrameworkCore;
using Orion.Api.Auth;
using Orion.Api.Data;

namespace Orion.Api.Tests.Infra;

/// <summary>
/// A API de verdade, num banco só de testes ("orion_testes", apagado e recriado a cada execução, no mesmo
/// PostgreSQL dos user-secrets). Sem envio automático de WhatsApp nem backup; e-mail e Evolution (WhatsApp) simulados.
/// </summary>
public class ApiDeTeste : WebApplicationFactory<Program>, IAsyncLifetime
{
    public const string BancoDeTestes = "orion_testes";
    /// <summary>Backups feitos pelos testes (nunca na pasta de backups de verdade).</summary>
    public static readonly string PastaBackup = Path.Combine(Path.GetTempPath(), "orion-testes-backup");
    public EmailDeTeste Emails { get; } = new();
    public EvolutionDeTeste Evolution { get; } = new();
    private string _conexao = "";

    public async Task InitializeAsync()
    {
        var configuracao = new ConfigurationBuilder().AddUserSecrets<ApiDeTeste>().AddEnvironmentVariables().Build();
        var original = configuracao.GetConnectionString("Orion")
            ?? throw new InvalidOperationException("ConnectionStrings:Orion não está nos user-secrets da API.");
        var montador = new NpgsqlConnectionStringBuilder(original) { Database = BancoDeTestes };
        _conexao = montador.ConnectionString;
        // O Program.cs lê a conexão logo no começo (antes das configurações do teste): por isso vai por variável
        // de ambiente, que a API lê antes de tudo e que vence os user-secrets.
        Environment.SetEnvironmentVariable("ConnectionStrings__Orion", _conexao);

        // Banco limpo a cada execução (as migrações rodam quando a API sobe)
        var administrativo = new NpgsqlConnectionStringBuilder(original) { Database = "postgres", Pooling = false };
        await using var conexao = new NpgsqlConnection(administrativo.ConnectionString);
        await conexao.OpenAsync();
        await using (var apagar = new NpgsqlCommand($"DROP DATABASE IF EXISTS {BancoDeTestes} WITH (FORCE)", conexao))
            await apagar.ExecuteNonQueryAsync();
        await using (var criar = new NpgsqlCommand($"CREATE DATABASE {BancoDeTestes} ENCODING 'UTF8'", conexao))
            await criar.ExecuteNonQueryAsync();
        _ = Server; // sobe a API (e migra o banco)

        // Trava de segurança: os testes criam e apagam dados; nunca podem rodar no banco de verdade.
        using var escopo = Services.CreateScope();
        var banco = escopo.ServiceProvider.GetRequiredService<OrionDbContext>().Database.GetDbConnection().Database;
        if (banco != BancoDeTestes)
            throw new InvalidOperationException($"Os testes estão ligados ao banco \"{banco}\", não ao \"{BancoDeTestes}\". Parei para não mexer nos seus dados.");
    }

    public new async Task DisposeAsync() => await base.DisposeAsync();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.ConfigureLogging(l => l.SetMinimumLevel(LogLevel.Warning));
        builder.ConfigureAppConfiguration((_, cfg) => cfg.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:Orion"] = _conexao,
            ["Backup:Ativo"] = "false",
            ["Backup:Pasta"] = PastaBackup,
            ["Banco:MigrarAoIniciar"] = "true",
            ["Email:Host"] = "",
        }));
        builder.ConfigureServices(s =>
        {
            // Nada em segundo plano (envio de WhatsApp, backup)
            s.RemoveAll<IHostedService>();
            s.RemoveAll<EmailService>();
            s.AddSingleton<EmailService>(sp => Emails.Com(sp));
            // WhatsApp simulado: nada sai para a Evolution de verdade
            s.AddHttpClient<Orion.Api.WhatsApp.EvolutionApi>().ConfigurePrimaryHttpMessageHandler(() => Evolution);
        });
    }

    /// <summary>Cria uma conta (empresa nova) e devolve um cliente HTTP já logado como o administrador dela.</summary>
    public async Task<ContaDeTeste> NovaConta(string? nomeEmpresa = null)
    {
        var anonimo = CreateClient();
        var email = $"teste.{Guid.NewGuid():N}@exemplo.com";
        var resposta = await anonimo.PostAsJsonAsync("/api/auth/cadastro", new
        {
            nome = "Ana Teste",
            email,
            telefone = $"169{Random.Shared.Next(10000000, 99999999)}",
            nomeEmpresa = nomeEmpresa ?? "Loja Teste",
            senha = ContaDeTeste.Senha,
        });
        Assert.Equal(HttpStatusCode.Created, resposta.StatusCode);
        var sessao = await resposta.Content.ReadFromJsonAsync<JsonElement>();
        var cliente = CreateClient();
        cliente.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", sessao.GetProperty("token").GetString());
        return new ContaDeTeste(cliente, email, sessao);
    }
}

public record ContaDeTeste(HttpClient Http, string Email, JsonElement Sessao)
{
    public const string Senha = "Teste@12345";
    public string UsuarioId => Sessao.GetProperty("usuario").GetProperty("id").GetString()!;
}

/// <summary>Guarda os e-mails "enviados" (para os testes lerem o código).</summary>
public class EmailDeTeste
{
    public ConcurrentDictionary<string, string> UltimoTexto { get; } = new();

    public EmailService Com(IServiceProvider sp) => new Capturador(this, sp);

    /// <summary>O código de 6 dígitos do último e-mail para o endereço.</summary>
    public string Codigo(string para) =>
        Regex.Match(UltimoTexto[para], @"\b(\d{6})\b").Groups[1].Value;

    private class Capturador(EmailDeTeste dono, IServiceProvider sp) : EmailService(
        sp.GetRequiredService<IConfiguration>(), sp.GetRequiredService<IWebHostEnvironment>(),
        sp.GetRequiredService<ILogger<EmailService>>())
    {
        public override Task<bool> Enviar(string para, string assunto, string html, string texto, CancellationToken ct)
        {
            dono.UltimoTexto[para] = texto;
            return Task.FromResult(true);
        }
    }
}

/// <summary>
/// Evolution API (WhatsApp) simulada: guarda as instâncias criadas e o estado de cada uma.
/// O teste muda o estado (ex.: "open" depois de "ler o QR Code").
/// </summary>
public class EvolutionDeTeste : HttpMessageHandler
{
    public System.Collections.Concurrent.ConcurrentDictionary<string, string> Estados { get; } = new();

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        var caminho = request.RequestUri!.AbsolutePath;
        var nome = caminho.Split('/').Last();
        HttpResponseMessage Json(HttpStatusCode codigo, object corpo) => new(codigo) { Content = JsonContent.Create(corpo) };

        if (caminho.StartsWith("/instance/connectionState/"))
            return Estados.TryGetValue(nome, out var estado)
                ? Json(HttpStatusCode.OK, new { instance = new { instanceName = nome, state = estado } })
                : Json(HttpStatusCode.NotFound, new { response = new { message = new[] { "instance does not exist" } } });
        if (caminho == "/instance/create")
        {
            var dados = await request.Content!.ReadFromJsonAsync<JsonElement>(ct);
            Estados[dados.GetProperty("instanceName").GetString()!] = "close";
            return Json(HttpStatusCode.Created, new { instance = new { status = "created" } });
        }
        if (caminho.StartsWith("/instance/connect/"))
        {
            Estados[nome] = "connecting";
            return Json(HttpStatusCode.OK, new { pairingCode = "ABCD1234", code = "2@xyz", base64 = "data:image/png;base64,iVBORw0KGgo=" });
        }
        return Json(HttpStatusCode.NotFound, new { });
    }
}
