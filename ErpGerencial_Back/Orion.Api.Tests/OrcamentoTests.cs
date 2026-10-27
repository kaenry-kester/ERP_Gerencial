using System.Net;
using System.Net.Http.Headers;
using Orion.Api.Tests.Infra;

namespace Orion.Api.Tests;

/// <summary>Orçamento (vira cupom ao finalizar), funcionário que emite cupons, busca sem acento e o PDF pelo WhatsApp.</summary>
[Collection("api")]
public class OrcamentoTests(ApiDeTeste api)
{
    private static object Linha(string servico, decimal preco, decimal quantidade, string? observacao = null, string? data = null) =>
        new { servico, observacao, preco, quantidade, data };

    [Fact]
    public async Task Orcamento_e_alterado_e_ao_finalizar_vira_cupom_com_as_mesmas_linhas()
    {
        var http = (await api.NovaConta()).Http;
        var criado = await http.Post("/api/orcamentos", new
        {
            clienteNome = "Maria",
            observacao = "Validade 7 dias",
            itens = new[] { Linha("Troca de refil", 80, 2, "Cozinha", "2026-10-26") },
        });
        Assert.Equal(HttpStatusCode.Created, criado.Status);
        var id = criado.Texto("id");

        // Alterar troca todas as linhas
        var alterado = await http.Put($"/api/orcamentos/{id}", new
        {
            clienteNome = "Maria",
            observacao = "Validade 7 dias",
            itens = new[] { Linha("Troca de refil", 80, 2, "Cozinha", "2026-10-26"), Linha("Visita", 50, 1) },
        });
        Assert.Equal(HttpStatusCode.OK, alterado.Status);
        Assert.Equal(210m, alterado.Decimal("total"));
        Assert.Equal(2, alterado["itens"].GetArrayLength());

        var finalizado = await http.Post($"/api/orcamentos/{id}/finalizar", new { formaPagamento = "pix" });
        Assert.Equal(HttpStatusCode.OK, finalizado.Status);
        Assert.Equal("finalizado", finalizado.Texto("situacao"));

        var cupom = await http.Get($"/api/cupons/{finalizado.Texto("cupomId")}");
        Assert.Equal(210m, cupom.Decimal("total"));
        Assert.Equal("Maria", cupom.Texto("clienteNome"));
        Assert.Equal("Validade 7 dias", cupom.Texto("observacao"));
        var item = cupom["itens"][0];
        Assert.Equal("Troca de refil", item.GetProperty("descricao").GetString());
        Assert.Equal("Cozinha", item.GetProperty("observacao").GetString());
        Assert.Equal("2026-10-26", item.GetProperty("data").GetString());

        // Finalizado não muda, não se exclui e não finaliza de novo
        Assert.Equal(HttpStatusCode.Conflict,
            (await http.Put($"/api/orcamentos/{id}", new { itens = new[] { Linha("Outro", 1, 1) } })).Status);
        Assert.Equal(HttpStatusCode.Conflict, (await http.DeleteAsync($"/api/orcamentos/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await http.Post($"/api/orcamentos/{id}/finalizar", new { formaPagamento = "pix" })).Status);
    }

    [Fact]
    public async Task Funcionario_so_emite_cupons_e_orcamentos_quando_liberado()
    {
        var admin = await api.NovaConta();

        async Task<HttpClient> Funcionario(bool emiteCupons)
        {
            var email = $"func.{Guid.NewGuid():N}@exemplo.com";
            var criado = await admin.Http.Post("/api/usuarios", new
            {
                nome = "Funcionário", email, telefone = $"169{Random.Shared.Next(10000000, 99999999)}",
                senha = ContaDeTeste.Senha, administrador = false, emiteCupons,
            });
            Assert.Equal(HttpStatusCode.Created, criado.Status);
            var login = await api.CreateClient().Post("/api/auth/login", new { email, senha = ContaDeTeste.Senha });
            var http = api.CreateClient();
            http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", login.Texto("token"));
            return http;
        }

        var liberado = await Funcionario(emiteCupons: true);
        var semPermissao = await Funcionario(emiteCupons: false);
        var venda = new { itens = new[] { new { descricao = "Serviço", quantidade = 1, valorUnitario = 10 } }, formaPagamento = "pix" };

        Assert.Equal(HttpStatusCode.Created, (await liberado.Vender(venda)).Status);
        Assert.Equal(HttpStatusCode.OK, (await liberado.Get("/api/orcamentos")).Status);
        Assert.Equal(HttpStatusCode.Forbidden, (await liberado.Get("/api/financeiro/resumo")).Status);

        Assert.Equal(HttpStatusCode.Forbidden, (await semPermissao.Vender(venda)).Status);
        Assert.Equal(HttpStatusCode.Forbidden, (await semPermissao.Get("/api/orcamentos")).Status);
    }

    [Fact]
    public async Task Busca_nao_diferencia_maiusculas_nem_acentos()
    {
        var http = (await api.NovaConta()).Http;
        await http.NovoProduto("Abacaxi", 10, 1);
        await http.NovoProduto("Água Mineral", 3, 1);

        foreach (var (termo, nome) in new[] { ("ABACAXI", "Abacaxi"), ("aBaCaXi", "Abacaxi"), ("agua", "Água Mineral"), ("ÁGUA", "Água Mineral") })
        {
            var lista = await http.Get($"/api/produtos?busca={Uri.EscapeDataString(termo)}");
            Assert.Contains(lista["itens"].EnumerateArray(), p => p.GetProperty("nome").GetString() == nome);
        }
    }

    [Fact]
    public async Task Encaminha_o_pdf_do_cupom_pelo_whatsapp_da_loja()
    {
        var http = (await api.NovaConta()).Http;
        var cliente = await http.Post("/api/clientes", new { nome = "João Cliente", celular = "16991112222", item = "Purificador", marca = "Europa" });
        Assert.Equal(HttpStatusCode.Created, cliente.Status);
        Assert.Equal("Purificador", cliente.Texto("item"));
        var venda = await http.Vender(new
        {
            clienteId = cliente.Texto("id"),
            itens = new[] { new { descricao = "Refil", quantidade = 1, valorUnitario = 60 } },
            formaPagamento = "pix",
        });
        var rota = $"/api/cupons/{venda.Texto("id")}/whatsapp";
        var pdf = Convert.ToBase64String("%PDF-1.4 cupom"u8.ToArray());

        // Sem o WhatsApp da loja salvo: avisa
        Assert.Equal(HttpStatusCode.BadRequest, (await http.Post(rota, new { pdf })).Status);

        await http.Put("/api/whatsapp", new { remetente = $"169{Random.Shared.Next(10000000, 99999999)}", mensagem = "Olá" });
        Assert.Equal(HttpStatusCode.BadRequest, (await http.Post(rota, new { pdf = "isto não é um pdf" })).Status);

        // Sem número: vai para o celular do cliente do cupom
        var enviado = await http.Post(rota, new { pdf });
        Assert.Equal(HttpStatusCode.OK, enviado.Status);
        Assert.Equal("16991112222", enviado.Texto("numero"));
        var midia = api.Evolution.Midias.Last(m => m.GetProperty("number").GetString()!.StartsWith("5516991112222"));
        Assert.Equal("document", midia.GetProperty("mediatype").GetString());
        Assert.Equal("application/pdf", midia.GetProperty("mimetype").GetString());
        Assert.Equal(pdf, midia.GetProperty("media").GetString());
        Assert.Contains("João", midia.GetProperty("caption").GetString());
    }
}
