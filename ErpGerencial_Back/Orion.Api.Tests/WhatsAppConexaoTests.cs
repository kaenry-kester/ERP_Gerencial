using System.Net;
using Orion.Api.Tests.Infra;

namespace Orion.Api.Tests;

/// <summary>Conectar o celular que envia pelo próprio site: QR Code e situação da conexão (Evolution simulada).</summary>
[Collection("api")]
public class WhatsAppConexaoTests(ApiDeTeste api)
{
    [Fact]
    public async Task Gera_o_qr_code_e_mostra_quando_conecta()
    {
        var conta = await api.NovaConta();
        var http = conta.Http;

        // Sem número salvo: avisa e não gera QR
        Assert.Equal("sem-numero", (await http.Get("/api/whatsapp/conexao")).Texto("estado"));
        Assert.Equal(HttpStatusCode.BadRequest, (await http.Post("/api/whatsapp/conexao")).Status);

        var numero = $"169{Random.Shared.Next(10000000, 99999999)}";
        var salvo = await http.Put("/api/whatsapp", new { remetente = numero, mensagem = "Olá" });
        Assert.Equal(HttpStatusCode.OK, salvo.Status);
        Assert.Equal("desconectado", (await http.Get("/api/whatsapp/conexao")).Texto("estado"));

        // Conectar: cria a conexão desse número e devolve o QR Code e o código
        var conexao = await http.Post("/api/whatsapp/conexao");
        Assert.Equal(HttpStatusCode.OK, conexao.Status);
        Assert.Equal("aguardando", conexao.Texto("estado"));
        Assert.StartsWith("data:image/png;base64,", conexao.Texto("qrCode"));
        Assert.Equal("ABCD1234", conexao.Texto("codigo"));
        Assert.True(api.Evolution.Estados.ContainsKey(numero));

        // O celular leu o QR Code
        api.Evolution.Estados[numero] = "open";
        Assert.Equal("conectado", (await http.Get("/api/whatsapp/conexao")).Texto("estado"));
        Assert.Equal("conectado", (await http.Post("/api/whatsapp/conexao")).Texto("estado"));
    }

    [Fact]
    public async Task Tela_inicial_mostra_as_mensagens_de_hoje()
    {
        var conta = await api.NovaConta();
        var http = conta.Http;
        // Um cliente com envio marcado para hoje e outro para daqui a uma semana
        var hoje = DateTime.UtcNow.AddMinutes(30);
        var semana = DateTime.UtcNow.AddDays(7);
        var deHoje = await http.Post("/api/clientes", new { nome = "Maria de Hoje", celular = "16988881111", envioEm = hoje });
        Assert.True(deHoje.Status == HttpStatusCode.Created, deHoje.ToString());
        await http.Post("/api/clientes", new { nome = "João da Semana", celular = "16988882222", envioEm = semana });

        var lista = await http.Get("/api/whatsapp/hoje");
        Assert.Equal(HttpStatusCode.OK, lista.Status);
        var itens = lista.Json.EnumerateArray().ToList();
        // Perto da meia-noite, "daqui a 30 minutos" já é amanhã: aí a lista fica vazia
        if (Orion.Api.Horario.Local(hoje).Date == Orion.Api.Horario.Local(DateTime.UtcNow).Date)
        {
            var item = Assert.Single(itens);
            Assert.Equal("Maria de Hoje", item.GetProperty("nome").GetString());
            Assert.Equal("agendada", item.GetProperty("situacao").GetString());
        }
        Assert.DoesNotContain(itens, i => i.GetProperty("nome").GetString() == "João da Semana");
        // Uma linha por cliente (sem repetir)
        Assert.Equal(itens.Count, itens.Select(i => i.GetProperty("clienteId").GetString()).Distinct().Count());
    }
}
