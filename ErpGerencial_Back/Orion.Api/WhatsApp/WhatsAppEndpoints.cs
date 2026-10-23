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
/// Situação do WhatsApp que envia: "sem-numero", "conectado", "aguardando" (esperando ler o QR Code),
/// "desconectado" ou "indisponivel" (a Evolution não respondeu; o motivo vai em Mensagem).
/// </summary>
public record ConexaoWhatsappDto(string? Remetente, string Estado, string? QrCode, string? Codigo, string? Mensagem);

/// <summary>
/// Um cliente com mensagem automática programada para hoje (tela inicial), uma linha por cliente:
/// "agendada" (ainda vai sair: Horario = o marcado), "enviada"/"teste" (Horario = o último envio) ou "erro" (não saiu).
/// Enviadas = quantas saíram hoje (cliente com intervalo de minutos/horas recebe mais de uma por dia).
/// </summary>
public record MensagemHojeDto(
    Guid ClienteId, string Nome, string Celular, DateTime Horario, string Situacao, string? Erro, int Enviadas = 0);

/// <summary>
/// Mensagem automática da empresa (WhatsApp): a mensagem padrão, o número remetente e os últimos
/// clientes que receberam a mensagem. Quem pode editar clientes pode mexer aqui; o histórico de um
/// cliente (GET /api/clientes/{id}/envios) abre para quem pode ver clientes.
/// Quem envia de fato é a própria API (EnvioAutomatico), pela Evolution; o celular que envia é conectado aqui
/// mesmo, pelo QR Code (/api/whatsapp/conexao).
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
        // Conectar o celular que envia pelo próprio site (QR Code), sem rodar comando
        grupo.MapGet("/conexao", SituacaoConexao);
        grupo.MapPost("/conexao", Conectar);
        // Tela inicial: as mensagens programadas para hoje (uma linha por cliente)
        grupo.MapGet("/hoje", MensagensDeHoje);
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

    /// <summary>
    /// As mensagens automáticas de hoje (dia de Brasília): os envios já feitos e os que ainda vão sair hoje,
    /// em ordem de horário. Cada envio feito move o próximo envio do cliente, então as duas listas não se repetem.
    /// </summary>
    private static async Task<IResult> MensagensDeHoje(ClaimsPrincipal user, OrionDbContext db)
    {
        var (usuario, negado) = await Permissoes.Exigir(user, db, Permissoes.Clientes);
        if (usuario is null) return negado!;
        var hoje = Horario.Hoje;
        var inicio = Horario.InicioDoDiaUtc(hoje);
        var fim = Horario.InicioDoDiaUtc(hoje.AddDays(1));

        // Só o que foi PROGRAMADO para hoje (o dia da mensagem, não o dia da tentativa): amanhã a lista recomeça.
        var tentativas = await db.EnviosWhatsapp
            .Where(w => w.EmpresaId == usuario.EmpresaId && w.DataReferencia == hoje)
            .Select(w => new { w.ClienteId, Nome = w.Cliente!.Nome, w.Telefone, w.CriadoEm, w.Status, w.Erro })
            .ToListAsync();
        var pendentes = await db.Clientes
            .Where(c => c.EmpresaId == usuario.EmpresaId && c.EnvioEm >= inicio && c.EnvioEm < fim)
            .Select(c => new { c.Id, c.Nome, c.Celular, EnvioEm = c.EnvioEm!.Value })
            .ToDictionaryAsync(c => c.Id);

        var linhas = new List<MensagemHojeDto>();
        // Quem já teve envio programado para hoje: uma linha só, com o resultado do dia
        foreach (var cliente in tentativas.GroupBy(t => t.ClienteId))
        {
            var enviadas = cliente.Where(t => t.Status is "enviado" or "teste").OrderBy(t => t.CriadoEm).ToList();
            var ultima = cliente.MaxBy(t => t.CriadoEm)!;
            if (pendentes.Remove(cliente.Key, out var pendente))
                // Ainda tem mensagem de hoje na fila (próximo horário, ou tentando de novo depois de uma falha)
                linhas.Add(new MensagemHojeDto(cliente.Key, pendente.Nome, pendente.Celular, pendente.EnvioEm, "agendada",
                    ultima.Status == "erro" ? ultima.Erro : null, enviadas.Count));
            else if (enviadas.Count > 0)
                linhas.Add(new MensagemHojeDto(cliente.Key, ultima.Nome, ultima.Telefone, enviadas[^1].CriadoEm,
                    enviadas[^1].Status == "teste" ? "teste" : "enviada", null, enviadas.Count));
            else
                linhas.Add(new MensagemHojeDto(cliente.Key, ultima.Nome, ultima.Telefone, ultima.CriadoEm, "erro", ultima.Erro));
        }
        // Quem ainda não teve nenhuma tentativa hoje: vai sair no horário marcado
        linhas.AddRange(pendentes.Values.Select(c => new MensagemHojeDto(c.Id, c.Nome, c.Celular, c.EnvioEm, "agendada", null)));
        return Results.Ok(linhas.OrderBy(m => m.Horario).Take(200).ToList());
    }

    /// <summary>O WhatsApp do número salvo está conectado?</summary>
    private static async Task<IResult> SituacaoConexao(ClaimsPrincipal user, OrionDbContext db, EvolutionApi evolution, CancellationToken ct)
    {
        var (usuario, negado) = await Permissoes.Exigir(user, db, Permissoes.ClientesEditar);
        if (usuario is null) return negado!;
        var remetente = usuario.Empresa!.WhatsappRemetente;
        if (remetente is null) return Results.Ok(new ConexaoWhatsappDto(null, "sem-numero", null, null, null));
        try
        {
            var estado = await evolution.Estado(remetente, ct) switch
            {
                "open" => "conectado",
                "connecting" => "aguardando",
                _ => "desconectado",
            };
            return Results.Ok(new ConexaoWhatsappDto(remetente, estado, null, null, null));
        }
        catch (ErroEnvio ex)
        {
            return Results.Ok(new ConexaoWhatsappDto(remetente, "indisponivel", null, null, ex.Message));
        }
    }

    /// <summary>Gera o QR Code (e o código de 8 letras) para conectar o celular do número salvo.</summary>
    private static async Task<IResult> Conectar(ClaimsPrincipal user, OrionDbContext db, EvolutionApi evolution, CancellationToken ct)
    {
        var (usuario, negado) = await Permissoes.Exigir(user, db, Permissoes.ClientesEditar);
        if (usuario is null) return negado!;
        var remetente = usuario.Empresa!.WhatsappRemetente;
        if (remetente is null)
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["remetente"] = ["Salve o número remetente antes de conectar"] });
        try
        {
            if (await evolution.Conectado(remetente, ct))
                return Results.Ok(new ConexaoWhatsappDto(remetente, "conectado", null, null, null));
            var conexao = await evolution.IniciarConexao(remetente, ct);
            return Results.Ok(new ConexaoWhatsappDto(remetente, "aguardando", conexao.QrCode, conexao.Codigo, null));
        }
        catch (ErroEnvio ex)
        {
            return Results.Ok(new ConexaoWhatsappDto(remetente, "indisponivel", null, null, ex.Message));
        }
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
