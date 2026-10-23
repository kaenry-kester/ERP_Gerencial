using System.Net;
using Orion.Api.Tests.Infra;

namespace Orion.Api.Tests;

[Collection("api")]
public class EstoqueTests(ApiDeTeste api)
{
    [Fact]
    public async Task Cada_mudanca_de_estoque_fica_no_historico_com_o_saldo()
    {
        var conta = await api.NovaConta();
        var http = conta.Http;
        var produto = await http.NovoProduto("Refil", 60, 10, custo: 20, estoqueMinimo: 4);
        var id = produto.Texto("id");

        // Mudar a quantidade no cadastro vira um ajuste
        var editado = await http.Put($"/api/produtos/{id}", new { nome = "Refil", precoCusto = 20, precoVendaPf = 60, quantidade = 15, estoqueMinimo = 4 });
        Assert.Equal(HttpStatusCode.OK, editado.Status);

        // Ajuste exige motivo e grava a diferença
        Assert.Equal(HttpStatusCode.BadRequest, (await http.Post($"/api/estoque/produtos/{id}/ajuste", new { novaQuantidade = 3m, motivo = "" })).Status);
        var ajuste = await http.Post($"/api/estoque/produtos/{id}/ajuste", new { novaQuantidade = 3m, motivo = "Inventário: 12 com avaria" });
        Assert.Equal(HttpStatusCode.OK, ajuste.Status);

        // Estoque baixo (3 <= mínimo 4)
        var baixos = await http.Get("/api/produtos?estoqueBaixo=true");
        Assert.Equal(1, baixos["total"].GetInt32());
        Assert.True(baixos["itens"][0].GetProperty("estoqueBaixo").GetBoolean());

        var historico = await http.Get($"/api/estoque/movimentos?produtoId={id}");
        var movimentos = historico["itens"].EnumerateArray().Reverse().ToList();
        Assert.Equal(["inicial", "ajuste", "ajuste"], movimentos.Select(m => m.GetProperty("tipo").GetString()));
        Assert.Equal([10m, 15m, 3m], movimentos.Select(m => m.GetProperty("saldoApos").GetDecimal()));
        Assert.Equal(-12m, movimentos[2].GetProperty("quantidade").GetDecimal());
        Assert.Equal("Inventário: 12 com avaria", movimentos[2].GetProperty("observacao").GetString());

        // A rota da entrada de mercadoria não existe mais
        Assert.Equal(HttpStatusCode.NotFound, (await http.Post("/api/estoque/entradas", new { })).Status);
    }

    [Fact]
    public async Task Venda_e_cancelamento_entram_no_historico()
    {
        var conta = await api.NovaConta();
        var http = conta.Http;
        var produto = await http.NovoProduto("Purificador", 500, 8);
        var venda = await http.Vender(new { itens = new[] { new { produtoId = produto.Texto("id"), quantidade = 3, valorUnitario = 500 } }, formaPagamento = "pix" });
        Assert.Equal(HttpStatusCode.Created, venda.Status);
        await http.Post($"/api/cupons/{venda.Texto("id")}/cancelar", new { motivo = "Cliente desistiu" });

        var historico = await http.Get($"/api/estoque/movimentos?produtoId={produto.Texto("id")}");
        var movimentos = historico["itens"].EnumerateArray().Reverse().ToList();
        Assert.Equal(["inicial", "venda", "cancelamento"], movimentos.Select(m => m.GetProperty("tipo").GetString()));
        Assert.Equal([8m, 5m, 8m], movimentos.Select(m => m.GetProperty("saldoApos").GetDecimal()));
        Assert.Equal(venda.Texto("id"), movimentos[1].GetProperty("cupomId").GetString());
    }

    [Fact]
    public async Task Produto_aceita_estoque_zerado_ou_negativo()
    {
        var conta = await api.NovaConta();
        var http = conta.Http;
        var negativo = await http.Post("/api/produtos", new { nome = "Refil vendido sem estoque", precoVendaPf = 60, quantidade = -2.5m, unidade = "un" });
        Assert.Equal(HttpStatusCode.Created, negativo.Status);
        Assert.Equal(-2.5m, negativo["quantidade"].GetDecimal());
        Assert.Equal("UN", negativo.Texto("unidade"));
        var zerado = await http.Post("/api/produtos", new { nome = "Torneira", precoVendaPf = 30, quantidade = 0 });
        Assert.Equal(HttpStatusCode.Created, zerado.Status);

        // Os dois aparecem na lista
        Assert.Equal(2, (await http.Get("/api/produtos"))["total"].GetInt32());
        // Rota de categorias não existe mais
        Assert.Equal(HttpStatusCode.NotFound, (await http.Get("/api/categorias")).Status);
    }

    [Fact]
    public async Task Uma_empresa_nao_ve_o_estoque_da_outra()
    {
        var a = await api.NovaConta();
        var b = await api.NovaConta();
        var produto = await a.Http.NovoProduto("Só da A", 10, 5);
        Assert.Equal(HttpStatusCode.NotFound, (await b.Http.Post($"/api/estoque/produtos/{produto.Texto("id")}/ajuste", new { novaQuantidade = 0, motivo = "x" })).Status);
        Assert.Equal(0, (await b.Http.Get("/api/estoque/movimentos"))["total"].GetInt32());
    }
}
