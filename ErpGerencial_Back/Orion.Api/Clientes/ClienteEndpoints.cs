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
    string? Cep,
    string? Logradouro,
    string? NumeroEndereco,
    string? Complemento,
    string? Bairro,
    string? Cidade,
    string? Uf,
    /// <summary>"meses" ou "data".</summary>
    string? TipoIntervalo,
    int? IntervaloManutencaoMeses,
    /// <summary>Só no tipo "data": a data e hora escolhidas (no tipo "meses" o servidor calcula).</summary>
    DateTime? EnvioEm);

/// <summary>Mensagem personalizada de um cliente (vazia: volta a usar a mensagem padrão da empresa).</summary>
public record MensagemClienteRequest(string? Mensagem);

public record ClienteDto(
    Guid Id,
    int Numero,
    string Nome,
    string Celular,
    string? Documento,
    string? Cep,
    string? Logradouro,
    string? NumeroEndereco,
    string? Complemento,
    string? Bairro,
    string? Cidade,
    string? Uf,
    string TipoIntervalo,
    int? IntervaloManutencaoMeses,
    /// <summary>Dia do próximo envio (no horário de Brasília); vazio quando não há envio marcado.</summary>
    DateOnly? ProximaManutencao,
    string? MensagemWhatsapp,
    DateTime? EnvioEm,
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
    private const int IntervaloMaximo = 120;
    private const string TipoMeses = "meses";
    private const string TipoData = "data";
    /// <summary>Hora em que sai a mensagem no intervalo mensal (horário de Brasília).</summary>
    private static readonly TimeOnly HoraDoEnvio = new(6, 0);

    public static void MapClienteEndpoints(this WebApplication app)
    {
        var grupo = app.MapGroup("/api/clientes").RequireAuthorization();
        grupo.MapGet("/", Listar);
        grupo.MapGet("/{id:guid}", Obter);
        grupo.MapPost("/", Criar);
        grupo.MapPut("/{id:guid}", Editar);
        grupo.MapDelete("/{id:guid}", Excluir);
        grupo.MapPut("/{id:guid}/mensagem", SalvarMensagem);
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
        return Results.Ok(new ListaClientes(itens.Select(Dto).ToList(), total, numeroPagina, TamanhoPagina));
    }

    private static async Task<IResult> Obter(Guid id, ClaimsPrincipal user, OrionDbContext db)
    {
        var (usuario, negado) = await Permissoes.Exigir(user, db, Permissoes.Clientes);
        if (usuario is null) return negado!;
        var cliente = await db.Clientes.SingleOrDefaultAsync(c => c.Id == id && c.EmpresaId == usuario.EmpresaId);
        return cliente is null ? Results.NotFound() : Results.Ok(Dto(cliente));
    }

    private static async Task<IResult> Criar(ClienteRequest req, ClaimsPrincipal user, OrionDbContext db)
    {
        var (usuario, negado) = await Permissoes.Exigir(user, db, Permissoes.ClientesCadastrar);
        if (usuario is null) return negado!;

        var erros = Validar(req);
        if (erros.Count > 0) return Results.ValidationProblem(erros);

        var cliente = new Cliente { EmpresaId = usuario.EmpresaId, Nome = "", Celular = "" };
        Preencher(cliente, req, novo: true);
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

        return Results.Created($"/api/clientes/{cliente.Id}", Dto(cliente));
    }

    private static async Task<IResult> Editar(Guid id, ClienteRequest req, ClaimsPrincipal user, OrionDbContext db)
    {
        var (usuario, negado) = await Permissoes.Exigir(user, db, Permissoes.ClientesEditar);
        if (usuario is null) return negado!;

        var cliente = await db.Clientes.SingleOrDefaultAsync(c => c.Id == id && c.EmpresaId == usuario.EmpresaId);
        if (cliente is null) return Results.NotFound();

        var erros = Validar(req);
        if (erros.Count > 0) return Results.ValidationProblem(erros);

        Preencher(cliente, req, novo: false);
        cliente.AtualizadoEm = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Results.Ok(Dto(cliente));
    }

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
        return Results.Ok(Dto(cliente));
    }

    private static async Task<IResult> Excluir(Guid id, ClaimsPrincipal user, OrionDbContext db)
    {
        var (usuario, negado) = await Permissoes.Exigir(user, db, Permissoes.ClientesEditar);
        if (usuario is null) return negado!;
        var apagados = await db.Clientes.Where(c => c.Id == id && c.EmpresaId == usuario.EmpresaId).ExecuteDeleteAsync();
        return apagados == 0 ? Results.NotFound() : Results.NoContent();
    }

    private static Dictionary<string, string[]> Validar(ClienteRequest req)
    {
        var erros = new Dictionary<string, string[]>();
        var nome = req.Nome?.Trim() ?? "";
        if (nome.Length == 0) erros["nome"] = ["Digite o nome"];
        else if (nome.Length > 200) erros["nome"] = ["Máximo de 200 letras"];

        var celular = SoDigitos(req.Celular);
        if (celular.Length == 0) erros["celular"] = ["Digite o celular"];
        else if (celular.Length is not (10 or 11)) erros["celular"] = ["Número incompleto"];

        Validacao.Documento(erros, "documento", req.Documento);

        var cep = SoDigitos(req.Cep);
        if (cep.Length > 0 && cep.Length != 8) erros["cep"] = ["CEP incompleto"];

        void Tamanho(string campo, string? valor, int maximo)
        {
            if ((valor?.Trim().Length ?? 0) > maximo) erros[campo] = [$"Máximo de {maximo} letras"];
        }
        Tamanho("logradouro", req.Logradouro, 150);
        Tamanho("numeroEndereco", req.NumeroEndereco, 20);
        Tamanho("complemento", req.Complemento, 100);
        Tamanho("bairro", req.Bairro, 100);
        Tamanho("cidade", req.Cidade, 100);
        if ((req.Uf?.Trim().Length ?? 0) is not (0 or 2)) erros["uf"] = ["Use a sigla (ex.: SP)"];

        switch (req.TipoIntervalo)
        {
            case TipoMeses:
                if (req.IntervaloManutencaoMeses is null) erros["intervaloManutencaoMeses"] = ["Digite o intervalo"];
                else if (req.IntervaloManutencaoMeses is < 1 or > IntervaloMaximo)
                    erros["intervaloManutencaoMeses"] = [$"De 1 a {IntervaloMaximo} meses"];
                break;
            case TipoData:
                if (req.EnvioEm is null) erros["envioEm"] = ["Escolha a data e a hora"];
                break;
            default:
                erros["tipoIntervalo"] = ["Escolha mensalmente ou data específica"];
                break;
        }
        return erros;
    }

    /// <param name="novo">Cliente novo: no tipo "meses", o primeiro envio é sempre calculado a partir de hoje.</param>
    private static void Preencher(Cliente c, ClienteRequest req, bool novo)
    {
        static string? Opcional(string? valor) => string.IsNullOrWhiteSpace(valor) ? null : valor.Trim();
        c.Nome = req.Nome.Trim();
        c.Celular = SoDigitos(req.Celular);
        c.Documento = Opcional(Validacao.NormalizarDocumento(req.Documento ?? ""));
        c.Cep = Opcional(SoDigitos(req.Cep));
        c.Logradouro = Opcional(req.Logradouro);
        c.NumeroEndereco = Opcional(req.NumeroEndereco);
        c.Complemento = Opcional(req.Complemento);
        c.Bairro = Opcional(req.Bairro);
        c.Cidade = Opcional(req.Cidade);
        c.Uf = Opcional(req.Uf)?.ToUpperInvariant();
        Agendar(c, req, novo);
    }

    /// <summary>
    /// Marca o próximo envio. Mensalmente: às 6h, no mesmo dia do mês de hoje, N meses à frente
    /// (só recalcula quando o intervalo é novo ou mudou; editar outros dados não mexe no envio marcado).
    /// Data específica: a data e hora escolhidas.
    /// </summary>
    private static void Agendar(Cliente c, ClienteRequest req, bool novo)
    {
        if (req.TipoIntervalo == TipoData)
        {
            c.TipoIntervalo = TipoData;
            c.IntervaloManutencaoMeses = null;
            c.EnvioEm = req.EnvioEm!.Value.ToUniversalTime();
            return;
        }

        var meses = req.IntervaloManutencaoMeses!.Value;
        var mudou = novo || c.TipoIntervalo != TipoMeses || c.IntervaloManutencaoMeses != meses || c.EnvioEm is null;
        c.TipoIntervalo = TipoMeses;
        c.IntervaloManutencaoMeses = meses;
        if (mudou) c.EnvioEm = EnvioMensal(DateTime.UtcNow, meses);
    }

    /// <summary>Hoje (em Brasília) + N meses, às 6h de Brasília, em UTC.</summary>
    public static DateTime EnvioMensal(DateTime agoraUtc, int meses)
    {
        var hoje = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(agoraUtc, Brasilia));
        var local = hoje.AddMonths(meses).ToDateTime(HoraDoEnvio);
        return TimeZoneInfo.ConvertTimeToUtc(local, Brasilia);
    }

    private static string SoDigitos(string? valor) => new((valor ?? "").Where(char.IsAsciiDigit).ToArray());

    private static readonly TimeZoneInfo Brasilia = TimeZoneInfo.FindSystemTimeZoneById("America/Sao_Paulo");

    /// <summary>Próxima manutenção: o dia do próximo envio, no horário de Brasília.</summary>
    private static DateOnly? Proxima(Cliente c) =>
        c.EnvioEm is { } envio ? DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(envio, Brasilia)) : null;

    private static ClienteDto Dto(Cliente c) =>
        new(c.Id, c.Numero, c.Nome, c.Celular, c.Documento, c.Cep, c.Logradouro, c.NumeroEndereco, c.Complemento,
            c.Bairro, c.Cidade, c.Uf, c.TipoIntervalo, c.IntervaloManutencaoMeses, Proxima(c), c.MensagemWhatsapp, c.EnvioEm,
            c.CriadoEm, c.AtualizadoEm);
}
