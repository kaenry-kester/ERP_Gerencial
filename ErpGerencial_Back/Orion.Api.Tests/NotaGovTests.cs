using System.Net;
using Orion.Api.Tests.Infra;

namespace Orion.Api.Tests;

/// <summary>A nota é emitida no site do governo; aqui só fica anotado o tipo e o número.</summary>
[Collection("api")]
public class NotaGovTests(ApiDeTeste api)
{
    [Fact]
    public async Task Anota_e_apaga_o_numero_da_nota_emitida_no_governo()
    {
        var conta = await api.NovaConta();
        var http = conta.Http;
        var produto = await http.NovoProduto("Refil", 60, 10);
        var venda = await http.Vender(new { itens = new[] { new { produtoId = produto.Texto("id"), quantidade = 1, valorUnitario = 60 } }, formaPagamento = "pix" });
        var rota = $"/api/cupons/{venda.Texto("id")}/nota";

        Assert.Equal(HttpStatusCode.BadRequest, (await http.Put(rota, new { tipo = "outro", numero = "12" })).Status);

        var anotada = await http.Put(rota, new { tipo = "nota", numero = " 1234 " });
        Assert.Equal(HttpStatusCode.OK, anotada.Status);
        Assert.Equal("nota", anotada.Texto("notaTipo"));
        Assert.Equal("1234", anotada.Texto("notaNumero"));
        Assert.Equal("1234", (await http.Get($"/api/cupons/{venda.Texto("id")}")).Texto("notaNumero"));

        var apagada = await http.Put(rota, new { tipo = "nota", numero = "" });
        Assert.Null(apagada.Texto("notaTipo"));
        Assert.Null(apagada.Texto("notaNumero"));
    }
}
