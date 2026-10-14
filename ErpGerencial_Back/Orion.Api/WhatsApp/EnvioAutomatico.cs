using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Orion.Api.Data;

namespace Orion.Api.WhatsApp;

/// <summary>
/// Envio automático das mensagens de WhatsApp, em segundo plano, dentro da própria API: a cada minuto procura os
/// clientes cujo horário de envio chegou, envia a mensagem (a personalizada do cliente ou a padrão da empresa; com
/// imagem, ela vai como foto e o texto como legenda) pelo número remetente da empresa, grava no histórico
/// (envios_whatsapp) e marca o próximo envio (+ o intervalo do cliente: minutos, horas, dias, semanas ou meses).
///
/// Nunca para (pedido do usuário): sem limite de mensagens por dia; todas as vencidas saem a cada verificação, com
/// uma pausa curta sorteada entre uma e outra (PausaMinSegundos a PausaMaxSegundos, como uma pessoa faria). O
/// intervalo de cada cliente sempre segue contando: mesmo quando um envio dá erro, o próximo já fica marcado. Só o
/// botão "Cancelar envios automáticos" (ou apagar a data no cadastro) para os envios de um cliente.
/// Se a Evolution (WhatsApp) estiver fora do ar, nada se perde: as mensagens saem assim que ela voltar.
/// Modo "teste" (appsettings, EnvioAutomatico:Modo): registra no histórico sem enviar.
/// </summary>
public partial class EnvioAutomatico(IServiceScopeFactory escopos, IConfiguration config, ILogger<EnvioAutomatico> log)
    : BackgroundService
{
    private const string SemRemetente = "Configure o Número remetente em Clientes > Mensagem automática";
    private const string SemMensagem =
        "Sem mensagem: escreva a mensagem padrão (Clientes > Mensagem automática) ou a personalizada do cliente";

    private static readonly TimeZoneInfo Brasilia = TimeZoneInfo.FindSystemTimeZoneById("America/Sao_Paulo");

    private IConfigurationSection Opcoes => config.GetSection("EnvioAutomatico");

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        var segundos = Math.Max(15, Opcoes.GetValue("VerificarACadaSegundos", 60));
        log.LogInformation("Envio automático de WhatsApp ligado (modo {Modo}, verifica a cada {Segundos} segundos).",
            Opcoes["Modo"] ?? "envio", segundos);
        using var relogio = new PeriodicTimer(TimeSpan.FromSeconds(segundos));
        do
        {
            try
            {
                await Verificar(ct);
            }
            catch (Exception erro) when (!ct.IsCancellationRequested)
            {
                // O envio não pode parar por uma falha passageira (banco fora, Evolution reiniciando...).
                log.LogError(erro, "Falha ao verificar os envios automáticos");
            }
        } while (await relogio.WaitForNextTickAsync(ct));
    }

    /// <summary>Um envio vencido: o cliente, a mensagem e o intervalo.</summary>
    private sealed record Pendente(
        Guid ClienteId, string Nome, string Celular, Guid EmpresaId, string Empresa, string? Remetente, string? Modelo,
        bool Personalizada, DateTime EnvioEm, string TipoIntervalo, int? IntervaloQuantidade, string IntervaloUnidade);

    private async Task Verificar(CancellationToken ct)
    {
        using var escopo = escopos.CreateScope();
        var db = escopo.ServiceProvider.GetRequiredService<OrionDbContext>();
        var evolution = escopo.ServiceProvider.GetRequiredService<EvolutionApi>();

        var agora = DateTime.UtcNow;
        var pendentes = await db.Clientes
            .Where(c => c.EnvioEm != null && c.EnvioEm <= agora)
            .OrderBy(c => c.EnvioEm)
            .Select(c => new Pendente(c.Id, c.Nome, c.Celular, c.EmpresaId, c.Empresa!.Nome, c.Empresa.WhatsappRemetente,
                c.MensagemWhatsapp ?? c.Empresa.MensagemManutencao, c.MensagemWhatsapp != null, c.EnvioEm!.Value,
                c.TipoIntervalo, c.IntervaloQuantidade, c.IntervaloUnidade))
            .ToListAsync(ct);
        if (pendentes.Count == 0) return;
        log.LogInformation("{Quantidade} mensagem(ns) com o horário de envio vencido.", pendentes.Count);

        var modoTeste = string.Equals(Opcoes["Modo"], "teste", StringComparison.OrdinalIgnoreCase);
        var pausaMin = Math.Max(0, Opcoes.GetValue("PausaMinSegundos", 3));
        var pausaMax = Math.Max(pausaMin, Opcoes.GetValue("PausaMaxSegundos", 8));

        // Sem número remetente: nem tenta, só registra o motivo (e passa para o próximo envio do cliente).
        foreach (var p in pendentes.Where(p => string.IsNullOrEmpty(p.Remetente)))
            await Registrar(db, p, Montar(p), null, "erro", SemRemetente, ct);

        foreach (var grupo in pendentes.Where(p => !string.IsNullOrEmpty(p.Remetente)).GroupBy(p => p.Remetente!))
        {
            var remetente = grupo.Key;
            // Todas as vencidas deste número, sem limite
            var lista = grupo.ToList();

            if (!modoTeste)
            {
                bool conectado;
                try
                {
                    conectado = await evolution.Conectado(remetente, ct);
                }
                catch (ErroEnvio erro)
                {
                    // Evolution fora do ar (ou ainda subindo): não gasta o envio, tenta de novo na próxima verificação.
                    log.LogWarning("{Motivo}. Tento de novo na próxima verificação.", erro.Message);
                    return;
                }
                if (!conectado)
                {
                    var motivo = $"WhatsApp de {remetente} desconectado: rode 'python lembretes.py conectar {remetente}' na pasta ErpGerencial_Automacao";
                    log.LogError("{Motivo}", motivo);
                    foreach (var p in lista) await Registrar(db, p, Montar(p), null, "erro", motivo, ct);
                    continue;
                }
            }

            for (var i = 0; i < lista.Count; i++)
            {
                var p = lista[i];
                var texto = Montar(p);
                var imagem = await Imagem(db, p, ct);
                if (texto.Length == 0 && imagem is null)
                {
                    await Registrar(db, p, texto, null, "erro", SemMensagem, ct);
                    continue;
                }
                if (modoTeste)
                {
                    log.LogInformation("[modo teste] De +55{Remetente} para +55{Celular}: {Texto}", remetente, p.Celular, texto);
                    await Registrar(db, p, texto, imagem, "teste", null, ct);
                    continue;
                }
                try
                {
                    await evolution.Enviar(remetente, p.Celular, texto, imagem?.Dados, imagem?.TipoConteudo, ct);
                    await Registrar(db, p, texto, imagem, "enviado", null, ct);
                    log.LogInformation("Mensagem automática enviada para {Nome} (+55{Celular}).", p.Nome, p.Celular);
                }
                catch (ErroEnvio erro)
                {
                    await Registrar(db, p, texto, imagem, "erro", erro.Message, ct);
                    log.LogWarning("Mensagem não enviada para {Nome} (+55{Celular}): {Motivo}", p.Nome, p.Celular, erro.Message);
                }
                // Pausa curta sorteada entre uma e outra, como uma pessoa faria (não fica um padrão fixo).
                if (i < lista.Count - 1 && pausaMax > 0)
                    await Task.Delay(TimeSpan.FromSeconds(Random.Shared.Next(pausaMin, pausaMax + 1)), ct);
            }
        }
    }

    /// <summary>A imagem da mensagem personalizada do cliente; sem texto personalizado, vale a da mensagem padrão.</summary>
    private static Task<MensagemImagem?> Imagem(OrionDbContext db, Pendente p, CancellationToken ct) =>
        db.MensagemImagens
            .Where(i => i.ClienteId == p.ClienteId || (!p.Personalizada && i.EmpresaId == p.EmpresaId && i.ClienteId == null))
            .OrderBy(i => i.ClienteId == null)
            .FirstOrDefaultAsync(ct);

    /// <summary>Troca {nome} (primeiro nome do cliente), {data} (dia do envio) e {empresa} no texto digitado no site.</summary>
    private static string Montar(Pendente p)
    {
        var primeiroNome = p.Nome.Split(' ', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault() ?? p.Nome;
        var data = TimeZoneInfo.ConvertTimeFromUtc(p.EnvioEm, Brasilia).ToString("dd/MM/yyyy");
        return Trechos().Replace(p.Modelo ?? "", m => m.Groups[1].Value.ToLowerInvariant() switch
        {
            "nome" => primeiroNome,
            "data" => data,
            _ => p.Empresa,
        }).Trim();
    }

    [GeneratedRegex(@"\{(nome|data|empresa)\}", RegexOptions.IgnoreCase)]
    private static partial Regex Trechos();

    /// <summary>Grava o resultado no histórico e marca o próximo envio do cliente (ou apaga, se era uma vez só).</summary>
    private async Task Registrar(
        OrionDbContext db, Pendente p, string texto, MensagemImagem? imagem, string status, string? erro, CancellationToken ct)
    {
        var mensagem = (imagem is null ? texto : $"[Imagem] {texto}").Trim();
        db.EnviosWhatsapp.Add(new EnvioWhatsapp
        {
            EmpresaId = p.EmpresaId,
            ClienteId = p.ClienteId,
            DataReferencia = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(p.EnvioEm, Brasilia)),
            Tipo = "agendado",
            Telefone = p.Celular,
            Mensagem = mensagem.Length > 1200 ? mensagem[..1200] : mensagem,
            Status = status,
            Erro = erro is { Length: > 500 } ? erro[..500] : erro,
        });
        await db.SaveChangesAsync(ct);

        // Só se a pessoa não tiver mudado o envio enquanto isso.
        var proximo = ProximoEnvio(p.EnvioEm, p.TipoIntervalo, p.IntervaloQuantidade, p.IntervaloUnidade, DateTime.UtcNow);
        await db.Clientes.Where(c => c.Id == p.ClienteId && c.EnvioEm == p.EnvioEm)
            .ExecuteUpdateAsync(s => s.SetProperty(c => c.EnvioEm, proximo), ct);
        if (proximo is { } d)
            log.LogInformation("Próximo envio para {Nome}: {Quando}.", p.Nome,
                TimeZoneInfo.ConvertTimeFromUtc(d, Brasilia).ToString("dd/MM/yyyy HH:mm"));
    }

    /// <summary>
    /// O envio seguinte: o que acabou de sair + o intervalo (minutos, horas, dias, semanas ou meses). Se o envio
    /// atrasou (API parada), pula direto para o próximo que ainda está no futuro (não manda a mesma mensagem várias
    /// vezes seguidas). Data específica (cadastros antigos) ou sem intervalo: null (era uma vez só).
    /// </summary>
    public static DateTime? ProximoEnvio(DateTime envioUtc, string tipo, int? quantidade, string unidade, DateTime agoraUtc)
    {
        if (tipo != "meses" || quantidade is not > 0) return null;
        if (unidade == "meses")
        {
            // Meses pelo calendário, no horário de Brasília (31/01 + 1 mês = último dia de fevereiro)
            var local = TimeZoneInfo.ConvertTimeFromUtc(envioUtc, Brasilia);
            var agoraLocal = TimeZoneInfo.ConvertTimeFromUtc(agoraUtc, Brasilia);
            var vezes = 1;
            while (local.AddMonths(quantidade.Value * vezes) <= agoraLocal) vezes++;
            return TimeZoneInfo.ConvertTimeToUtc(local.AddMonths(quantidade.Value * vezes), Brasilia);
        }
        var passo = unidade switch
        {
            "minutos" => TimeSpan.FromMinutes(quantidade.Value),
            "horas" => TimeSpan.FromHours(quantidade.Value),
            "semanas" => TimeSpan.FromDays(7 * quantidade.Value),
            _ => TimeSpan.FromDays(quantidade.Value),
        };
        var passos = Math.Max(1, (long)Math.Floor((agoraUtc - envioUtc) / passo) + 1);
        return envioUtc + passo * passos;
    }
}
