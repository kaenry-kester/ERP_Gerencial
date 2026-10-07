using System.Net;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Orion.Api.Data;

namespace Orion.Api.Auth;

/// <summary>Resposta do login quando falta o código: a tela pede os 6 dígitos enviados por e-mail.</summary>
public record VerificacaoResponse(Guid DesafioId, string Email, DateTime ExpiraEm, int ReenviarEmSegundos);

/// <summary>Login concluído; Dispositivo vem preenchido quando a pessoa marcou "Lembrar de quem sou".</summary>
public record LoginVerificadoResponse(string Token, UsuarioDto Usuario, EmpresaResumo? Empresa, string? Dispositivo);

/// <summary>
/// Verificação em duas etapas por e-mail: senha certa → código de 6 dígitos no e-mail → login.
/// "Lembrar de quem sou" guarda um token no navegador que dispensa o código por 30 dias.
/// </summary>
public static class VerificacaoLogin
{
    public static readonly TimeSpan ValidadeCodigo = TimeSpan.FromMinutes(10);
    public static readonly TimeSpan IntervaloReenvio = TimeSpan.FromSeconds(60);
    public static readonly TimeSpan ValidadeDispositivo = TimeSpan.FromDays(30);
    public const int MaximoTentativas = 5;

    public static string Hash(string valor) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(valor)));

    private static string HashCodigo(Guid desafioId, string codigo) => Hash($"{desafioId}:{codigo}");

    /// <summary>Compara o código digitado com o hash guardado, em tempo constante.</summary>
    public static bool CodigoConfere(CodigoLogin desafio, string codigo) =>
        CryptographicOperations.FixedTimeEquals(
            Encoding.ASCII.GetBytes(HashCodigo(desafio.Id, codigo.Trim())),
            Encoding.ASCII.GetBytes(desafio.CodigoHash));

    /// <summary>"ana.souza@gmail.com" → "an•••••••@gmail.com"</summary>
    public static string MascararEmail(string email)
    {
        var arroba = email.IndexOf('@');
        if (arroba <= 0) return email;
        var visivel = Math.Min(2, arroba);
        return email[..visivel] + new string('•', Math.Max(3, arroba - visivel)) + email[arroba..];
    }

    /// <summary>
    /// Cria (ou renova) o desafio, gera um código novo e envia por e-mail.
    /// Com novoEmail (troca de e-mail), o código vai para o e-mail novo.
    /// </summary>
    public static async Task<VerificacaoResponse?> EnviarCodigo(
        OrionDbContext db, EmailService email, Usuario usuario, CodigoLogin? existente, CancellationToken ct,
        string? novoEmail = null)
    {
        var desafio = existente ?? new CodigoLogin { UsuarioId = usuario.Id, CodigoHash = "", NovoEmail = novoEmail };
        var destino = desafio.NovoEmail ?? usuario.Email;
        var codigo = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
        desafio.CodigoHash = HashCodigo(desafio.Id, codigo);
        desafio.ExpiraEm = DateTime.UtcNow + ValidadeCodigo;
        desafio.EnviadoEm = DateTime.UtcNow;
        desafio.Tentativas = 0;
        if (existente is null) db.CodigosLogin.Add(desafio);

        var trocaDeEmail = desafio.NovoEmail is not null;
        var (html, texto) = MensagemCodigo(usuario.Nome, codigo, trocaDeEmail);
        var assunto = trocaDeEmail
            ? $"{codigo} é o código para confirmar seu novo e-mail no Órion"
            : $"{codigo} é o seu código de acesso ao Órion";
        if (!await email.Enviar(destino, assunto, html, texto, ct))
            return null;

        await db.SaveChangesAsync(ct);
        return new VerificacaoResponse(desafio.Id, MascararEmail(destino), desafio.ExpiraEm,
            (int)IntervaloReenvio.TotalSeconds);
    }

    /// <summary>O token do navegador é um dispositivo lembrado (e ainda válido) desta pessoa?</summary>
    public static async Task<bool> DispositivoLembrado(OrionDbContext db, Usuario usuario, string? token, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(token) || token.Length > 200) return false;
        var hash = Hash(token);
        var dispositivo = await db.DispositivosConfiaveis
            .SingleOrDefaultAsync(d => d.TokenHash == hash && d.UsuarioId == usuario.Id, ct);
        if (dispositivo is null || dispositivo.ExpiraEm < DateTime.UtcNow) return false;

        dispositivo.UltimoUsoEm = DateTime.UtcNow;
        return true;
    }

    /// <summary>Marca este navegador como lembrado; devolve o token (só ele fica com o navegador).</summary>
    public static string LembrarDispositivo(OrionDbContext db, Usuario usuario, string? userAgent)
    {
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        db.DispositivosConfiaveis.Add(new DispositivoConfiavel
        {
            UsuarioId = usuario.Id,
            TokenHash = Hash(token),
            Descricao = userAgent is { Length: > 300 } ? userAgent[..300] : userAgent,
            ExpiraEm = DateTime.UtcNow + ValidadeDispositivo,
        });
        return token;
    }

    private static (string Html, string Texto) MensagemCodigo(string nome, string codigo, bool trocaDeEmail)
    {
        var primeiroNome = WebUtility.HtmlEncode(nome.Split(' ')[0]);
        var minutos = (int)ValidadeCodigo.TotalMinutes;
        var acao = trocaDeEmail ? "confirmar este e-mail como seu novo login no Órion" : "entrar no Órion";
        var alerta = trocaDeEmail
            ? "Se você não pediu esta troca, ignore este e-mail."
            : "Se não foi você que tentou entrar, troque sua senha.";
        var texto = $"""
            Olá, {nome.Split(' ')[0]}!

            Use este código para {acao}: {codigo}

            Ele vale por {minutos} minutos. {alerta}
            """;
        var html = $"""
            <div style="font-family:Segoe UI,Verdana,sans-serif;background:#eef1f3;padding:32px 16px;color:#11161a">
              <div style="max-width:480px;margin:0 auto;background:#f8f8f8;border-radius:8px;overflow:hidden">
                <div style="background:#0b0a09;padding:20px 28px;color:#f8f8f8;font-size:22px;font-weight:700;letter-spacing:1px">ÓRION</div>
                <div style="padding:28px">
                  <p style="margin:0 0 12px;font-size:17px">Olá, {primeiroNome}!</p>
                  <p style="margin:0 0 20px;font-size:16px;line-height:1.5">Use este código para {acao}:</p>
                  <p style="margin:0 0 20px;font-size:36px;font-weight:700;letter-spacing:10px;color:#145369">{codigo}</p>
                  <p style="margin:0;font-size:14px;line-height:1.5;color:#4a5560">Ele vale por {minutos} minutos.
                  {alerta}</p>
                </div>
              </div>
            </div>
            """;
        return (html, texto);
    }
}
