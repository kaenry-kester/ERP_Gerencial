using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Orion.Api.Auth;
using Orion.Api.Cupons;
using Orion.Api.Data;

namespace Orion.Api.Financeiro;

public record TotaisVendas(
    decimal Faturamento,
    int Vendas,
    decimal TicketMedio,
    decimal ItensVendidos,
    decimal Descontos,
    decimal Custo,
    /// <summary>Faturamento menos o custo dos produtos (preço de custo na hora da venda).</summary>
    decimal LucroBruto,
    int Cancelados,
    decimal ValorCancelado);

/// <summary>Um ponto do gráfico no tempo: o dia ("2026-10-21") ou o mês ("2026-10").</summary>
public record PontoVendas(string Periodo, decimal Faturamento, int Vendas);

public record FatiaVendas(string Chave, string Nome, decimal Valor, decimal Quantidade);

public record ResumoFinanceiro(
    DateOnly De,
    DateOnly Ate,
    /// <summary>"dia" (períodos de até 3 meses) ou "mes".</summary>
    string Agrupamento,
    TotaisVendas Totais,
    /// <summary>Os mesmos totais no período anterior de mesmo tamanho (para comparar).</summary>
    TotaisVendas Anterior,
    List<PontoVendas> NoTempo,
    List<FatiaVendas> FormasPagamento,
    List<FatiaVendas> Produtos,
    List<FatiaVendas> Clientes,
    List<FatiaVendas> Vendedores,
    /// <summary>Faturamento por dia da semana (0 = domingo).</summary>
    List<decimal> DiasSemana,
    /// <summary>Faturamento por hora do dia (0 a 23).</summary>
    List<decimal> Horas,
    /// <summary>Anos com vendas (filtro de ano).</summary>
    List<int> Anos,
    /// <summary>Usuários da empresa (filtro de vendedor).</summary>
    List<FatiaVendas> Equipe);

/// <summary>
/// Financeiro: resumo das vendas (cupons emitidos) para o painel. Exige a permissão "financeiro".
/// Período em dias do horário de Brasília; sem período, o mês atual.
/// </summary>
public static class FinanceiroEndpoints
{
    public static void MapFinanceiroEndpoints(this WebApplication app)
    {
        app.MapGroup("/api/financeiro").RequireAuthorization().MapGet("/resumo", Resumo);
    }

    private static async Task<IResult> Resumo(
        ClaimsPrincipal user, OrionDbContext db, DateOnly? de, DateOnly? ate, string? forma, Guid? vendedorId)
    {
        var (usuario, negado) = await Permissoes.Exigir(user, db, Permissoes.Financeiro);
        if (usuario is null) return negado!;

        var hoje = Horario.Hoje;
        var inicio = de ?? new DateOnly(hoje.Year, hoje.Month, 1);
        var fim = ate ?? hoje;
        if (fim < inicio) (inicio, fim) = (fim, inicio);
        if (fim.DayNumber - inicio.DayNumber > 3700) inicio = fim.AddYears(-10);

        var daEmpresa = db.Cupons.Where(c => c.EmpresaId == usuario.EmpresaId);
        var cupons = await CupomEndpoints.Filtrar(daEmpresa, inicio, fim, forma, vendedorId, null)
            .Include(c => c.Itens)
            .AsSplitQuery()
            .ToListAsync();

        // Período anterior do mesmo tamanho (ex.: outubro → setembro inteiro; 7 dias → os 7 dias antes)
        var dias = fim.DayNumber - inicio.DayNumber + 1;
        var anteriores = await CupomEndpoints
            .Filtrar(daEmpresa, inicio.AddDays(-dias), inicio.AddDays(-1), forma, vendedorId, null)
            .Include(c => c.Itens)
            .AsSplitQuery()
            .ToListAsync();

        var validos = cupons.Where(c => c.CanceladoEm is null).ToList();
        var porMes = dias > 93;

        var noTempo = new List<PontoVendas>();
        var porPeriodo = validos
            .GroupBy(c => Chave(Horario.Local(c.EmitidoEm), porMes))
            .ToDictionary(g => g.Key, g => (Valor: g.Sum(c => c.Total), Vendas: g.Count()));
        // Todos os dias (ou meses) do período, inclusive os sem venda (o gráfico mostra o zero)
        for (var d = inicio; d <= fim; d = porMes ? new DateOnly(d.Year, d.Month, 1).AddMonths(1) : d.AddDays(1))
        {
            var chave = Chave(d.ToDateTime(TimeOnly.MinValue), porMes);
            var ponto = porPeriodo.GetValueOrDefault(chave);
            noTempo.Add(new PontoVendas(chave, ponto.Valor, ponto.Vendas));
        }

        var formas = new Dictionary<string, (decimal Valor, int Vendas)>();
        foreach (var c in validos)
        {
            // Venda dividida: a 2ª forma fica com o valor dela e a 1ª com o resto (o troco sai do dinheiro)
            var valor2 = c.FormaPagamento2 is null ? 0 : Math.Min(c.ValorPagamento2 ?? 0, c.Total);
            Somar(formas, c.FormaPagamento, c.Total - valor2);
            if (c.FormaPagamento2 is { } forma2) Somar(formas, forma2, valor2);
        }

        var produtos = validos.SelectMany(c => c.Itens)
            .GroupBy(i => i.ProdutoId?.ToString() ?? $"avulso:{i.Descricao.Trim().ToLowerInvariant()}")
            .Select(g => new FatiaVendas(g.Key, g.First().Descricao, g.Sum(i => i.Total), g.Sum(i => i.Quantidade)))
            .OrderByDescending(f => f.Valor).Take(10).ToList();

        var clientes = validos.Where(c => c.ClienteId is not null || c.ClienteNome is not null)
            .GroupBy(c => c.ClienteId?.ToString() ?? $"nome:{c.ClienteNome!.Trim().ToLowerInvariant()}")
            .Select(g => new FatiaVendas(g.Key, g.First().ClienteNome ?? "Cliente", g.Sum(c => c.Total), g.Count()))
            .OrderByDescending(f => f.Valor).Take(10).ToList();

        var vendedores = validos
            .GroupBy(c => (c.VendedorId ?? c.UsuarioId)?.ToString() ?? c.EmitidoPor)
            .Select(g => new FatiaVendas(g.Key, g.First().VendedorNome ?? g.First().EmitidoPor, g.Sum(c => c.Total), g.Count()))
            .OrderByDescending(f => f.Valor).ToList();

        var diasSemana = Enumerable.Repeat(0m, 7).ToList();
        var horas = Enumerable.Repeat(0m, 24).ToList();
        foreach (var c in validos)
        {
            var local = Horario.Local(c.EmitidoEm);
            diasSemana[(int)local.DayOfWeek] += c.Total;
            horas[local.Hour] += c.Total;
        }

        var primeira = await daEmpresa.MinAsync(c => (DateTime?)c.EmitidoEm);
        var primeiroAno = primeira is { } p ? Horario.Local(p).Year : hoje.Year;
        var anos = Enumerable.Range(primeiroAno, hoje.Year - primeiroAno + 1).Reverse().ToList();
        var equipe = await db.Usuarios.Where(u => u.EmpresaId == usuario.EmpresaId).OrderBy(u => u.Nome)
            .Select(u => new FatiaVendas(u.Id.ToString(), u.Nome, 0, 0)).ToListAsync();

        return Results.Ok(new ResumoFinanceiro(
            inicio, fim, porMes ? "mes" : "dia",
            Totais(cupons), Totais(anteriores), noTempo,
            formas.Select(f => new FatiaVendas(f.Key, f.Key, f.Value.Valor, f.Value.Vendas))
                .OrderByDescending(f => f.Valor).ToList(),
            produtos, clientes, vendedores, diasSemana, horas, anos, equipe));
    }

    private static string Chave(DateTime local, bool porMes) =>
        porMes ? local.ToString("yyyy-MM") : local.ToString("yyyy-MM-dd");

    private static void Somar(Dictionary<string, (decimal Valor, int Vendas)> formas, string forma, decimal valor)
    {
        var atual = formas.GetValueOrDefault(forma);
        formas[forma] = (atual.Valor + valor, atual.Vendas + 1);
    }

    private static TotaisVendas Totais(List<Cupom> cupons)
    {
        var validos = cupons.Where(c => c.CanceladoEm is null).ToList();
        var cancelados = cupons.Where(c => c.CanceladoEm is not null).ToList();
        var faturamento = validos.Sum(c => c.Total);
        var custo = validos.SelectMany(c => c.Itens).Sum(i => Math.Round(i.CustoUnitario * i.Quantidade, 2));
        return new TotaisVendas(
            faturamento,
            validos.Count,
            validos.Count == 0 ? 0 : Math.Round(faturamento / validos.Count, 2),
            validos.SelectMany(c => c.Itens).Sum(i => i.Quantidade),
            validos.Sum(c => c.Desconto),
            custo,
            faturamento - custo,
            cancelados.Count,
            cancelados.Sum(c => c.Total));
    }
}
