using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Orion.Api.Auth;
using Orion.Api.Clientes;
using Orion.Api.Conta;
using Orion.Api.Data;
using Orion.Api.Empresas;
using Orion.Api.Produtos;
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

// Front-end Vite em desenvolvimento.
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p
    .WithOrigins("http://localhost:5173")
    .AllowAnyHeader()
    .AllowAnyMethod()));

var app = builder.Build();

app.UseCors();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapAuthEndpoints();
app.MapEmpresaEndpoints();
app.MapUsuarioEndpoints();
app.MapContaEndpoints();
app.MapProdutoEndpoints();
app.MapClienteEndpoints();
app.MapWhatsAppEndpoints();

app.Run();
