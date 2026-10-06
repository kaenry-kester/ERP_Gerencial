using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Orion.Api.Auth;
using Orion.Api.Data;
using Orion.Api.Lojas;

var builder = WebApplication.CreateBuilder(args);

// Conexão e chave ficam nos user-secrets (dotnet user-secrets list), fora do Git.
var conexao = builder.Configuration.GetConnectionString("Orion")
    ?? throw new InvalidOperationException("ConnectionStrings:Orion não configurada.");
var chaveJwt = builder.Configuration["Jwt:Chave"]
    ?? throw new InvalidOperationException("Jwt:Chave não configurada.");

builder.Services.AddDbContext<OrionDbContext>(o => o.UseNpgsql(conexao));
builder.Services.AddScoped<IPasswordHasher<Usuario>, PasswordHasher<Usuario>>();
builder.Services.AddScoped<IPasswordHasher<Loja>, PasswordHasher<Loja>>();
builder.Services.AddSingleton<TokenService>();
builder.Services.AddHttpClient();
builder.Services.AddSingleton<GoogleService>();

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        // Mantém os nomes das claims como no token ("sub", "tipo").
        o.MapInboundClaims = false;
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidIssuer = TokenService.Emissor,
            ValidAudience = TokenService.Publico,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(chaveJwt)),
        };
    });

builder.Services.AddAuthorizationBuilder()
    .AddPolicy(Politicas.Usuario, p => p.RequireClaim(TokenService.ClaimTipo, TokenService.TipoUsuario))
    .AddPolicy(Politicas.Loja, p => p.RequireClaim(TokenService.ClaimTipo, TokenService.TipoLoja));

// Até 10 tentativas de login por minuto para cada endereço.
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    o.AddPolicy(Politicas.Login, contexto => RateLimitPartition.GetFixedWindowLimiter(
        contexto.Connection.RemoteIpAddress?.ToString() ?? "desconhecido",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1) }));
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
app.MapLojaEndpoints();

app.Run();
