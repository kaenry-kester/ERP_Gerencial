using Microsoft.Extensions.DependencyInjection;
using Orion.Api.Sistema;
using Orion.Api.Tests.Infra;

namespace Orion.Api.Tests;

[Collection("api")]
public class BackupTests(ApiDeTeste api)
{
    [Fact]
    public async Task Backup_gera_o_arquivo_do_banco_com_o_pg_dump()
    {
        if (Directory.Exists(ApiDeTeste.PastaBackup)) Directory.Delete(ApiDeTeste.PastaBackup, recursive: true);
        var backup = api.Services.GetRequiredService<BackupAutomatico>();

        var arquivo = await backup.FazerBackup(CancellationToken.None);

        Assert.StartsWith(ApiDeTeste.PastaBackup, arquivo);
        Assert.True(File.Exists(arquivo));
        // Formato "custom" do pg_dump começa com "PGDMP"
        var inicio = new byte[5];
        await using (var leitura = File.OpenRead(arquivo)) await leitura.ReadExactlyAsync(inicio);
        Assert.Equal("PGDMP", System.Text.Encoding.ASCII.GetString(inicio));
        Assert.True(new FileInfo(arquivo).Length > 1000);
    }

    [Fact]
    public async Task Situacao_mostra_a_ultima_copia_e_desligar_so_no_programa_da_loja()
    {
        var conta = await api.NovaConta();
        var backup = api.Services.GetRequiredService<BackupAutomatico>();
        await backup.FazerBackup(CancellationToken.None);

        var situacao = await conta.Http.Get("/api/sistema/backup");
        Assert.Equal(System.Net.HttpStatusCode.OK, situacao.Status);
        // Nos testes o backup automático fica desligado (Backup:Ativo = false), mas a última cópia aparece
        Assert.False(situacao.Json.GetProperty("ativo").GetBoolean());
        Assert.NotNull(situacao.Texto("ultima"));

        // Sem Sistema:PermitirDesligar a rota de desligar não existe (não derruba a API de ninguém)
        Assert.Equal(System.Net.HttpStatusCode.NotFound, (await conta.Http.Post("/api/sistema/desligar")).Status);
        Assert.Equal(System.Net.HttpStatusCode.NotFound,
            (await conta.Http.Post("/api/sistema/redefinir-senha", new { email = "x@exemplo.com", novaSenha = "Nova@1234" })).Status);
    }
}
