using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Orion.Api.Auth;
using Orion.Api.Data;

namespace Orion.Api.Produtos;

public record OrdemImagensRequest(List<Guid> Ids);

/// <summary>
/// Imagens de um produto: a primeira (Ordem 0) é a capa. Enviar: "produtos-cadastrar" ou "produtos-editar"
/// (o produto novo recebe as imagens logo depois de cadastrado); reordenar e excluir: "produtos-editar".
/// </summary>
public static class ProdutoImagemEndpoints
{
    public const int MaximoPorProduto = 10;
    /// <summary>O site reduz as fotos antes de enviar (até 1600px); isto é só o teto.</summary>
    public const int TamanhoMaximo = 5 * 1024 * 1024;

    public static void MapProdutoImagemEndpoints(this WebApplication app)
    {
        var grupo = app.MapGroup("/api/produtos/{produtoId:guid}/imagens").RequireAuthorization();
        // Login por token (Bearer), sem cookie: o envio de arquivo não precisa de antiforgery.
        grupo.MapPost("/", Enviar).DisableAntiforgery();
        grupo.MapPut("/ordem", Ordenar);
        grupo.MapDelete("/{id:guid}", Excluir);

        // A tag <img> não manda o token: o endereço é aberto, mas o id é aleatório (não dá para adivinhar).
        app.MapGet("/api/produtos/imagens/{id:guid}", Baixar);
    }

    private static async Task<IResult> Enviar(Guid produtoId, IFormFile? arquivo, ClaimsPrincipal user, OrionDbContext db)
    {
        var usuario = await UsuarioAtual.Carregar(user, db);
        if (usuario is null) return Results.Unauthorized();
        if (!Permissoes.Tem(usuario, Permissoes.ProdutosCadastrar) && !Permissoes.Tem(usuario, Permissoes.ProdutosEditar))
            return Results.Json(new { erro = "Você não tem permissão para isso" }, statusCode: StatusCodes.Status403Forbidden);

        if (!await db.Produtos.AnyAsync(p => p.Id == produtoId && p.EmpresaId == usuario.EmpresaId))
            return ProdutoNaoEncontrado;
        if (arquivo is null || arquivo.Length == 0) return Erro("Escolha uma imagem");
        if (arquivo.Length > TamanhoMaximo) return Erro("Imagem grande demais (máximo de 5 MB)");

        var ordens = await db.ProdutoImagens.Where(i => i.ProdutoId == produtoId).Select(i => i.Ordem).ToListAsync();
        if (ordens.Count >= MaximoPorProduto) return Erro($"Máximo de {MaximoPorProduto} imagens por produto");

        using var memoria = new MemoryStream();
        await arquivo.CopyToAsync(memoria);
        var dados = memoria.ToArray();
        var tipo = TipoDaImagem(dados);
        if (tipo is null) return Erro("Envie uma imagem JPG, PNG, WEBP ou GIF");

        var imagem = new ProdutoImagem
        {
            ProdutoId = produtoId,
            Ordem = ordens.Count == 0 ? 0 : ordens.Max() + 1,
            TipoConteudo = tipo,
            Dados = dados,
        };
        db.ProdutoImagens.Add(imagem);
        await db.SaveChangesAsync();
        return Results.Created($"/api/produtos/imagens/{imagem.Id}", new { imagem.Id });
    }

    /// <summary>Recebe todos os ids do produto na nova ordem (o primeiro vira a capa).</summary>
    private static async Task<IResult> Ordenar(Guid produtoId, OrdemImagensRequest req, ClaimsPrincipal user, OrionDbContext db)
    {
        var (usuario, negado) = await Permissoes.Exigir(user, db, Permissoes.ProdutosEditar);
        if (usuario is null) return negado!;
        if (!await db.Produtos.AnyAsync(p => p.Id == produtoId && p.EmpresaId == usuario.EmpresaId))
            return ProdutoNaoEncontrado;

        var imagens = await db.ProdutoImagens.Where(i => i.ProdutoId == produtoId).ToListAsync();
        var ids = req.Ids ?? [];
        if (ids.Count != imagens.Count || ids.Distinct().Count() != ids.Count || !imagens.All(i => ids.Contains(i.Id)))
            return Erro("A lista de imagens mudou. Abra o produto de novo.");

        foreach (var imagem in imagens) imagem.Ordem = ids.IndexOf(imagem.Id);
        await db.SaveChangesAsync();
        return Results.NoContent();
    }

    private static async Task<IResult> Excluir(Guid produtoId, Guid id, ClaimsPrincipal user, OrionDbContext db)
    {
        var (usuario, negado) = await Permissoes.Exigir(user, db, Permissoes.ProdutosEditar);
        if (usuario is null) return negado!;
        var apagadas = await db.ProdutoImagens
            .Where(i => i.Id == id && i.ProdutoId == produtoId && i.Produto!.EmpresaId == usuario.EmpresaId)
            .ExecuteDeleteAsync();
        return apagadas == 0
            ? Results.NotFound(new { erro = "Imagem não encontrada", campo = "imagens" })
            : Results.NoContent();
    }

    private static async Task<IResult> Baixar(Guid id, HttpContext contexto, OrionDbContext db)
    {
        var imagem = await db.ProdutoImagens.Where(i => i.Id == id)
            .Select(i => new { i.TipoConteudo, i.Dados })
            .SingleOrDefaultAsync();
        if (imagem is null) return Results.NotFound();
        // A imagem de um id nunca muda (trocar = enviar outra): o navegador pode guardar para sempre.
        contexto.Response.Headers.CacheControl = "public, max-age=31536000, immutable";
        contexto.Response.Headers.XContentTypeOptions = "nosniff";
        return Results.File(imagem.Dados, imagem.TipoConteudo);
    }

    /// <summary>Ids das imagens de cada produto, na ordem da galeria (capa primeiro).</summary>
    public static async Task<Dictionary<Guid, List<Guid>>> IdsPorProduto(OrionDbContext db, ICollection<Guid> produtos) =>
        (await db.ProdutoImagens
            .Where(i => produtos.Contains(i.ProdutoId))
            .OrderBy(i => i.Ordem).ThenBy(i => i.CriadoEm)
            .Select(i => new { i.ProdutoId, i.Id })
            .ToListAsync())
        .GroupBy(i => i.ProdutoId)
        .ToDictionary(g => g.Key, g => g.Select(i => i.Id).ToList());

    /// <summary>Tipo pelo começo do arquivo (não confia na extensão nem no que o navegador diz).</summary>
    private static string? TipoDaImagem(byte[] d) => d switch
    {
        [0xFF, 0xD8, 0xFF, ..] => "image/jpeg",
        [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, ..] => "image/png",
        [0x47, 0x49, 0x46, 0x38, ..] => "image/gif",
        [0x52, 0x49, 0x46, 0x46, _, _, _, _, 0x57, 0x45, 0x42, 0x50, ..] => "image/webp",
        _ => null,
    };

    // 404 sempre com mensagem: o site entende 404 sem mensagem como "API desatualizada, sem as rotas de imagem".
    private static IResult ProdutoNaoEncontrado =>
        Results.NotFound(new { erro = "Produto não encontrado (pode ter sido excluído)", campo = "imagens" });

    private static IResult Erro(string mensagem) => Results.BadRequest(new { erro = mensagem, campo = "imagens" });
}
