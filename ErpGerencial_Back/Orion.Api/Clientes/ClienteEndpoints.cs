using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Orion.Api.Auth;
using Orion.Api.Data;

namespace Orion.Api.Clientes;

public record ClienteRequest(
    string Nome,
    string Celular,
    /// <summary>CPF ou CNPJ (opcional).</summary>
    string? Documento,
    string? Produto,
    string? RgInscricao,
    DateOnly? DataNascimento,
    string? PontoReferencia,
    string? TelefoneResidencial,
    string? TelefoneComercial,
    string? Celular2,
    string? Conjuge,
    DateOnly? DataCompra,
    string? Cep,
    string? Logradouro,
    string? NumeroEndereco,
    string? Complemento,
    string? Bairro,
    string? Cidade,
    string? Uf,
    /// <summary>
    /// Data e hora do próximo envio da mensagem. O intervalo é a diferença entre agora e ela: agora 16h30 e envio 17h →
    /// a cada 30 minutos; hoje 14/10 e envio 14/12 → a cada 2 meses. Vazio: sem envios automáticos.
    /// </summary>
    DateTime? EnvioEm,
    /// <summary>
    /// Na edição, o calendário não foi mexido: mantém o envio e o intervalo como estão no servidor (que pode já ter
    /// avançado o próximo envio enquanto o cadastro estava aberto). EnvioEm é ignorado.
    /// </summary>
    bool ManterEnvio = false);

/// <summary>Mensagem personalizada de um cliente (vazia: volta a usar a mensagem padrão da empresa).</summary>
public record MensagemClienteRequest(string? Mensagem);

public record ClienteDto(
    Guid Id,
    int Numero,
    string Nome,
    string Celular,
    string? Documento,
    string? Produto,
    string? RgInscricao,
    DateOnly? DataNascimento,
    string? PontoReferencia,
    string? TelefoneResidencial,
    string? TelefoneComercial,
    string? Celular2,
    string? Conjuge,
    DateOnly? DataCompra,
    string? Cep,
    string? Logradouro,
    string? NumeroEndereco,
    string? Complemento,
    string? Bairro,
    string? Cidade,
    string? Uf,
    string TipoIntervalo,
    /// <summary>De quanto em quanto tempo a mensagem se repete, em IntervaloUnidade; vazio sem envios automáticos.</summary>
    int? IntervaloQuantidade,
    /// <summary>"minutos", "horas", "dias", "semanas" ou "meses".</summary>
    string IntervaloUnidade,
    /// <summary>Dia do próximo envio (no horário de Brasília); vazio quando não há envio marcado.</summary>
    DateOnly? ProximaManutencao,
    string? MensagemWhatsapp,
    DateTime? EnvioEm,
    /// <summary>Id da foto (ver /api/clientes/fotos/{id}); vazio quando o cliente não tem foto.</summary>
    Guid? FotoId,
    /// <summary>Imagem da mensagem personalizada (ver /api/whatsapp/imagens/{id}); vazio quando não tem.</summary>
    Guid? MensagemImagemId,
    DateTime CriadoEm,
    DateTime AtualizadoEm);

public record ListaClientes(List<ClienteDto> Itens, int Total, int Pagina, int TamanhoPagina);

/// <summary>
/// Clientes da empresa. Ver: permissão "clientes"; cadastrar: "clientes-cadastrar";
/// editar e excluir: "clientes-editar" (o administrador pode tudo).
/// </summary>
public static class ClienteEndpoints
{
    private const int TamanhoPagina = 50;
    /// <summary>O próximo envio pode ser marcado até 10 anos à frente.</summary>
    private const int AnosMaximo = 10;
    private const string TipoMeses = "meses";
    /// <summary>O site reduz a foto antes de enviar; isto é só o teto.</summary>
    private const int FotoTamanhoMaximo = 5 * 1024 * 1024;

    public static void MapClienteEndpoints(this WebApplication app)
    {
        var grupo = app.MapGroup("/api/clientes").RequireAuthorization();
        grupo.MapGet("/", Listar);
        grupo.MapGet("/{id:guid}", Obter);
        grupo.MapPost("/", Criar);
        grupo.MapPut("/{id:guid}", Editar);
        grupo.MapDelete("/{id:guid}", Excluir);
        grupo.MapPut("/{id:guid}/mensagem", SalvarMensagem);
        grupo.MapPost("/{id:guid}/cancelar-envios", CancelarEnvios);
        // Login por token (Bearer), sem cookie: o envio de arquivo não precisa de antiforgery.
        grupo.MapPut("/{id:guid}/foto", SalvarFoto).DisableAntiforgery();
        grupo.MapDelete("/{id:guid}/foto", ExcluirFoto);

        // A tag <img> não manda o token: o endereço é aberto, mas o id é aleatório (não dá para adivinhar).
        app.MapGet("/api/clientes/fotos/{id:guid}", BaixarFoto);
    }

    /// <summary>Lista paginada (50 por página), mais novos primeiro; busca por nome, celular ou endereço.</summary>
    private static async Task<IResult> Listar(ClaimsPrincipal user, OrionDbContext db, string? busca, int? pagina)
    {
        var (usuario, negado) = await Permissoes.Exigir(user, db, Permissoes.Clientes);
        if (usuario is null) return negado!;

        var consulta = db.Clientes.Where(c => c.EmpresaId == usuario.EmpresaId);
        if (!string.IsNullOrWhiteSpace(busca))
        {
            var termo = $"%{busca.Trim()}%";
            var digitos = SoDigitos(busca);
            var termoDigitos = digitos.Length > 0 ? $"%{digitos}%" : null;
            consulta = consulta.Where(c =>
                EF.Functions.ILike(c.Nome, termo)
                || (termoDigitos != null && (EF.Functions.Like(c.Celular, termoDigitos)
                    || (c.Cep != null && EF.Functions.Like(c.Cep, termoDigitos))
                    || (c.Documento != null && EF.Functions.Like(c.Documento, termoDigitos))))
                || (c.Logradouro != null && EF.Functions.ILike(c.Logradouro, termo))
                || (c.Bairro != null && EF.Functions.ILike(c.Bairro, termo))
                || (c.Cidade != null && EF.Functions.ILike(c.Cidade, termo)));
        }

        var numeroPagina = Math.Max(1, pagina ?? 1);
        var total = await consulta.CountAsync();
        var itens = await consulta
            .OrderByDescending(c => c.Numero)
            .Skip((numeroPagina - 1) * TamanhoPagina)
            .Take(TamanhoPagina)
            .ToListAsync();
        var ids = itens.Select(c => c.Id).ToList();
        var fotos = await db.ClienteFotos.Where(f => ids.Contains(f.ClienteId))
            .ToDictionaryAsync(f => f.ClienteId, f => f.Id);
        var imagens = await db.MensagemImagens.Where(i => i.ClienteId != null && ids.Contains(i.ClienteId.Value))
            .ToDictionaryAsync(i => i.ClienteId!.Value, i => i.Id);
        return Results.Ok(new ListaClientes(
            itens.Select(c => Dto(c, fotos.TryGetValue(c.Id, out var foto) ? foto : null,
                imagens.TryGetValue(c.Id, out var imagem) ? imagem : null)).ToList(),
            total, numeroPagina, TamanhoPagina));
    }

    private static async Task<IResult> Obter(Guid id, ClaimsPrincipal user, OrionDbContext db)
    {
        var (usuario, negado) = await Permissoes.Exigir(user, db, Permissoes.Clientes);
        if (usuario is null) return negado!;
        var cliente = await db.Clientes.SingleOrDefaultAsync(c => c.Id == id && c.EmpresaId == usuario.EmpresaId);
        return cliente is null ? Results.NotFound() : Results.Ok(await DtoCompleto(db, cliente));
    }

    private static async Task<IResult> Criar(ClienteRequest req, ClaimsPrincipal user, OrionDbContext db)
    {
        var (usuario, negado) = await Permissoes.Exigir(user, db, Permissoes.ClientesCadastrar);
        if (usuario is null) return negado!;

        var erros = Validar(req, null);
        if (erros.Count > 0) return Results.ValidationProblem(erros);

        var cliente = new Cliente { EmpresaId = usuario.EmpresaId, Nome = "", Celular = "" };
        Preencher(cliente, req);
        db.Clientes.Add(cliente);

        // O ID sequencial é o maior da empresa + 1; se dois cadastros chegarem juntos, tenta de novo.
        for (var tentativa = 0; ; tentativa++)
        {
            cliente.Numero = (await db.Clientes.Where(c => c.EmpresaId == cliente.EmpresaId)
                .MaxAsync(c => (int?)c.Numero) ?? 0) + 1;
            try
            {
                await db.SaveChangesAsync();
                break;
            }
            catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation }
                                                && tentativa < 3)
            {
            }
        }

        return Results.Created($"/api/clientes/{cliente.Id}", Dto(cliente, null, null));
    }

    private static async Task<IResult> Editar(Guid id, ClienteRequest req, ClaimsPrincipal user, OrionDbContext db)
    {
        var (usuario, negado) = await Permissoes.Exigir(user, db, Permissoes.ClientesEditar);
        if (usuario is null) return negado!;

        var cliente = await db.Clientes.SingleOrDefaultAsync(c => c.Id == id && c.EmpresaId == usuario.EmpresaId);
        if (cliente is null) return Results.NotFound();

        var erros = Validar(req, cliente);
        if (erros.Count > 0) return Results.ValidationProblem(erros);

        Preencher(cliente, req);
        cliente.AtualizadoEm = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Results.Ok(await DtoCompleto(db, cliente));
    }

    /// <summary>Botão "Cancelar envios automáticos": apaga o próximo envio e o intervalo (nada mais é enviado).</summary>
    private static async Task<IResult> CancelarEnvios(Guid id, ClaimsPrincipal user, OrionDbContext db)
    {
        var (usuario, negado) = await Permissoes.Exigir(user, db, Permissoes.ClientesEditar);
        if (usuario is null) return negado!;

        var cliente = await db.Clientes.SingleOrDefaultAsync(c => c.Id == id && c.EmpresaId == usuario.EmpresaId);
        if (cliente is null) return Results.NotFound();

        cliente.TipoIntervalo = TipoMeses;
        cliente.IntervaloQuantidade = null;
        cliente.EnvioEm = null;
        cliente.AtualizadoEm = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Results.Ok(await DtoCompleto(db, cliente));
    }

    /// <summary>Envia (ou troca) a foto do cliente. Quem cadastra também pode: o cliente novo recebe a foto logo depois.</summary>
    private static async Task<IResult> SalvarFoto(Guid id, IFormFile? arquivo, ClaimsPrincipal user, OrionDbContext db)
    {
        var usuario = await UsuarioAtual.Carregar(user, db);
        if (usuario is null) return Results.Unauthorized();
        if (!Permissoes.Tem(usuario, Permissoes.ClientesCadastrar) && !Permissoes.Tem(usuario, Permissoes.ClientesEditar))
            return Results.Json(new { erro = "Você não tem permissão para isso" }, statusCode: StatusCodes.Status403Forbidden);

        if (!await db.Clientes.AnyAsync(c => c.Id == id && c.EmpresaId == usuario.EmpresaId))
            return Results.NotFound(new { erro = "Cliente não encontrado (pode ter sido excluído)", campo = "foto" });
        if (arquivo is null || arquivo.Length == 0) return ErroFoto("Tire a foto do cliente");
        if (arquivo.Length > FotoTamanhoMaximo) return ErroFoto("Foto grande demais (máximo de 5 MB)");

        using var memoria = new MemoryStream();
        await arquivo.CopyToAsync(memoria);
        var dados = memoria.ToArray();
        var tipo = TipoDaFoto(dados);
        if (tipo is null) return ErroFoto("Envie uma foto JPG, PNG ou WEBP");

        // Trocar a foto = apagar a antiga e gravar outra (id novo: o navegador não mostra a antiga guardada).
        await db.ClienteFotos.Where(f => f.ClienteId == id).ExecuteDeleteAsync();
        var foto = new ClienteFoto { ClienteId = id, TipoConteudo = tipo, Dados = dados };
        db.ClienteFotos.Add(foto);
        await db.SaveChangesAsync();
        return Results.Ok(new { foto.Id });
    }

    private static async Task<IResult> ExcluirFoto(Guid id, ClaimsPrincipal user, OrionDbContext db)
    {
        var (usuario, negado) = await Permissoes.Exigir(user, db, Permissoes.ClientesEditar);
        if (usuario is null) return negado!;
        await db.ClienteFotos
            .Where(f => f.ClienteId == id && f.Cliente!.EmpresaId == usuario.EmpresaId)
            .ExecuteDeleteAsync();
        return Results.NoContent();
    }

    private static async Task<IResult> BaixarFoto(Guid id, HttpContext contexto, OrionDbContext db)
    {
        var foto = await db.ClienteFotos.Where(f => f.Id == id)
            .Select(f => new { f.TipoConteudo, f.Dados })
            .SingleOrDefaultAsync();
        if (foto is null) return Results.NotFound();
        // A foto de um id nunca muda (trocar = gravar outra): o navegador pode guardar para sempre.
        contexto.Response.Headers.CacheControl = "public, max-age=31536000, immutable";
        contexto.Response.Headers.XContentTypeOptions = "nosniff";
        return Results.File(foto.Dados, foto.TipoConteudo);
    }

    /// <summary>O cliente com a foto e a imagem da mensagem personalizada.</summary>
    private static async Task<ClienteDto> DtoCompleto(OrionDbContext db, Cliente c) =>
        Dto(c,
            await db.ClienteFotos.Where(f => f.ClienteId == c.Id).Select(f => (Guid?)f.Id).SingleOrDefaultAsync(),
            await db.MensagemImagens.Where(i => i.ClienteId == c.Id).Select(i => (Guid?)i.Id).SingleOrDefaultAsync());

    /// <summary>Tipo pelo começo do arquivo (não confia na extensão nem no que o navegador diz).</summary>
    public static string? TipoDaFoto(byte[] d) => d switch
    {
        [0xFF, 0xD8, 0xFF, ..] => "image/jpeg",
        [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, ..] => "image/png",
        [0x52, 0x49, 0x46, 0x46, _, _, _, _, 0x57, 0x45, 0x42, 0x50, ..] => "image/webp",
        _ => null,
    };

    private static IResult ErroFoto(string mensagem) => Results.BadRequest(new { erro = mensagem, campo = "foto" });

    /// <summary>Salva (ou apaga, se vier vazia) a mensagem personalizada do cliente.</summary>
    private static async Task<IResult> SalvarMensagem(
        Guid id, MensagemClienteRequest req, ClaimsPrincipal user, OrionDbContext db)
    {
        var (usuario, negado) = await Permissoes.Exigir(user, db, Permissoes.ClientesEditar);
        if (usuario is null) return negado!;

        var cliente = await db.Clientes.SingleOrDefaultAsync(c => c.Id == id && c.EmpresaId == usuario.EmpresaId);
        if (cliente is null) return Results.NotFound();

        var mensagem = req.Mensagem?.Trim() ?? "";
        if (mensagem.Length > 1000)
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["mensagem"] = ["Máximo de 1000 letras"] });

        cliente.MensagemWhatsapp = mensagem.Length == 0 ? null : mensagem;
        cliente.AtualizadoEm = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Results.Ok(await DtoCompleto(db, cliente));
    }

    private static async Task<IResult> Excluir(Guid id, ClaimsPrincipal user, OrionDbContext db)
    {
        var (usuario, negado) = await Permissoes.Exigir(user, db, Permissoes.ClientesEditar);
        if (usuario is null) return negado!;
        var apagados = await db.Clientes.Where(c => c.Id == id && c.EmpresaId == usuario.EmpresaId).ExecuteDeleteAsync();
        return apagados == 0 ? Results.NotFound() : Results.NoContent();
    }

    /// <param name="atual">Na edição, o cliente como está salvo (o envio já marcado não precisa estar no futuro).</param>
    private static Dictionary<string, string[]> Validar(ClienteRequest req, Cliente? atual)
    {
        var erros = new Dictionary<string, string[]>();
        var nome = req.Nome?.Trim() ?? "";
        if (nome.Length == 0) erros["nome"] = ["Digite o nome"];
        else if (nome.Length > 200) erros["nome"] = ["Máximo de 200 letras"];

        var celular = SoDigitos(req.Celular);
        if (celular.Length == 0) erros["celular"] = ["Digite o celular"];
        else if (celular.Length is not (10 or 11)) erros["celular"] = ["Número incompleto"];

        Validacao.Documento(erros, "documento", req.Documento);

        // Telefones extras da ficha: opcionais, mas completos quando preenchidos.
        foreach (var (campo, valor) in new[]
                 {
                     ("telefoneResidencial", req.TelefoneResidencial), ("telefoneComercial", req.TelefoneComercial),
                     ("celular2", req.Celular2),
                 })
        {
            if (SoDigitos(valor).Length is not (0 or 10 or 11)) erros[campo] = ["Número incompleto"];
        }
        var hoje = DateOnly.FromDateTime(DateTime.UtcNow);
        if (req.DataNascimento is { } nascimento && (nascimento > hoje || nascimento.Year < 1900))
            erros["dataNascimento"] = ["Data inválida"];
        if (req.DataCompra is { } compra && (compra > hoje.AddDays(1) || compra.Year < 1990))
            erros["dataCompra"] = ["Data inválida"];

        var cep = SoDigitos(req.Cep);
        if (cep.Length > 0 && cep.Length != 8) erros["cep"] = ["CEP incompleto"];

        void Tamanho(string campo, string? valor, int maximo)
        {
            if ((valor?.Trim().Length ?? 0) > maximo) erros[campo] = [$"Máximo de {maximo} letras"];
        }
        Tamanho("produto", req.Produto, 200);
        Tamanho("rgInscricao", req.RgInscricao, 30);
        Tamanho("pontoReferencia", req.PontoReferencia, 200);
        Tamanho("conjuge", req.Conjuge, 200);
        Tamanho("logradouro", req.Logradouro, 150);
        Tamanho("numeroEndereco", req.NumeroEndereco, 20);
        Tamanho("complemento", req.Complemento, 100);
        Tamanho("bairro", req.Bairro, 100);
        Tamanho("cidade", req.Cidade, 100);
        if ((req.Uf?.Trim().Length ?? 0) is not (0 or 2)) erros["uf"] = ["Use a sigla (ex.: SP)"];

        // Próximo envio: novo ou trocado precisa estar no futuro (o que já estava marcado pode ficar).
        if (!(req.ManterEnvio && atual is not null) && req.EnvioEm is { } envio && !MesmoEnvio(envio, atual?.EnvioEm))
        {
            var utc = envio.ToUniversalTime();
            if (utc <= DateTime.UtcNow.AddSeconds(30)) erros["envioEm"] = ["Escolha uma data e horário futuros"];
            else if (utc > DateTime.UtcNow.AddYears(AnosMaximo)) erros["envioEm"] = [$"No máximo {AnosMaximo} anos à frente"];
        }
        return erros;
    }

    private static void Preencher(Cliente c, ClienteRequest req)
    {
        static string? Opcional(string? valor) => string.IsNullOrWhiteSpace(valor) ? null : valor.Trim();
        c.Nome = req.Nome.Trim();
        c.Celular = SoDigitos(req.Celular);
        c.Documento = Opcional(Validacao.NormalizarDocumento(req.Documento ?? ""));
        c.Produto = Opcional(req.Produto);
        c.RgInscricao = Opcional(req.RgInscricao);
        c.DataNascimento = req.DataNascimento;
        c.PontoReferencia = Opcional(req.PontoReferencia);
        c.TelefoneResidencial = Opcional(SoDigitos(req.TelefoneResidencial));
        c.TelefoneComercial = Opcional(SoDigitos(req.TelefoneComercial));
        c.Celular2 = Opcional(SoDigitos(req.Celular2));
        c.Conjuge = Opcional(req.Conjuge);
        c.DataCompra = req.DataCompra;
        c.Cep = Opcional(SoDigitos(req.Cep));
        c.Logradouro = Opcional(req.Logradouro);
        c.NumeroEndereco = Opcional(req.NumeroEndereco);
        c.Complemento = Opcional(req.Complemento);
        c.Bairro = Opcional(req.Bairro);
        c.Cidade = Opcional(req.Cidade);
        c.Uf = Opcional(req.Uf)?.ToUpperInvariant();
        // Edição sem mexer no calendário: o envio segue como está (o envio automático pode já ter marcado o próximo)
        if (!req.ManterEnvio || c.Numero == 0) Agendar(c, req.EnvioEm);
    }

    /// <summary>
    /// Marca o próximo envio escolhido e calcula de quanto em quanto tempo ele se repete (ver CalcularIntervalo).
    /// Depois de cada envio, o robô marca o seguinte (+ o intervalo). Sem data: sem envios automáticos.
    /// Se o envio já marcado não mudou, o intervalo também fica como está.
    /// </summary>
    private static void Agendar(Cliente c, DateTime? envio)
    {
        if (envio is null)
        {
            c.TipoIntervalo = TipoMeses;
            c.IntervaloQuantidade = null;
            c.EnvioEm = null;
            return;
        }
        if (MesmoEnvio(envio.Value, c.EnvioEm) && c.IntervaloQuantidade is not null) return;

        var utc = envio.Value.ToUniversalTime();
        (c.IntervaloQuantidade, c.IntervaloUnidade) = CalcularIntervalo(utc, DateTime.UtcNow);
        c.TipoIntervalo = TipoMeses;
        c.EnvioEm = utc;
    }

    /// <summary>
    /// Intervalo = a diferença entre agora e o envio (no horário de Brasília), na unidade que faz sentido:
    /// menos de 24 horas → minutos (ou horas, se for hora cheia): agora 16h30, envio 17h → 30 minutos;
    /// mesmo dia do mês → meses: 14/10 → 14/12 = 2 meses; múltiplo de 7 dias → semanas; senão → dias.
    /// O site faz a mesma conta (formatos.ts, calcularIntervalo).
    /// </summary>
    public static (int Quantidade, string Unidade) CalcularIntervalo(DateTime envioUtc, DateTime agoraUtc)
    {
        static DateTime AoMinuto(DateTime d) => new(d.Year, d.Month, d.Day, d.Hour, d.Minute, 0);
        var agora = AoMinuto(TimeZoneInfo.ConvertTimeFromUtc(agoraUtc, Brasilia));
        var envio = AoMinuto(TimeZoneInfo.ConvertTimeFromUtc(envioUtc, Brasilia));

        var minutos = (int)Math.Round((envio - agora).TotalMinutes);
        if (minutos < 24 * 60)
            return minutos > 0 && minutos % 60 == 0 ? (minutos / 60, "horas") : (Math.Max(1, minutos), "minutos");

        var meses = (envio.Year - agora.Year) * 12 + envio.Month - agora.Month;
        if (envio.Day == agora.Day && meses >= 1) return (meses, "meses");
        var dias = (envio.Date - agora.Date).Days;
        return dias % 7 == 0 ? (dias / 7, "semanas") : (dias, "dias");
    }

    /// <summary>Mesmo envio, ao minuto (o site manda data e hora sem segundos).</summary>
    private static bool MesmoEnvio(DateTime envio, DateTime? salvo) =>
        salvo is { } s && Math.Abs((envio.ToUniversalTime() - s.ToUniversalTime()).TotalSeconds) < 60;

    private static string SoDigitos(string? valor) => new((valor ?? "").Where(char.IsAsciiDigit).ToArray());

    private static readonly TimeZoneInfo Brasilia = TimeZoneInfo.FindSystemTimeZoneById("America/Sao_Paulo");

    /// <summary>Próxima manutenção: o dia do próximo envio, no horário de Brasília.</summary>
    private static DateOnly? Proxima(Cliente c) =>
        c.EnvioEm is { } envio ? DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(envio, Brasilia)) : null;

    private static ClienteDto Dto(Cliente c, Guid? fotoId, Guid? mensagemImagemId) =>
        new(c.Id, c.Numero, c.Nome, c.Celular, c.Documento, c.Produto, c.RgInscricao, c.DataNascimento, c.PontoReferencia,
            c.TelefoneResidencial, c.TelefoneComercial, c.Celular2, c.Conjuge, c.DataCompra, c.Cep, c.Logradouro, c.NumeroEndereco, c.Complemento,
            c.Bairro, c.Cidade, c.Uf, c.TipoIntervalo, c.IntervaloQuantidade, c.IntervaloUnidade, Proxima(c), c.MensagemWhatsapp,
            c.EnvioEm, fotoId, mensagemImagemId, c.CriadoEm, c.AtualizadoEm);
}
