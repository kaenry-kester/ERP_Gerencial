using Orion.Api.Tests.Infra;

namespace Orion.Api.Tests;

[Collection("api")]
public class FinanceiroTests(ApiDeTeste api)
{
    [Fact]
    public async Task Financeiro_tira_o_troco_do_dinheiro()
    {
        var conta = await api.NovaConta();
        var http = conta.Http;
        var produto = await http.NovoProduto("Purificador", 1100, 5, custo: 600);
        // 1.100: Pix 800 + dinheiro 350 = 1.150 → troco 50 do dinheiro
        await http.Vender(new
        {
            itens = new[] { new { produtoId = produto.Texto("id"), quantidade = 1, valorUnitario = 1100 } },
            formaPagamento = "pix", valorPagamento1 = 800, formaPagamento2 = "dinheiro", valorPagamento2 = 350,
        });
        var resumo = await http.Get("/api/financeiro/resumo");
        var formas = resumo["formasPagamento"].EnumerateArray().ToDictionary(f => f.GetProperty("chave").GetString()!, f => f.GetProperty("valor").GetDecimal());
        Assert.Equal(800m, formas["pix"]);
        Assert.Equal(300m, formas["dinheiro"]);
        Assert.Equal(1100m, resumo["totais"].GetProperty("faturamento").GetDecimal());
        Assert.Equal(500m, resumo["totais"].GetProperty("lucroBruto").GetDecimal());
    }
}
