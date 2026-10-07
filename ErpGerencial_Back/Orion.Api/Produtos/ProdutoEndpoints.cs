using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Orion.Api.Auth;
using Orion.Api.Data;

namespace Orion.Api.Produtos;

public record ProdutoRequest(
    string Nome,
    string? Codigo,
    decimal? PrecoCusto,
    decimal? PrecoVendaPf,
    decimal? PrecoVendaPj,
    decimal? Quantidade,
    string? Marca,
    string? Modelo,
    string? Cor,
    string? Voltagem,
    string? Observacao);

public record ProdutoDto(
    Guid Id,
    int Numero,
    string Nome,
    string? Codigo,
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
    DateTime AtualizadoEm);

public record ListaProdutos(List<ProdutoDto> Itens, int Total, int Pagina, int TamanhoPagina);

/// <summary>
/// Produtos da empresa. Ver: permissão "produtos"; cadastrar: "produtos-cadastrar";
/// editar e excluir: "produtos-editar" (o administrador pode tudo).
/// </summary>
public static class ProdutoEndpoints
{
    private const int TamanhoPagina = 50;
    private const string CodigoDuplicado = "Já existe um produto com este código";

    public static void MapProdutoEndpoints(this WebApplication app)
    {
        var grupo = app.MapGroup("/api/produtos").RequireAuthorization();
        grupo.MapGet("/", Listar);
        grupo.MapGet("/{id:guid}", Obter);
        grupo.MapPost("/", Criar);
        grupo.MapPut("/{id:guid}", Editar);
        grupo.MapDelete("/{id:guid}", Excluir);
    }

    /// <summary>Lista paginada (50 por página), mais novos primeiro; busca por nome, código, marca ou modelo.</summary>
    private static async Task<IResult> Listar(ClaimsPrincipal user, OrionDbContext db, string? busca, int? pagina)
    {
        var (usuario, negado) = await Permitido(user, db, Permissoes.Produtos);
        if (usuario is null) return negado!;

        var consulta = db.Produtos.Where(p => p.EmpresaId == usuario.EmpresaId);
        if (!string.IsNullOrWhiteSpace(busca))
        {
            var termo = $"%{busca.Trim()}%";
            consulta = consulta.Where(p =>
                EF.Functions.ILike(p.Nome, termo)
                || (p.Codigo != null && EF.Functions.ILike(p.Codigo, termo))
                || (p.Marca != null && EF.Functions.ILike(p.Marca, termo))
                || (p.Modelo != null && EF.Functions.ILike(p.Modelo, termo)));
        }

        var numeroPagina = Math.Max(1, pagina ?? 1);
        var total = await consulta.CountAsync();
        var itens = await consulta
            .OrderByDescending(p => p.Numero)
            .Skip((numeroPagina - 1) * TamanhoPagina)
            .Take(TamanhoPagina)
            .ToListAsync();
        return Results.Ok(new ListaProdutos(itens.Select(Dto).ToList(), total, numeroPagina, TamanhoPagina));
    }

    private static async Task<IResult> Obter(Guid id, ClaimsPrincipal user, OrionDbContext db)
    {
        var (usuario, negado) = await Permitido(user, db, Permissoes.Produtos);
        if (usuario is null) return negado!;
        var produto = await db.Produtos.SingleOrDefaultAsync(p => p.Id == id && p.EmpresaId == usuario.EmpresaId);
        return produto is null ? Results.NotFound() : Results.Ok(Dto(produto));
    }

    private static async Task<IResult> Criar(ProdutoRequest req, ClaimsPrincipal user, OrionDbContext db)
    {
        var (usuario, negado) = await Permitido(user, db, Permissoes.ProdutosCadastrar);
        if (usuario is null) return negado!;

        var erros = Validar(req);
        if (erros.Count > 0) return Results.ValidationProblem(erros);

        var produto = new Produto { EmpresaId = usuario.EmpresaId!.Value, Nome = "" };
        Preencher(produto, req);
        db.Produtos.Add(produto);

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
                if (pg.ConstraintName?.Contains("codigo") == true)
                    return Results.Conflict(new { erro = CodigoDuplicado, campo = "codigo" });
                if (tentativa >= 3) throw;
            }
        }

        return Results.Created($"/api/produtos/{produto.Id}", Dto(produto));
    }

    private static async Task<IResult> Editar(Guid id, ProdutoRequest req, ClaimsPrincipal user, OrionDbContext db)
    {
        var (usuario, negado) = await Permitido(user, db, Permissoes.ProdutosEditar);
        if (usuario is null) return negado!;

        var produto = await db.Produtos.SingleOrDefaultAsync(p => p.Id == id && p.EmpresaId == usuario.EmpresaId);
        if (produto is null) return Results.NotFound();

        var erros = Validar(req);
        if (erros.Count > 0) return Results.ValidationProblem(erros);

        Preencher(produto, req);
        produto.AtualizadoEm = DateTime.UtcNow;
        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            return Results.Conflict(new { erro = CodigoDuplicado, campo = "codigo" });
        }
        return Results.Ok(Dto(produto));
    }

    private static async Task<IResult> Excluir(Guid id, ClaimsPrincipal user, OrionDbContext db)
    {
        var (usuario, negado) = await Permitido(user, db, Permissoes.ProdutosEditar);
        if (usuario is null) return negado!;
        var apagados = await db.Produtos.Where(p => p.Id == id && p.EmpresaId == usuario.EmpresaId).ExecuteDeleteAsync();
        return apagados == 0 ? Results.NotFound() : Results.NoContent();
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
        Valor("quantidade", req.Quantidade);
        return erros;
    }

    private static void Preencher(Produto p, ProdutoRequest req)
    {
        static string? Opcional(string? valor) => string.IsNullOrWhiteSpace(valor) ? null : valor.Trim();
        p.Nome = req.Nome.Trim();
        p.Codigo = Opcional(req.Codigo);
        p.PrecoCusto = Math.Round(req.PrecoCusto ?? 0, 2);
        p.PrecoVendaPf = Math.Round(req.PrecoVendaPf ?? 0, 2);
        p.PrecoVendaPj = Math.Round(req.PrecoVendaPj ?? 0, 2);
        p.Quantidade = Math.Round(req.Quantidade ?? 0, 3);
        p.Marca = Opcional(req.Marca);
        p.Modelo = Opcional(req.Modelo);
        p.Cor = Opcional(req.Cor);
        p.Voltagem = Opcional(req.Voltagem);
        p.Observacao = Opcional(req.Observacao);
    }

    /// <summary>Quem chamou, se tiver empresa e a permissão; senão, a resposta de erro.</summary>
    private static async Task<(Usuario? Usuario, IResult? Negado)> Permitido(
        ClaimsPrincipal user, OrionDbContext db, string permissao)
    {
        var usuario = await UsuarioAtual.Carregar(user, db);
        if (usuario is null) return (null, Results.Unauthorized());
        if (usuario.EmpresaId is null || !Permissoes.Tem(usuario, permissao))
            return (null, Results.Json(new { erro = "Você não tem permissão para isso" },
                statusCode: StatusCodes.Status403Forbidden));
        return (usuario, null);
    }

    private static ProdutoDto Dto(Produto p) =>
        new(p.Id, p.Numero, p.Nome, p.Codigo, p.PrecoCusto, p.PrecoVendaPf, p.PrecoVendaPj, p.Quantidade,
            p.Marca, p.Modelo, p.Cor, p.Voltagem, p.Observacao, p.CriadoEm, p.AtualizadoEm);
}
