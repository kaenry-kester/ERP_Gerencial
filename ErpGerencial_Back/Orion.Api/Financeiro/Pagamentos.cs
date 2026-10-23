using Orion.Api.Data;

namespace Orion.Api.Financeiro;

/// <summary>Quanto de cada forma de pagamento uma venda trouxe (usado no Financeiro e no fechamento do caixa).</summary>
public static class Pagamentos
{
    /// <summary>
    /// Valor que ficou com a empresa em cada forma (a soma é o total da venda): o que foi pago em cada uma,
    /// menos o troco, que sai sempre do dinheiro. Cupons antigos sem o valor da 1ª forma: o valor recebido ou o total.
    /// </summary>
    public static Dictionary<string, decimal> PorForma(Cupom c)
    {
        var pago2 = c.FormaPagamento2 is null ? 0 : c.ValorPagamento2 ?? 0;
        var pago1 = c.ValorPagamento1 ?? (c.FormaPagamento2 is null ? c.ValorRecebido : null) ?? Math.Max(0, c.Total - pago2);
        var formas = new Dictionary<string, decimal> { [c.FormaPagamento] = pago1 };
        if (c.FormaPagamento2 is { } forma2) formas[forma2] = formas.GetValueOrDefault(forma2) + pago2;

        var troco = pago1 + pago2 - c.Total;
        if (troco > 0)
        {
            var deQual = formas.ContainsKey("dinheiro") ? "dinheiro" : c.FormaPagamento;
            formas[deQual] -= troco;
        }
        return formas;
    }

    /// <summary>Dinheiro que a venda deixou no caixa (já sem o troco).</summary>
    public static decimal Dinheiro(Cupom c) => PorForma(c).GetValueOrDefault("dinheiro");
}
