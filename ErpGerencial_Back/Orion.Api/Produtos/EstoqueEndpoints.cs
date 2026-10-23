using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Orion.Api.Auth;
using Orion.Api.Data;

namespace Orion.Api.Produtos;

/// <summary>Ajuste manual: a quantidade contada passa a ser o estoque (inventário, perda, avaria...).</summary>
public record AjusteRequest(decimal NovaQuantidade, string Motivo);

public record MovimentoEstoqueDto(
    Guid Id,
    Guid ProdutoId,
    string ProdutoNome,
    string? ProdutoCodigo,
    string Tipo,
    decimal Quantidade,
    decimal SaldoApos,
    decimal? CustoUnitario,
    string? Observacao,
    Guid? CupomId,
    string UsuarioNome,
    DateTime CriadoEm);

public record ListaMovimentos(List<MovimentoEstoqueDto> Itens, int Total, int Pagina, int TamanhoPagina);

/// <summary>
/// Estoque: ajuste e o histórico de movimentações. Ver: permissão "produtos";
/// mexer no estoque: "produtos-editar".
/// </summary>
public static class EstoqueEndpoints
{
    private const int TamanhoPagina = 50;

    public static void MapEstoqueEndpoints(this WebApplication app)
    {
        var grupo = app.MapGroup("/api/estoque").RequireAuthorization();
        grupo.MapGet("/movimentos", Movimentos);
        grupo.MapPost("/produtos/{id:guid}/ajuste", Ajustar);
    }

    /// <summary>Movimentações, mais novas primeiro; filtros: produto, tipo e período (dias de Brasília).</summary>
    private static async Task<IResult> Movimentos(
        ClaimsPrincipal user, OrionDbContext db, Guid? produtoId, string? tipo, DateOnly? de, DateOnly? ate, int? pagina)
    {
        var (usuario, negado) = await Permissoes.Exigir(user, db, Permissoes.Produtos);
        if (usuario is null) return negado!;

        var consulta = db.MovimentosEstoque.Where(m => m.EmpresaId == usuario.EmpresaId);
        if (produtoId is { } p) consulta = consulta.Where(m => m.ProdutoId == p);
        if (!string.IsNullOrWhiteSpace(tipo)) consulta = consulta.Where(m => m.Tipo == tipo);
        if (de is { } inicio)
        {
            var desde = Horario.InicioDoDiaUtc(inicio);
            consulta = consulta.Where(m => m.CriadoEm >= desde);
        }
        if (ate is { } fim)
        {
            var antes = Horario.InicioDoDiaUtc(fim.AddDays(1));
            consulta = consulta.Where(m => m.CriadoEm < antes);
        }

        var numeroPagina = Math.Max(1, pagina ?? 1);
        var total = await consulta.CountAsync();
        var itens = await (
            from m in consulta
            join pr in db.Produtos on m.ProdutoId equals pr.Id
            orderby m.CriadoEm descending
            select new MovimentoEstoqueDto(
                m.Id, m.ProdutoId, pr.Nome, pr.Codigo, m.Tipo, m.Quantidade, m.SaldoApos, m.CustoUnitario,
                m.Observacao, m.CupomId, m.UsuarioNome, m.CriadoEm))
            .Skip((numeroPagina - 1) * TamanhoPagina)
            .Take(TamanhoPagina)
            .ToListAsync();
        return Results.Ok(new ListaMovimentos(itens, total, numeroPagina, TamanhoPagina));
    }

    /// <summary>Ajuste: a quantidade contada vira o estoque; a diferença fica registrada com o motivo.</summary>
    private static async Task<IResult> Ajustar(Guid id, AjusteRequest req, ClaimsPrincipal user, OrionDbContext db)
    {
        var (usuario, negado) = await Permissoes.Exigir(user, db, Permissoes.ProdutosEditar);
        if (usuario is null) return negado!;

        var motivo = req.Motivo?.Trim() ?? "";
        if (motivo.Length == 0)
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["motivo"] = ["Diga o motivo do ajuste"] });
        if (motivo.Length > 300)
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["motivo"] = ["Máximo de 300 letras"] });
        if (req.NovaQuantidade is < -999_999_999m or > 999_999_999m)
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["novaQuantidade"] = ["Quantidade inválida"] });

        var produto = await db.Produtos.SingleOrDefaultAsync(p => p.Id == id && p.EmpresaId == usuario.EmpresaId);
        if (produto is null) return Results.NotFound();

        var diferenca = Math.Round(req.NovaQuantidade, 3) - produto.Quantidade;
        if (diferenca == 0)
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["novaQuantidade"] = ["É a mesma quantidade de agora"] });
        Estoque.Movimentar(db, produto, "ajuste", diferenca, usuario, observacao: motivo);
        await db.SaveChangesAsync();
        return Results.Ok(new { quantidade = produto.Quantidade });
    }
}
