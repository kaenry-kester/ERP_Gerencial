using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Orion.Api.Auth;
using Orion.Api.Data;

var builder = WebApplication.CreateBuilder(args);

// Conexão e chave ficam nos user-secrets (dotnet user-secrets list), fora do Git.
var conexao = builder.Configuration.GetConnectionString("Orion")
    ?? throw new InvalidOperationException("ConnectionStrings:Orion não configurada.");
var chaveJwt = builder.Configuration["Jwt:Chave"]
    ?? throw new InvalidOperationException("Jwt:Chave não configurada.");

builder.Services.AddDbContext<OrionDbContext>(o => o.UseNpgsql(conexao));
builder.Services.AddScoped<IPasswordHasher<Usuario>, PasswordHasher<Usuario>>();
builder.Services.AddSingleton<TokenService>();

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o => o.TokenValidationParameters = new TokenValidationParameters
    {
        ValidIssuer = TokenService.Emissor,
        ValidAudience = TokenService.Publico,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(chaveJwt)),
    });
builder.Services.AddAuthorization();

// Front-end Vite em desenvolvimento.
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p
    .WithOrigins("http://localhost:5173")
    .AllowAnyHeader()
    .AllowAnyMethod()));

var app = builder.Build();

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

app.MapAuthEndpoints();

app.Run();
