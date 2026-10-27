using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Orion.Api.Auth;
using Orion.Api.Data;

namespace Orion.Api.Produtos;

public record ProdutoRequest(
    string Nome,
    string? Codigo,
    string? CodigoBarras,
    decimal? PrecoCusto,
    decimal? PrecoVendaPf,
    decimal? PrecoVendaPj,
    decimal? Quantidade,
    string? Marca,
    string? Modelo,
    string? Cor,
    string? Voltagem,
    string? Observacao,
    string? Unidade = null,
    decimal? EstoqueMinimo = null);

public record ProdutoDto(
    Guid Id,
    int Numero,
    string Nome,
    string? Codigo,
    string? CodigoBarras,
    decimal PrecoCusto,
    decimal PrecoVendaPf,
    decimal PrecoVendaPj,
    decimal Quantidade,
    string? Marca,
    string? Modelo,
    string? Cor,
    string? Voltagem,
    string? Observacao,
    DateTime CriadoEm,
    DateTime AtualizadoEm,
    /// <summary>Ids das imagens na ordem da galeria; a primeira é a capa (endereço: /api/produtos/imagens/{id}).</summary>
    List<Guid> Imagens,
    string Unidade,
    decimal EstoqueMinimo,
    /// <summary>Quantidade no mínimo ou abaixo dele.</summary>
    bool EstoqueBaixo);

public record ListaProdutos(List<ProdutoDto> Itens, int Total, int Pagina, int TamanhoPagina);

/// <summary>
/// Produtos da empresa. Ver: permissão "produtos"; cadastrar: "produtos-cadastrar";
/// editar e excluir: "produtos-editar" (o administrador pode tudo).
/// </summary>
public static class ProdutoEndpoints
{
    private const int TamanhoPagina = 50;
    private const string CodigoDuplicado = "Já existe um produto com este código";
    private const string CodigoBarrasDuplicado = "Já existe um produto com este código de barras";

    public static void MapProdutoEndpoints(this WebApplication app)
    {
        var grupo = app.MapGroup("/api/produtos").RequireAuthorization();
        grupo.MapGet("/", Listar);
        grupo.MapGet("/{id:guid}", Obter);
        grupo.MapPost("/", Criar);
        grupo.MapPut("/{id:guid}", Editar);
        grupo.MapDelete("/{id:guid}", Excluir);
    }

    /// <summary>Lista paginada (50 por página), mais novos primeiro; busca por nome, código, código de barras, marca ou modelo.</summary>
    private static async Task<IResult> Listar(
        ClaimsPrincipal user, OrionDbContext db, string? busca, int? pagina)
    {
        var (usuario, negado) = await Permissoes.Exigir(user, db, Permissoes.Produtos);
        if (usuario is null) return negado!;

        var consulta = db.Produtos.Where(p => p.EmpresaId == usuario.EmpresaId);
        if (!string.IsNullOrWhiteSpace(busca))
        {
            var termo = $"%{busca.Trim()}%";
            consulta = consulta.Where(p =>
                EF.Functions.ILike(EF.Functions.Unaccent(p.Nome), EF.Functions.Unaccent(termo))
                || (p.Codigo != null && EF.Functions.ILike(EF.Functions.Unaccent(p.Codigo), EF.Functions.Unaccent(termo)))
                || (p.CodigoBarras != null && EF.Functions.ILike(EF.Functions.Unaccent(p.CodigoBarras), EF.Functions.Unaccent(termo)))
                || (p.Marca != null && EF.Functions.ILike(EF.Functions.Unaccent(p.Marca), EF.Functions.Unaccent(termo)))
                || (p.Modelo != null && EF.Functions.ILike(EF.Functions.Unaccent(p.Modelo), EF.Functions.Unaccent(termo))));
        }

        var numeroPagina = Math.Max(1, pagina ?? 1);
        var total = await consulta.CountAsync();
        // O produto com o código (ou código de barras) igual ao buscado vem primeiro (ex.: leitura do leitor).
        var exato = busca?.Trim() ?? "";
        var itens = await consulta
            .OrderByDescending(p => p.CodigoBarras == exato || p.Codigo == exato)
            .ThenByDescending(p => p.Numero)
            .Skip((numeroPagina - 1) * TamanhoPagina)
            .Take(TamanhoPagina)
            .ToListAsync();
        var imagens = await ProdutoImagemEndpoints.IdsPorProduto(db, itens.Select(p => p.Id).ToList());
        return Results.Ok(new ListaProdutos(
            itens.Select(p => Dto(p, imagens.GetValueOrDefault(p.Id))).ToList(), total, numeroPagina, TamanhoPagina));
    }

    private static async Task<IResult> Obter(Guid id, ClaimsPrincipal user, OrionDbContext db)
    {
        var (usuario, negado) = await Permissoes.Exigir(user, db, Permissoes.Produtos);
        if (usuario is null) return negado!;
        var produto = await db.Produtos.SingleOrDefaultAsync(p => p.Id == id && p.EmpresaId == usuario.EmpresaId);
        return produto is null ? Results.NotFound() : Results.Ok(await DtoComImagens(db, produto));
    }

    private static async Task<IResult> Criar(ProdutoRequest req, ClaimsPrincipal user, OrionDbContext db)
    {
        var (usuario, negado) = await Permissoes.Exigir(user, db, Permissoes.ProdutosCadastrar);
        if (usuario is null) return negado!;

        var erros = Validar(req);
        if (erros.Count > 0) return Results.ValidationProblem(erros);

        var produto = new Produto { EmpresaId = usuario.EmpresaId, Nome = "" };
        Preencher(produto, req);
        db.Produtos.Add(produto);
        // O estoque inicial também fica no histórico de movimentações
        var inicial = produto.Quantidade;
        produto.Quantidade = 0;
        if (inicial != 0) Estoque.Movimentar(db, produto, "inicial", inicial, usuario, produto.PrecoCusto);

        // O ID sequencial é o maior da empresa + 1; se dois cadastros chegarem juntos, tenta de novo.
        for (var tentativa = 0; ; tentativa++)
        {
            produto.Numero = (await db.Produtos.Where(p => p.EmpresaId == produto.EmpresaId)
                .MaxAsync(p => (int?)p.Numero) ?? 0) + 1;
            try
            {
                await db.SaveChangesAsync();
                break;
            }
            catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation } pg)
            {
                if (Duplicado(pg) is { } conflito) return conflito;
                if (tentativa >= 3) throw;
            }
        }

        return Results.Created($"/api/produtos/{produto.Id}", Dto(produto, []));
    }

    private static async Task<IResult> Editar(Guid id, ProdutoRequest req, ClaimsPrincipal user, OrionDbContext db)
    {
        var (usuario, negado) = await Permissoes.Exigir(user, db, Permissoes.ProdutosEditar);
        if (usuario is null) return negado!;

        var produto = await db.Produtos.SingleOrDefaultAsync(p => p.Id == id && p.EmpresaId == usuario.EmpresaId);
        if (produto is null) return Results.NotFound();

        var erros = Validar(req);
        if (erros.Count > 0) return Results.ValidationProblem(erros);

        var quantidadeAntes = produto.Quantidade;
        Preencher(produto, req);
        // Quantidade mudada no cadastro: vira um ajuste no histórico
        var novaQuantidade = produto.Quantidade;
        produto.Quantidade = quantidadeAntes;
        if (novaQuantidade != quantidadeAntes)
            Estoque.Movimentar(db, produto, "ajuste", novaQuantidade - quantidadeAntes, usuario, observacao: "Alterado no cadastro do produto");
        produto.AtualizadoEm = DateTime.UtcNow;
        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation } pg)
        {
            return Duplicado(pg) ?? Results.Conflict(new { erro = CodigoDuplicado, campo = "codigo" });
        }
        return Results.Ok(await DtoComImagens(db, produto));
    }

    private static async Task<IResult> Excluir(Guid id, ClaimsPrincipal user, OrionDbContext db)
    {
        var (usuario, negado) = await Permissoes.Exigir(user, db, Permissoes.ProdutosEditar);
        if (usuario is null) return negado!;
        var apagados = await db.Produtos.Where(p => p.Id == id && p.EmpresaId == usuario.EmpresaId).ExecuteDeleteAsync();
        return apagados == 0 ? Results.NotFound() : Results.NoContent();
    }

    /// <summary>Código ou código de barras repetido na empresa (null: foi outro índice, ex.: o ID sequencial).</summary>
    private static IResult? Duplicado(PostgresException pg) => pg.ConstraintName switch
    {
        { } nome when nome.Contains("codigo_barras") => Results.Conflict(new { erro = CodigoBarrasDuplicado, campo = "codigoBarras" }),
        { } nome when nome.Contains("codigo") => Results.Conflict(new { erro = CodigoDuplicado, campo = "codigo" }),
        _ => null,
    };

    /// <summary>
    /// EAN-8, UPC-A (12), EAN-13 e GTIN-14 terminam num dígito verificador: se não bater, a leitura saiu errada.
    /// Outros formatos (com letras ou outro tamanho) são aceitos como estão.
    /// </summary>
    public static bool CodigoBarrasValido(string codigo)
    {
        if (!codigo.All(char.IsAsciiDigit) || codigo.Length is not (8 or 12 or 13 or 14)) return true;
        var soma = 0;
        for (var i = codigo.Length - 2; i >= 0; i--)
            soma += (codigo[i] - '0') * ((codigo.Length - 2 - i) % 2 == 0 ? 3 : 1);
        return (10 - soma % 10) % 10 == codigo[^1] - '0';
    }

    private static Dictionary<string, string[]> Validar(ProdutoRequest req)
    {
        var erros = new Dictionary<string, string[]>();
        var nome = req.Nome?.Trim() ?? "";
        if (nome.Length == 0) erros["nome"] = ["Digite o nome"];
        else if (nome.Length > 200) erros["nome"] = ["Máximo de 200 letras"];

        void Tamanho(string campo, string? valor, int maximo)
        {
            if ((valor?.Trim().Length ?? 0) > maximo) erros[campo] = [$"Máximo de {maximo} letras"];
        }
        Tamanho("codigo", req.Codigo, 60);
        Tamanho("codigoBarras", req.CodigoBarras, 50);
        var barras = req.CodigoBarras?.Trim() ?? "";
        if (barras.Length is > 0 and <= 50 && !CodigoBarrasValido(barras))
            erros["codigoBarras"] = ["Código de barras inválido (confira a leitura)"];
        Tamanho("marca", req.Marca, 80);
        Tamanho("modelo", req.Modelo, 80);
        Tamanho("cor", req.Cor, 50);
        Tamanho("voltagem", req.Voltagem, 30);
        Tamanho("observacao", req.Observacao, 2000);

        void Valor(string campo, decimal? valor)
        {
            if (valor is < 0) erros[campo] = ["Não pode ser negativo"];
            else if (valor is > 999_999_999_999m) erros[campo] = ["Valor muito alto"];
        }
        Valor("precoCusto", req.PrecoCusto);
        Valor("precoVendaPf", req.PrecoVendaPf);
        Valor("precoVendaPj", req.PrecoVendaPj);
        if (req.Quantidade is < -999_999_999m or > 999_999_999m) erros["quantidade"] = ["Quantidade inválida"];
        Valor("estoqueMinimo", req.EstoqueMinimo);

        var unidade = req.Unidade?.Trim() ?? "";
        if (unidade.Length > 6) erros["unidade"] = ["Máximo de 6 letras"];
        return erros;
    }

    private static void Preencher(Produto p, ProdutoRequest req)
    {
        static string? Opcional(string? valor) => string.IsNullOrWhiteSpace(valor) ? null : valor.Trim();
        p.Nome = req.Nome.Trim();
        p.Codigo = Opcional(req.Codigo);
        p.CodigoBarras = Opcional(req.CodigoBarras);
        p.PrecoCusto = Math.Round(req.PrecoCusto ?? 0, 2);
        p.PrecoVendaPf = Math.Round(req.PrecoVendaPf ?? 0, 2);
        p.PrecoVendaPj = Math.Round(req.PrecoVendaPj ?? 0, 2);
        p.Quantidade = Math.Round(req.Quantidade ?? 0, 3);
        p.Marca = Opcional(req.Marca);
        p.Modelo = Opcional(req.Modelo);
        p.Cor = Opcional(req.Cor);
        p.Voltagem = Opcional(req.Voltagem);
        p.Observacao = Opcional(req.Observacao);
        p.Unidade = Opcional(req.Unidade)?.ToUpperInvariant() ?? "UN";
        p.EstoqueMinimo = Math.Round(req.EstoqueMinimo ?? 0, 3);
    }

    private static ProdutoDto Dto(Produto p, List<Guid>? imagens) =>
        new(p.Id, p.Numero, p.Nome, p.Codigo, p.CodigoBarras, p.PrecoCusto, p.PrecoVendaPf, p.PrecoVendaPj, p.Quantidade,
            p.Marca, p.Modelo, p.Cor, p.Voltagem, p.Observacao, p.CriadoEm, p.AtualizadoEm, imagens ?? [],
            p.Unidade, p.EstoqueMinimo, Estoque.Baixo(p));

    private static async Task<ProdutoDto> DtoComImagens(OrionDbContext db, Produto p) =>
        Dto(p, (await ProdutoImagemEndpoints.IdsPorProduto(db, [p.Id])).GetValueOrDefault(p.Id));
}
