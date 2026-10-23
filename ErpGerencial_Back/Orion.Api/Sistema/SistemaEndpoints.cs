using System.Net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Orion.Api.Auth;
using Orion.Api.Data;

namespace Orion.Api.Sistema;

/// <summary>Senha nova de uma conta, trocada pelo atalho "Esqueci a senha" no computador da loja.</summary>
public record RedefinirSenhaLocalRequest(string? Email, string? NovaSenha);

/// <summary>
/// Rotas do programa instalado na loja: a situação das cópias de segurança (aviso na tela inicial), o
/// "desligar com segurança" usado pelo "Parar Órion" (faz a última cópia antes de fechar) e a troca de senha
/// pelo próprio computador (não há e-mail de recuperação). As duas últimas só existem com
/// Sistema:PermitirDesligar = true e só atendem pedidos do próprio computador.
/// </summary>
public static class SistemaEndpoints
{
    public static void MapSistemaEndpoints(this WebApplication app)
    {
        app.MapGet("/api/sistema/backup", [Authorize] (BackupAutomatico backup) => Results.Ok(backup.Situacao()));

        // Só com Sistema:PermitirDesligar = true (programa da loja) e só pedido do próprio computador.
        app.MapPost("/api/sistema/desligar", (HttpContext contexto, IConfiguration config, IHostApplicationLifetime vida) =>
        {
            var ip = contexto.Connection.RemoteIpAddress;
            if (!config.GetValue("Sistema:PermitirDesligar", false) || ip is null || !IPAddress.IsLoopback(ip))
                return Results.NotFound();
            // Responde antes e desliga logo depois (o backup "ao fechar" roda no desligamento)
            _ = Task.Run(async () =>
            {
                await Task.Delay(300);
                vida.StopApplication();
            });
            return Results.Ok(new { desligando = true });
        });

        // "Esqueci a senha" (atalho na pasta do programa): quem tem o computador da loja na mão troca a senha
        app.MapPost("/api/sistema/redefinir-senha", async (
            RedefinirSenhaLocalRequest req, HttpContext contexto, IConfiguration config, OrionDbContext db,
            IPasswordHasher<Usuario> hasher) =>
        {
            var ip = contexto.Connection.RemoteIpAddress;
            if (!config.GetValue("Sistema:PermitirDesligar", false) || ip is null || !IPAddress.IsLoopback(ip))
                return Results.NotFound();
            var erros = new Dictionary<string, string[]>();
            Validacao.Senha(erros, "novaSenha", req.NovaSenha);
            if (erros.Count > 0) return Results.ValidationProblem(erros);
            var email = req.Email?.Trim().ToLowerInvariant() ?? "";
            var usuario = await db.Usuarios.SingleOrDefaultAsync(u => u.Email == email);
            if (usuario is null) return Results.NotFound(new { erro = "Não existe conta com este e-mail" });
            usuario.SenhaHash = hasher.HashPassword(usuario, req.NovaSenha!);
            usuario.Ativo = true;
            await db.SaveChangesAsync();
            return Results.Ok(new { trocada = true, usuario.Nome });
        });
    }
}
