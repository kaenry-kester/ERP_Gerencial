using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Orion.Api.Auth;
using Orion.Api.Data;

namespace Orion.Api.WhatsApp;

public record ConfiguracaoWhatsappRequest(string? Remetente, string? Mensagem);

public record EnvioDto(
    Guid Id,
    Guid ClienteId,
    string ClienteNome,
    string Telefone,
    DateOnly DataReferencia,
    string Tipo,
    string Mensagem,
    string Status,
    string? Erro,
    DateTime CriadoEm);

/// <summary>ImagemId: imagem da mensagem padrão (ver /api/whatsapp/imagens/{id}); vazio quando não tem.</summary>
public record ConfiguracaoWhatsappDto(string? Remetente, string? Mensagem, Guid? ImagemId, List<EnvioDto> Envios);

/// <summary>
/// Mensagem automática da empresa (WhatsApp): a mensagem padrão, o número remetente e os últimos
/// clientes que receberam a mensagem. Quem pode editar clientes pode mexer aqui; o histórico de um
/// cliente (GET /api/clientes/{id}/envios) abre para quem pode ver clientes.
/// Quem envia de fato é o robô em Python (ErpGerencial_Automacao/lembretes.py), que lê esta
/// configuração no banco e grava cada envio em envios_whatsapp.
/// </summary>
public static class WhatsAppEndpoints
{
    private const int TamanhoMaximo = 1000;
    /// <summary>"Últimos envios": os 15 clientes que receberam a mensagem mais recentemente (um envio por cliente).</summary>
    private const int UltimosClientes = 15;

    public static void MapWhatsAppEndpoints(this WebApplication app)
    {
        var grupo = app.MapGroup("/api/whatsapp").RequireAuthorization();
        grupo.MapGet("/", Obter);
        grupo.MapPut("/", Salvar);
        app.MapGet("/api/clientes/{clienteId:guid}/envios", EnviosDoCliente).RequireAuthorization();

        // Imagem da mensagem (vai como foto, com o texto de legenda): a da mensagem padrão e a de cada cliente.
        // Login por token (Bearer), sem cookie: o envio de arquivo não precisa de antiforgery.
        grupo.MapPut("/imagem", (IFormFile? arquivo, ClaimsPrincipal user, OrionDbContext db) =>
            SalvarImagem(null, arquivo, user, db)).DisableAntiforgery();
        grupo.MapDelete("/imagem", (ClaimsPrincipal user, OrionDbContext db) => ExcluirImagem(null, user, db));
        app.MapPut("/api/clientes/{clienteId:guid}/mensagem/imagem",
            (Guid clienteId, IFormFile? arquivo, ClaimsPrincipal user, OrionDbContext db) =>
                SalvarImagem(clienteId, arquivo, user, db)).RequireAuthorization().DisableAntiforgery();
        app.MapDelete("/api/clientes/{clienteId:guid}/mensagem/imagem",
            (Guid clienteId, ClaimsPrincipal user, OrionDbContext db) => ExcluirImagem(clienteId, user, db))
            .RequireAuthorization();
        // A tag <img> não manda o token: o endereço é aberto, mas o id é aleatório (não dá para adivinhar).
        app.MapGet("/api/whatsapp/imagens/{id:guid}", BaixarImagem);
    }

    /// <summary>O site reduz a imagem antes de enviar; isto é só o teto.</summary>
    private const int ImagemTamanhoMaximo = 5 * 1024 * 1024;

    /// <summary>Envia (ou troca) a imagem da mensagem padrão (clienteId vazio) ou da mensagem de um cliente.</summary>
    private static async Task<IResult> SalvarImagem(Guid? clienteId, IFormFile? arquivo, ClaimsPrincipal user, OrionDbContext db)
    {
        var (usuario, negado) = await Permissoes.Exigir(user, db, Permissoes.ClientesEditar);
        if (usuario is null) return negado!;
        if (clienteId is { } id && !await db.Clientes.AnyAsync(c => c.Id == id && c.EmpresaId == usuario.EmpresaId))
            return Results.NotFound(new { erro = "Cliente não encontrado (pode ter sido excluído)", campo = "imagem" });
        if (arquivo is null || arquivo.Length == 0) return ErroImagem("Escolha uma imagem");
        if (arquivo.Length > ImagemTamanhoMaximo) return ErroImagem("Imagem grande demais (máximo de 5 MB)");

        using var memoria = new MemoryStream();
        await arquivo.CopyToAsync(memoria);
        var dados = memoria.ToArray();
        var tipo = Clientes.ClienteEndpoints.TipoDaFoto(dados);
        if (tipo is null) return ErroImagem("Envie uma imagem JPG, PNG ou WEBP");

        // Trocar = apagar a antiga e gravar outra (id novo: o navegador não mostra a antiga guardada).
        await Imagens(db, usuario.EmpresaId, clienteId).ExecuteDeleteAsync();
        var imagem = new MensagemImagem { EmpresaId = usuario.EmpresaId, ClienteId = clienteId, TipoConteudo = tipo, Dados = dados };
        db.MensagemImagens.Add(imagem);
        await db.SaveChangesAsync();
        return Results.Ok(new { imagem.Id });
    }

    private static async Task<IResult> ExcluirImagem(Guid? clienteId, ClaimsPrincipal user, OrionDbContext db)
    {
        var (usuario, negado) = await Permissoes.Exigir(user, db, Permissoes.ClientesEditar);
        if (usuario is null) return negado!;
        await Imagens(db, usuario.EmpresaId, clienteId).ExecuteDeleteAsync();
        return Results.NoContent();
    }

    private static IQueryable<MensagemImagem> Imagens(OrionDbContext db, Guid empresaId, Guid? clienteId) =>
        db.MensagemImagens.Where(i => i.EmpresaId == empresaId && i.ClienteId == clienteId);

    private static async Task<IResult> BaixarImagem(Guid id, HttpContext contexto, OrionDbContext db)
    {
        var imagem = await db.MensagemImagens.Where(i => i.Id == id)
            .Select(i => new { i.TipoConteudo, i.Dados })
            .SingleOrDefaultAsync();
        if (imagem is null) return Results.NotFound();
        // A imagem de um id nunca muda (trocar = gravar outra): o navegador pode guardar para sempre.
        contexto.Response.Headers.CacheControl = "public, max-age=31536000, immutable";
        contexto.Response.Headers.XContentTypeOptions = "nosniff";
        return Results.File(imagem.Dados, imagem.TipoConteudo);
    }

    private static IResult ErroImagem(string mensagem) => Results.BadRequest(new { erro = mensagem, campo = "imagem" });

    /// <summary>Todo o histórico de envios da mensagem automática para um cliente, do mais novo ao mais antigo.</summary>
    private static async Task<IResult> EnviosDoCliente(Guid clienteId, ClaimsPrincipal user, OrionDbContext db)
    {
        var (usuario, negado) = await Permissoes.Exigir(user, db, Permissoes.Clientes);
        if (usuario is null) return negado!;
        if (!await db.Clientes.AnyAsync(c => c.Id == clienteId && c.EmpresaId == usuario.EmpresaId))
            return Results.NotFound();

        var envios = await db.EnviosWhatsapp
            .Where(w => w.ClienteId == clienteId && w.EmpresaId == usuario.EmpresaId)
            .OrderByDescending(w => w.CriadoEm)
            .Select(w => new EnvioDto(w.Id, w.ClienteId, w.Cliente!.Nome, w.Telefone, w.DataReferencia,
                w.Tipo, w.Mensagem, w.Status, w.Erro, w.CriadoEm))
            .ToListAsync();
        return Results.Ok(envios);
    }

    private static async Task<IResult> Obter(ClaimsPrincipal user, OrionDbContext db)
    {
        var (usuario, negado) = await Permissoes.Exigir(user, db, Permissoes.ClientesEditar);
        if (usuario is null) return negado!;
        return Results.Ok(await Dto(usuario.Empresa!, db));
    }

    private static async Task<IResult> Salvar(
        ConfiguracaoWhatsappRequest req, ClaimsPrincipal user, OrionDbContext db)
    {
        var (usuario, negado) = await Permissoes.Exigir(user, db, Permissoes.ClientesEditar);
        if (usuario is null) return negado!;

        var remetente = new string((req.Remetente ?? "").Where(char.IsAsciiDigit).ToArray());
        // Aceita com ou sem o +55 na frente.
        if (remetente.Length is 12 or 13 && remetente.StartsWith("55")) remetente = remetente[2..];
        var mensagem = req.Mensagem?.Trim() ?? "";

        var erros = new Dictionary<string, string[]>();
        if (remetente.Length > 0 && remetente.Length is not (10 or 11)) erros["remetente"] = ["Número incompleto"];
        if (mensagem.Length > TamanhoMaximo) erros["mensagem"] = [$"Máximo de {TamanhoMaximo} letras"];
        if (erros.Count > 0) return Results.ValidationProblem(erros);

        var empresa = await db.Empresas.SingleAsync(e => e.Id == usuario.EmpresaId);
        empresa.WhatsappRemetente = remetente.Length == 0 ? null : remetente;
        empresa.MensagemManutencao = mensagem.Length == 0 ? null : mensagem;
        await db.SaveChangesAsync();
        return Results.Ok(await Dto(empresa, db));
    }

    private static async Task<ConfiguracaoWhatsappDto> Dto(Empresa empresa, OrionDbContext db)
    {
        // O envio mais recente de cada cliente que recebeu a mensagem; os 15 mais novos.
        var enviados = db.EnviosWhatsapp.Where(w => w.EmpresaId == empresa.Id && w.Status == "enviado");
        var envios = await enviados
            .Where(w => !enviados.Any(outro => outro.ClienteId == w.ClienteId && outro.CriadoEm > w.CriadoEm))
            .OrderByDescending(w => w.CriadoEm)
            .Take(UltimosClientes)
            .Select(w => new EnvioDto(w.Id, w.ClienteId, w.Cliente!.Nome, w.Telefone, w.DataReferencia,
                w.Tipo, w.Mensagem, w.Status, w.Erro, w.CriadoEm))
            .ToListAsync();
        var imagemId = await Imagens(db, empresa.Id, null).Select(i => (Guid?)i.Id).SingleOrDefaultAsync();
        return new ConfiguracaoWhatsappDto(empresa.WhatsappRemetente, empresa.MensagemManutencao, imagemId, envios);
    }
}
