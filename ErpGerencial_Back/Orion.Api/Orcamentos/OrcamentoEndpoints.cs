using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Orion.Api.Auth;
using Orion.Api.Cupons;
using Orion.Api.Data;

namespace Orion.Api.Orcamentos;

public record OrcamentoItemRequest(string? Servico, string? Observacao, decimal Preco, decimal Quantidade, DateOnly? Data);

public record OrcamentoRequest(Guid? ClienteId, string? ClienteNome, string? Observacao, List<OrcamentoItemRequest>? Itens);

/// <summary>Ao finalizar: como o cliente pagou (o cupom sai com o total do orçamento).</summary>
public record FinalizarOrcamentoRequest(string FormaPagamento);

public record OrcamentoItemDto(
    Guid Id, string Servico, string? Observacao, decimal Preco, decimal Quantidade, DateOnly? Data, decimal Total);

public record OrcamentoDto(
    Guid Id,
    int Numero,
    Guid? ClienteId,
    string? ClienteNome,
    string? Observacao,
    List<OrcamentoItemDto> Itens,
    decimal Total,
    string Situacao,
    Guid? CupomId,
    int? CupomNumero,
    DateTime? FinalizadoEm,
    string CriadoPor,
    DateTime CriadoEm,
    DateTime AtualizadoEm);

public record ListaOrcamentos(List<OrcamentoDto> Itens, int Total, int Pagina, int TamanhoPagina);

/// <summary>
/// Orçamentos da empresa (mesma permissão dos cupons). Enquanto aberto, pode ser alterado ou excluído;
/// finalizar gera o cupom com os itens do orçamento (como itens avulsos: serviço, observação e data).
/// </summary>
public static class OrcamentoEndpoints
{
    private const int TamanhoPagina = 50;
    private const int MaximoItens = 200;
    private const decimal ValorMaximo = 999_999_999_999m;

    public static void MapOrcamentoEndpoints(this WebApplication app)
    {
        var grupo = app.MapGroup("/api/orcamentos").RequireAuthorization();
        grupo.MapGet("/", Listar);
        grupo.MapGet("/{id:guid}", Obter);
        grupo.MapPost("/", Criar);
        grupo.MapPut("/{id:guid}", Editar);
        grupo.MapDelete("/{id:guid}", Excluir);
        grupo.MapPost("/{id:guid}/finalizar", Finalizar);
    }

    /// <summary>Lista paginada, mais novos primeiro; busca pelo Nº, cliente ou serviço.</summary>
    private static async Task<IResult> Listar(ClaimsPrincipal user, OrionDbContext db, string? busca, int? pagina)
    {
        var (usuario, negado) = await Permissoes.Exigir(user, db, Permissoes.CupomFiscal);
        if (usuario is null) return negado!;

        var consulta = db.Orcamentos.Where(o => o.EmpresaId == usuario.EmpresaId);
        if (!string.IsNullOrWhiteSpace(busca))
        {
            var texto = busca.Trim();
            var termo = $"%{texto}%";
            var numero = int.TryParse(texto.TrimStart('0'), out var n) ? n : -1;
            consulta = consulta.Where(o =>
                o.Numero == numero
                || (o.ClienteNome != null && EF.Functions.ILike(EF.Functions.Unaccent(o.ClienteNome), EF.Functions.Unaccent(termo)))
                || o.Itens.Any(i => EF.Functions.ILike(EF.Functions.Unaccent(i.Servico), EF.Functions.Unaccent(termo))));
        }

        var numeroPagina = Math.Max(1, pagina ?? 1);
        var total = await consulta.CountAsync();
        var itens = await consulta
            .Include(o => o.Itens)
            .OrderByDescending(o => o.Numero)
            .Skip((numeroPagina - 1) * TamanhoPagina)
            .Take(TamanhoPagina)
            .AsSplitQuery()
            .ToListAsync();
        return Results.Ok(new ListaOrcamentos(itens.Select(Dto).ToList(), total, numeroPagina, TamanhoPagina));
    }

    private static async Task<IResult> Obter(Guid id, ClaimsPrincipal user, OrionDbContext db)
    {
        var (usuario, negado) = await Permissoes.Exigir(user, db, Permissoes.CupomFiscal);
        if (usuario is null) return negado!;
        var orcamento = await Carregar(db, id, usuario.EmpresaId);
        return orcamento is null ? Results.NotFound() : Results.Ok(Dto(orcamento));
    }

    private static async Task<IResult> Criar(OrcamentoRequest req, ClaimsPrincipal user, OrionDbContext db)
    {
        var (usuario, negado) = await Permissoes.Exigir(user, db, Permissoes.CupomFiscal);
        if (usuario is null) return negado!;

        var erros = Validar(req);
        if (erros.Count > 0) return Results.ValidationProblem(erros);

        var orcamento = new Orcamento { EmpresaId = usuario.EmpresaId, CriadoPor = usuario.Nome, UsuarioId = usuario.Id };
        var erro = await Preencher(db, orcamento, req, usuario.EmpresaId);
        if (erro is not null) return erro;
        db.Orcamentos.Add(orcamento);

        // O Nº é o maior da empresa + 1; se dois orçamentos forem salvos juntos, tenta de novo.
        for (var tentativa = 0; ; tentativa++)
        {
            orcamento.Numero = (await db.Orcamentos.Where(o => o.EmpresaId == orcamento.EmpresaId)
                .MaxAsync(o => (int?)o.Numero) ?? 0) + 1;
            try
            {
                await db.SaveChangesAsync();
                break;
            }
            catch (DbUpdateException ex) when (tentativa < 3
                && ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
            {
            }
        }
        return Results.Created($"/api/orcamentos/{orcamento.Id}", Dto(orcamento));
    }

    private static async Task<IResult> Editar(Guid id, OrcamentoRequest req, ClaimsPrincipal user, OrionDbContext db)
    {
        var (usuario, negado) = await Permissoes.Exigir(user, db, Permissoes.CupomFiscal);
        if (usuario is null) return negado!;

        var orcamento = await Carregar(db, id, usuario.EmpresaId);
        if (orcamento is null) return Results.NotFound();
        if (orcamento.Situacao != "aberto") return Results.Conflict(new { erro = "Este orçamento já foi finalizado" });

        var erros = Validar(req);
        if (erros.Count > 0) return Results.ValidationProblem(erros);

        db.OrcamentoItens.RemoveRange(orcamento.Itens);
        orcamento.Itens.Clear();
        var erro = await Preencher(db, orcamento, req, usuario.EmpresaId);
        if (erro is not null) return erro;
        // As linhas novas já nascem com Id: sem isto o EF acharia que são linhas antigas (e tentaria alterar)
        db.OrcamentoItens.AddRange(orcamento.Itens);
        orcamento.AtualizadoEm = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Results.Ok(Dto(orcamento));
    }

    private static async Task<IResult> Excluir(Guid id, ClaimsPrincipal user, OrionDbContext db)
    {
        var (usuario, negado) = await Permissoes.Exigir(user, db, Permissoes.CupomFiscal);
        if (usuario is null) return negado!;
        var orcamento = await db.Orcamentos.SingleOrDefaultAsync(o => o.Id == id && o.EmpresaId == usuario.EmpresaId);
        if (orcamento is null) return Results.NotFound();
        if (orcamento.Situacao != "aberto") return Results.Conflict(new { erro = "Orçamento finalizado não pode ser excluído" });
        db.Orcamentos.Remove(orcamento);
        await db.SaveChangesAsync();
        return Results.NoContent();
    }

    /// <summary>Gera o cupom com os itens do orçamento e marca o orçamento como finalizado.</summary>
    private static async Task<IResult> Finalizar(Guid id, FinalizarOrcamentoRequest req, ClaimsPrincipal user, OrionDbContext db)
    {
        var (usuario, negado) = await Permissoes.Exigir(user, db, Permissoes.CupomFiscal);
        if (usuario is null) return negado!;

        var orcamento = await Carregar(db, id, usuario.EmpresaId);
        if (orcamento is null) return Results.NotFound();
        if (orcamento.Situacao != "aberto") return Results.Conflict(new { erro = "Este orçamento já foi finalizado" });
        if (orcamento.Itens.Count == 0) return Erro("itens", "Adicione pelo menos um serviço");

        Cliente? cliente = orcamento.ClienteId is { } clienteId
            ? await db.Clientes.SingleOrDefaultAsync(c => c.Id == clienteId && c.EmpresaId == usuario.EmpresaId)
            : null;

        var pedido = new CupomRequest(
            ClienteId: cliente?.Id,
            ClienteNome: orcamento.ClienteNome,
            ClienteDocumento: cliente?.Documento,
            ClienteEndereco: cliente is null ? null : CupomEndpoints.EnderecoDo(cliente),
            Itens: orcamento.Itens.OrderBy(i => i.Ordem)
                .Select(i => new CupomItemRequest(null, i.Servico, i.Quantidade, i.Preco, i.Observacao, i.Data))
                .ToList(),
            Valor: null,
            Desconto: null,
            FormaPagamento: req.FormaPagamento,
            ValorRecebido: null,
            Referente: $"Orçamento Nº {orcamento.Numero:D6}",
            Observacao: orcamento.Observacao);
        var (cupom, erro) = await CupomEndpoints.Criar(usuario, pedido, db);
        if (cupom is null) return erro!;

        orcamento.Situacao = "finalizado";
        orcamento.CupomId = cupom.Id;
        orcamento.CupomNumero = cupom.Numero;
        orcamento.FinalizadoEm = DateTime.UtcNow;
        orcamento.AtualizadoEm = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Results.Ok(Dto(orcamento));
    }

    private static Task<Orcamento?> Carregar(OrionDbContext db, Guid id, Guid empresaId) =>
        db.Orcamentos.Include(o => o.Itens).SingleOrDefaultAsync(o => o.Id == id && o.EmpresaId == empresaId);

    /// <summary>Copia o pedido para o orçamento (cliente, observação, itens e total). Erro se o cliente não existir.</summary>
    private static async Task<IResult?> Preencher(OrionDbContext db, Orcamento orcamento, OrcamentoRequest req, Guid empresaId)
    {
        Cliente? cliente = null;
        if (req.ClienteId is { } clienteId)
        {
            cliente = await db.Clientes.SingleOrDefaultAsync(c => c.Id == clienteId && c.EmpresaId == empresaId);
            if (cliente is null) return Erro("clienteNome", "Este cliente não existe mais");
        }
        orcamento.ClienteId = cliente?.Id;
        orcamento.ClienteNome = Opcional(req.ClienteNome) ?? cliente?.Nome;
        orcamento.Observacao = Opcional(req.Observacao);

        var posicao = 0;
        foreach (var item in req.Itens ?? [])
        {
            var quantidade = Math.Round(item.Quantidade, 3);
            var preco = Math.Round(item.Preco, 2);
            orcamento.Itens.Add(new OrcamentoItem
            {
                Ordem = ++posicao,
                Servico = item.Servico!.Trim(),
                Observacao = Opcional(item.Observacao),
                Preco = preco,
                Quantidade = quantidade,
                Data = item.Data,
                Total = Math.Round(quantidade * preco, 2),
            });
        }
        orcamento.Total = orcamento.Itens.Sum(i => i.Total);
        return null;
    }

    private static Dictionary<string, string[]> Validar(OrcamentoRequest req)
    {
        var erros = new Dictionary<string, string[]>();
        var itens = req.Itens ?? [];
        if (itens.Count > MaximoItens) erros["itens"] = [$"No máximo {MaximoItens} linhas"];
        for (var i = 0; i < itens.Count && !erros.ContainsKey("itens"); i++)
        {
            var item = itens[i];
            var servico = item.Servico?.Trim() ?? "";
            if (servico.Length == 0) erros["itens"] = [$"Linha {i + 1}: digite o serviço"];
            else if (servico.Length > 200) erros["itens"] = [$"Linha {i + 1}: serviço com no máximo 200 letras"];
            else if ((item.Observacao?.Trim().Length ?? 0) > 500) erros["itens"] = [$"Linha {i + 1}: observação com no máximo 500 letras"];
            else if (item.Quantidade <= 0) erros["itens"] = [$"Linha {i + 1}: a quantidade precisa ser maior que zero"];
            else if (item.Preco < 0) erros["itens"] = [$"Linha {i + 1}: o preço não pode ser negativo"];
            else if (item.Quantidade > 999_999_999m || item.Preco > ValorMaximo) erros["itens"] = [$"Linha {i + 1}: valor muito alto"];
        }
        if ((req.ClienteNome?.Trim().Length ?? 0) > 200) erros["clienteNome"] = ["Máximo de 200 letras"];
        if ((req.Observacao?.Trim().Length ?? 0) > 1000) erros["observacao"] = ["Máximo de 1000 letras"];
        return erros;
    }

    private static IResult Erro(string campo, string mensagem) =>
        Results.ValidationProblem(new Dictionary<string, string[]> { [campo] = [mensagem] });

    private static string? Opcional(string? valor) => string.IsNullOrWhiteSpace(valor) ? null : valor.Trim();

    private static OrcamentoDto Dto(Orcamento o) => new(
        o.Id, o.Numero, o.ClienteId, o.ClienteNome, o.Observacao,
        o.Itens.OrderBy(i => i.Ordem)
            .Select(i => new OrcamentoItemDto(i.Id, i.Servico, i.Observacao, i.Preco, i.Quantidade, i.Data, i.Total))
            .ToList(),
        o.Total, o.Situacao, o.CupomId, o.CupomNumero, o.FinalizadoEm, o.CriadoPor, o.CriadoEm, o.AtualizadoEm);
}
