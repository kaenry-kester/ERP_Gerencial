using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Orion.Api.Auth;
using Orion.Api.Clientes;
using Orion.Api.Conta;
using Orion.Api.Cupons;
using Orion.Api.Data;
using Orion.Api.Empresas;
using Orion.Api.Financeiro;
using Orion.Api.Historico;
using Orion.Api.Produtos;
using Orion.Api.Sistema;
using Orion.Api.Usuarios;
using Orion.Api.WhatsApp;

var builder = WebApplication.CreateBuilder(args);

// Conexão e chave ficam nos user-secrets (dotnet user-secrets list), fora do Git.
var conexao = builder.Configuration.GetConnectionString("Orion")
    ?? throw new InvalidOperationException("ConnectionStrings:Orion não configurada.");
var chaveJwt = builder.Configuration["Jwt:Chave"]
    ?? throw new InvalidOperationException("Jwt:Chave não configurada.");

builder.Services.AddDbContext<OrionDbContext>(o => o.UseNpgsql(conexao));
builder.Services.AddScoped<IPasswordHasher<Usuario>, PasswordHasher<Usuario>>();
builder.Services.AddSingleton<TokenService>();
builder.Services.AddSingleton<EmailService>();
// Envio automático das mensagens de WhatsApp: roda em segundo plano dentro da API (ver WhatsApp/EnvioAutomatico.cs).
builder.Services.AddHttpClient<EvolutionApi>(c => c.Timeout = TimeSpan.FromSeconds(120));
builder.Services.AddHostedService<EnvioAutomatico>();
// Backup diário do banco com o pg_dump (ver Sistema/BackupAutomatico.cs; desliga com Backup:Ativo = false).
builder.Services.AddSingleton<BackupAutomatico>();
builder.Services.AddHostedService(s => s.GetRequiredService<BackupAutomatico>());
// Erro inesperado: resposta padrão (sem detalhes internos fora do desenvolvimento).
builder.Services.AddProblemDetails();
// Um erro inesperado no envio nunca derruba a API (e o envio segue na verificação seguinte).
builder.Services.Configure<HostOptions>(o => o.BackgroundServiceExceptionBehavior = BackgroundServiceExceptionBehavior.Ignore);

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        // Mantém os nomes das claims como no token ("sub").
        o.MapInboundClaims = false;
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidIssuer = TokenService.Emissor,
            ValidAudience = TokenService.Publico,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(chaveJwt)),
        };
    });

// Empresa, administrador e permissões são conferidos no banco em cada rota (UsuarioAtual).
builder.Services.AddAuthorization();

// Até 10 tentativas de login por minuto para cada endereço.
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    o.AddPolicy(Politicas.Login, contexto => RateLimitPartition.GetFixedWindowLimiter(
        contexto.Connection.RemoteIpAddress?.ToString() ?? "desconhecido",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1) }));
    // Código por e-mail: até 20 conferências/reenvios por minuto por endereço
    // (cada código também só aceita 5 tentativas erradas).
    o.AddPolicy(Politicas.Codigo, contexto => RateLimitPartition.GetFixedWindowLimiter(
        contexto.Connection.RemoteIpAddress?.ToString() ?? "desconhecido",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 20, Window = TimeSpan.FromMinutes(1) }));
    // Minha conta (trocar senha/e-mail, excluir): já exige estar logado; até 15 por minuto.
    o.AddPolicy(Politicas.Conta, contexto => RateLimitPartition.GetFixedWindowLimiter(
        contexto.Connection.RemoteIpAddress?.ToString() ?? "desconhecido",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 15, Window = TimeSpan.FromMinutes(1) }));
});

// Endereços do site que podem chamar a API (Cors:Origens; padrão: o Vite em desenvolvimento).
var origens = builder.Configuration.GetSection("Cors:Origens").Get<string[]>() is { Length: > 0 } lista
    ? lista
    : ["http://localhost:5173"];
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p
    .WithOrigins(origens)
    .AllowAnyHeader()
    .AllowAnyMethod()));

// Atrás de um proxy (Nginx, IIS, Caddy): usa o IP e o https do cliente, não os do proxy.
builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    o.KnownIPNetworks.Clear();
    o.KnownProxies.Clear();
});

var app = builder.Build();

// O banco se atualiza sozinho ao iniciar (aplica as migrações que faltam). Desliga com Banco:MigrarAoIniciar = false.
if (app.Configuration.GetValue("Banco:MigrarAoIniciar", true))
{
    using var escopo = app.Services.CreateScope();
    escopo.ServiceProvider.GetRequiredService<OrionDbContext>().Database.Migrate();
}

app.UseForwardedHeaders();
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler();
    // No programa instalado na loja (Https:Ativo = false) o acesso é http://localhost ou pela rede da loja
    if (app.Configuration.GetValue("Https:Ativo", true))
    {
        app.UseHsts();
        app.UseHttpsRedirection();
    }
}
app.UseStatusCodePages();

// Site já compilado (npm run build:api coloca em wwwroot): a API serve o site no mesmo endereço.
app.UseDefaultFiles();
app.UseStaticFiles();

app.UseCors();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapAuthEndpoints();
app.MapEmpresaEndpoints();
app.MapUsuarioEndpoints();
app.MapContaEndpoints();
app.MapProdutoEndpoints();
app.MapProdutoImagemEndpoints();
app.MapClienteEndpoints();
app.MapWhatsAppEndpoints();
app.MapCupomEndpoints();
app.MapEstoqueEndpoints();
app.MapSistemaEndpoints();

// Saúde: a API está no ar e fala com o banco (para monitoramento e para conferir depois de instalar).
app.MapGet("/api/saude", async (OrionDbContext db, CancellationToken ct) =>
    await db.Database.CanConnectAsync(ct)
        ? Results.Ok(new { status = "ok", banco = "conectado", hora = DateTime.UtcNow })
        : Results.Json(new { status = "erro", banco = "sem conexão" }, statusCode: StatusCodes.Status503ServiceUnavailable));

// Rotas do site (ex.: /app/produtos) abrem o index.html; as da API continuam respondendo 404 quando não existem.
app.MapFallbackToFile("index.html");
app.MapFallback("/api/{**resto}", () => Results.NotFound());
app.MapFinanceiroEndpoints();
app.MapHistoricoEndpoints();

app.Run();

// Visível para os testes (WebApplicationFactory<Program>).
public partial class Program;
