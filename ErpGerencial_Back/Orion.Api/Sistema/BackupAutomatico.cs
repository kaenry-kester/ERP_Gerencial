using System.Diagnostics;
using Npgsql;

namespace Orion.Api.Sistema;

/// <summary>Situação das cópias de segurança (aviso na tela inicial quando a última estiver velha).</summary>
public record SituacaoBackup(bool Ativo, string Pasta, DateTime? Ultima);

/// <summary>
/// Backup automático do banco com o pg_dump, numa pasta escolhida — de preferência uma pasta do Google Drive ou
/// OneDrive, para a cópia ir para a nuvem.
///   - Sem IntervaloMinutos: uma vez por dia (no horário configurado, ou logo ao iniciar se o de hoje não foi feito).
///   - Com IntervaloMinutos (ex.: 60, no programa instalado na loja): a cada N minutos enquanto o sistema está aberto.
///   - AoFechar = true: faz uma cópia também quando o sistema é fechado (antes de o banco desligar).
/// Guarda todas as cópias das últimas 24 horas e, antes disso, uma por dia até ManterDias (não lota a nuvem).
///
/// Configuração (appsettings / user-secrets / variáveis de ambiente), seção "Backup":
///   Ativo (true), Pasta (Documentos\Orion-Backups), Horario ("02:00"), IntervaloMinutos (0), AoFechar (false),
///   ManterDias (30), PgDump (caminho do pg_dump.exe; vazio = procura em [disco]:\Program Files\PostgreSQL\[versão]\bin).
/// Para restaurar: pg_restore --clean --if-exists -d orion "arquivo.dump" (ver README).
/// </summary>
public class BackupAutomatico(IConfiguration config, ILogger<BackupAutomatico> log) : BackgroundService
{
    public const string Prefixo = "orion-";

    private string Pasta => config["Backup:Pasta"] is { Length: > 0 } pasta
        ? pasta
        : Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "Orion-Backups");

    private TimeOnly Horario => TimeOnly.TryParse(config["Backup:Horario"], out var h) ? h : new TimeOnly(2, 0);

    private int IntervaloMinutos => Math.Max(0, config.GetValue("Backup:IntervaloMinutos", 0));

    private bool Ativo => config.GetValue("Backup:Ativo", true);

    /// <summary>Para a tela inicial: está ligado, onde guarda e quando foi a última cópia.</summary>
    public SituacaoBackup Situacao() => new(Ativo && LocalizarPgDump() is not null, Pasta, UltimaCopia()?.LastWriteTime);

    private FileInfo? UltimaCopia() =>
        Directory.Exists(Pasta)
            ? new DirectoryInfo(Pasta).EnumerateFiles($"{Prefixo}*.dump").MaxBy(f => f.LastWriteTime)
            : null;

    protected override async Task ExecuteAsync(CancellationToken parar)
    {
        if (!Ativo)
        {
            log.LogInformation("Backup automático desligado (Backup:Ativo = false).");
            return;
        }
        if (LocalizarPgDump() is null)
        {
            log.LogWarning("Backup automático: pg_dump não encontrado. Informe o caminho em Backup:PgDump.");
            return;
        }

        // Espera a API subir antes do primeiro backup
        try { await Task.Delay(TimeSpan.FromSeconds(30), parar); } catch (OperationCanceledException) { return; }
        while (!parar.IsCancellationRequested)
        {
            try
            {
                if (PrecisaDeCopia()) await FazerBackup(parar);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                log.LogError(ex, "Backup automático falhou; tenta de novo no próximo horário.");
            }
            try { await Task.Delay(AteOProximo(), parar); } catch (OperationCanceledException) { return; }
        }
    }

    /// <summary>Ao fechar o sistema (Backup:AoFechar): uma última cópia antes de desligar.</summary>
    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        await base.StopAsync(cancellationToken);
        if (!Ativo || !config.GetValue("Backup:AoFechar", false) || LocalizarPgDump() is null) return;
        try
        {
            using var limite = new CancellationTokenSource(TimeSpan.FromMinutes(2));
            await FazerBackup(limite.Token);
        }
        catch (Exception ex)
        {
            log.LogError(ex, "Backup ao fechar falhou.");
        }
    }

    private bool PrecisaDeCopia()
    {
        var ultima = UltimaCopia()?.LastWriteTime;
        if (IntervaloMinutos > 0) return ultima is null || DateTime.Now - ultima >= TimeSpan.FromMinutes(IntervaloMinutos);
        return ultima is null || ultima.Value.Date < DateTime.Today;
    }

    private TimeSpan AteOProximo()
    {
        var agora = DateTime.Now;
        if (IntervaloMinutos > 0)
        {
            // Próxima cópia: N minutos depois da última (no mínimo 1 minuto)
            var ultima = UltimaCopia()?.LastWriteTime ?? agora;
            var espera = ultima.AddMinutes(IntervaloMinutos) - agora;
            return espera < TimeSpan.FromMinutes(1) ? TimeSpan.FromMinutes(1) : espera;
        }
        var proximo = agora.Date + Horario.ToTimeSpan();
        if (proximo <= agora) proximo = proximo.AddDays(1);
        return proximo - agora;
    }

    /// <summary>Faz o backup agora e devolve o caminho do arquivo.</summary>
    public async Task<string> FazerBackup(CancellationToken ct)
    {
        var pgDump = LocalizarPgDump() ?? throw new InvalidOperationException("pg_dump não encontrado");
        var conexao = new NpgsqlConnectionStringBuilder(config.GetConnectionString("Orion"));
        Directory.CreateDirectory(Pasta);
        var arquivo = Path.Combine(Pasta, $"{Prefixo}{DateTime.Now:yyyy-MM-dd-HHmmss}.dump");
        // Grava com outro nome e só renomeia no fim: a nuvem nunca sobe uma cópia pela metade
        var temporario = arquivo + ".parcial";

        var inicio = new ProcessStartInfo(pgDump)
        {
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };
        // Formato "custom" (compactado, restaura com pg_restore)
        foreach (var argumento in new[]
        {
            "--format=custom", "--no-owner", "--no-privileges",
            $"--host={conexao.Host}", $"--port={conexao.Port}", $"--username={conexao.Username}",
            $"--file={temporario}", conexao.Database!,
        })
            inicio.ArgumentList.Add(argumento);
        inicio.Environment["PGPASSWORD"] = conexao.Password ?? "";

        using var processo = Process.Start(inicio)!;
        var erro = await processo.StandardError.ReadToEndAsync(ct);
        await processo.WaitForExitAsync(ct);
        if (processo.ExitCode != 0)
        {
            if (File.Exists(temporario)) File.Delete(temporario);
            throw new InvalidOperationException($"pg_dump terminou com erro {processo.ExitCode}: {erro}");
        }
        File.Move(temporario, arquivo);

        var tamanho = new FileInfo(arquivo).Length / 1024.0 / 1024.0;
        log.LogInformation("Backup feito: {Arquivo} ({Tamanho:0.0} MB)", arquivo, tamanho);
        ApagarAntigos();
        return arquivo;
    }

    /// <summary>Guarda tudo das últimas 24 horas; antes disso, a mais nova de cada dia, até ManterDias.</summary>
    private void ApagarAntigos()
    {
        var manter = config.GetValue("Backup:ManterDias", 30);
        var agora = DateTime.Now;
        var antigos = new DirectoryInfo(Pasta).EnumerateFiles($"{Prefixo}*.dump")
            .Where(f => agora - f.LastWriteTime > TimeSpan.FromHours(24))
            .GroupBy(f => f.LastWriteTime.Date);
        foreach (var dia in antigos)
        {
            var maisNova = dia.MaxBy(f => f.LastWriteTime)!;
            foreach (var arquivo in dia)
            {
                if (arquivo == maisNova && arquivo.LastWriteTime >= agora.AddDays(-manter)) continue;
                arquivo.Delete();
                log.LogInformation("Backup antigo apagado: {Arquivo}", arquivo.Name);
            }
        }
    }

    /// <summary>O pg_dump configurado, ou o da maior versão do PostgreSQL instalada (ou o do PATH).</summary>
    private string? LocalizarPgDump()
    {
        if (config["Backup:PgDump"] is { Length: > 0 } configurado) return File.Exists(configurado) ? configurado : null;
        // [disco]:\Program Files\PostgreSQL\[versão]\bin em qualquer disco (o PostgreSQL pode estar no D:, F:...)
        var raizes = DriveInfo.GetDrives()
            .Where(d => d.DriveType == DriveType.Fixed && d.IsReady)
            .Select(d => Path.Combine(d.RootDirectory.FullName, "Program Files", "PostgreSQL"))
            .Prepend(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "PostgreSQL"))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Where(Directory.Exists);
        var instalado = raizes
            .SelectMany(Directory.EnumerateDirectories)
            .Select(d => Path.Combine(d, "bin", OperatingSystem.IsWindows() ? "pg_dump.exe" : "pg_dump"))
            .Where(File.Exists)
            .OrderByDescending(c => int.TryParse(Path.GetFileName(Path.GetDirectoryName(Path.GetDirectoryName(c))), out var v) ? v : 0)
            .FirstOrDefault();
        if (instalado is not null) return instalado;
        var nome = OperatingSystem.IsWindows() ? "pg_dump.exe" : "pg_dump";
        return (Environment.GetEnvironmentVariable("PATH") ?? "").Split(Path.PathSeparator)
            .Select(d => Path.Combine(d, nome)).FirstOrDefault(File.Exists);
    }
}
