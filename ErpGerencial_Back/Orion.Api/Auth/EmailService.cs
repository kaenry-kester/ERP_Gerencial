using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace Orion.Api.Auth;

/// <summary>
/// Envio de e-mails por SMTP (Gmail com senha de app, Outlook, Brevo...).
/// Configuração (user-secrets): Email:Host, Email:Porta (587), Email:Usuario, Email:Senha,
/// Email:Remetente (ex.: "Órion &lt;nao-responda@suaempresa.com&gt;").
///
/// Sem SMTP configurado, em desenvolvimento o e-mail não sai: o conteúdo aparece no terminal da API,
/// para dar para testar. Em produção, sem SMTP, o envio falha (e o login avisa).
/// </summary>
public class EmailService(IConfiguration config, IWebHostEnvironment ambiente, ILogger<EmailService> log)
{
    private string? Host => config["Email:Host"];

    /// <summary>Pronto para enviar: tem o servidor e, se tem usuário, também a senha (de app).</summary>
    public bool Configurado =>
        !string.IsNullOrWhiteSpace(Host)
        && (string.IsNullOrWhiteSpace(config["Email:Usuario"]) || !string.IsNullOrWhiteSpace(config["Email:Senha"]));

    /// <summary>True quando o e-mail foi entregue ao servidor SMTP (ou mostrado no terminal, em desenvolvimento).</summary>
    public async Task<bool> Enviar(string para, string assunto, string html, string texto, CancellationToken ct)
    {
        if (!Configurado)
        {
            if (!ambiente.IsDevelopment())
            {
                log.LogError("E-mail não enviado: SMTP não configurado (Email:Host).");
                return false;
            }
            log.LogWarning("[DESENVOLVIMENTO] SMTP não configurado; e-mail para {Para}:\n{Assunto}\n{Texto}", para, assunto, texto);
            return true;
        }

        var mensagem = new MimeMessage();
        mensagem.From.Add(MailboxAddress.Parse(config["Email:Remetente"] ?? config["Email:Usuario"]!));
        mensagem.To.Add(MailboxAddress.Parse(para));
        mensagem.Subject = assunto;
        mensagem.Body = new BodyBuilder { HtmlBody = html, TextBody = texto }.ToMessageBody();

        try
        {
            using var smtp = new SmtpClient();
            var porta = int.TryParse(config["Email:Porta"], out var p) ? p : 587;
            await smtp.ConnectAsync(Host!, porta, porta == 465 ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls, ct);
            if (config["Email:Usuario"] is { Length: > 0 } usuario)
                await smtp.AuthenticateAsync(usuario, config["Email:Senha"] ?? "", ct);
            await smtp.SendAsync(mensagem, ct);
            await smtp.DisconnectAsync(true, ct);
            return true;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            log.LogError(ex, "Falha ao enviar e-mail para {Para}", para);
            return false;
        }
    }
}
