using System.Globalization;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Orion.Api.Auth;
using Orion.Api.Cupons;
using Orion.Api.Data;

namespace Orion.Api.Historico;

public record ClienteHistoricoResumo(
    Guid Id,
    int Numero,
    string Nome,
    string Celular,
    string? Documento,
    int Compras,
    decimal TotalGasto,
    int Mensagens,
    /// <summary>Última venda ou mensagem (ou o cadastro, se não houver nenhuma).</summary>
    DateTime UltimaAtividade);

public record ListaClientesHistorico(List<ClienteHistoricoResumo> Itens, int Total, int Pagina, int TamanhoPagina);

public record ItemEvento(string Descricao, string? Codigo, string? CodigoBarras, decimal Quantidade, decimal ValorUnitario, decimal Total);

/// <summary>Um acontecimento na vida do cliente: venda, cancelamento, mensagem de WhatsApp ou o cadastro.</summary>
public record EventoHistorico(
    /// <summary>venda, cancelamento, mensagem ou cadastro.</summary>
    string Tipo,
    DateTime Data,
    string Titulo,
    string? Detalhe,
    decimal? Valor,
    /// <summary>Venda: o cupom (para abrir e reimprimir).</summary>
    Guid? CupomId,
    /// <summary>Mensagem: enviado, teste ou erro.</summary>
    string? Status,
    List<ItemEvento> Itens);

public record ResumoCliente(
    int Compras,
    decimal TotalGasto,
    decimal TicketMedio,
    decimal ItensComprados,
    int MensagensEnviadas,
    int MensagensComErro,
    DateTime? PrimeiraCompra,
    DateTime? UltimaCompra);

public record HistoricoCliente(
    Guid Id,
    int Numero,
    string Nome,
    string Celular,
    string? Documento,
    string? Endereco,
    DateTime? ProximoEnvio,
    DateTime CriadoEm,
    ResumoCliente Resumo,
    List<EventoHistorico> Eventos);

/// <summary>
/// Histórico de cada cliente (página "Número de ordem de serviço"): tudo o que foi vendido e enviado a ele.
/// Vem dos registros que já existem — cupons emitidos e envios de WhatsApp —, então nada fica de fora.
/// Exige a permissão "ordem-servico".
/// </summary>
public static class HistoricoEndpoints
{
    private const int TamanhoPagina = 50;
    private static readonly CultureInfo Real = CultureInfo.GetCultureInfo("pt-BR");

    public static void MapHistoricoEndpoints(this WebApplication app)
    {
        var grupo = app.MapGroup("/api/historico").RequireAuthorization();
        grupo.MapGet("/clientes", Listar);
        grupo.MapGet("/clientes/{id:guid}", Obter);
    }

    /// <summary>Clientes com os números do histórico, quem teve atividade mais recente primeiro; busca por nome, celular ou CPF/CNPJ.</summary>
    private static async Task<IResult> Listar(ClaimsPrincipal user, OrionDbContext db, string? busca, int? pagina)
    {
        var (usuario, negado) = await Permissoes.Exigir(user, db, Permissoes.OrdemServico);
        if (usuario is null) return negado!;

        var consulta = db.Clientes.Where(c => c.EmpresaId == usuario.EmpresaId);
        if (!string.IsNullOrWhiteSpace(busca))
        {
            var termo = $"%{busca.Trim()}%";
            var digitos = Validacao.NormalizarDocumento(busca);
            consulta = consulta.Where(c =>
                EF.Functions.ILike(c.Nome, termo)
                || (digitos.Length >= 3 && (c.Celular.Contains(digitos) || (c.Documento != null && c.Documento.Contains(digitos)))));
        }
        var clientes = await consulta
            .Select(c => new { c.Id, c.Numero, c.Nome, c.Celular, c.Documento, c.CriadoEm })
            .ToListAsync();
        var ids = clientes.Select(c => c.Id).ToList();

        var vendas = await db.Cupons
            .Where(c => c.EmpresaId == usuario.EmpresaId && c.ClienteId != null && ids.Contains(c.ClienteId.Value) && c.CanceladoEm == null)
            .GroupBy(c => c.ClienteId!.Value)
            .Select(g => new { Id = g.Key, Compras = g.Count(), Total = g.Sum(c => c.Total), Ultima = g.Max(c => c.EmitidoEm) })
            .ToDictionaryAsync(v => v.Id);
        var mensagens = await db.EnviosWhatsapp
            .Where(e => e.EmpresaId == usuario.EmpresaId && ids.Contains(e.ClienteId))
            .GroupBy(e => e.ClienteId)
            .Select(g => new { Id = g.Key, Quantidade = g.Count(), Ultima = g.Max(e => e.CriadoEm) })
            .ToDictionaryAsync(m => m.Id);

        var resumos = clientes.Select(c =>
        {
            var v = vendas.GetValueOrDefault(c.Id);
            var m = mensagens.GetValueOrDefault(c.Id);
            var ultima = new[] { c.CriadoEm, v?.Ultima ?? DateTime.MinValue, m?.Ultima ?? DateTime.MinValue }.Max();
            return new ClienteHistoricoResumo(
                c.Id, c.Numero, c.Nome, c.Celular, c.Documento, v?.Compras ?? 0, v?.Total ?? 0, m?.Quantidade ?? 0, ultima);
        }).OrderByDescending(r => r.UltimaAtividade).ToList();

        var numeroPagina = Math.Max(1, pagina ?? 1);
        return Results.Ok(new ListaClientesHistorico(
            resumos.Skip((numeroPagina - 1) * TamanhoPagina).Take(TamanhoPagina).ToList(),
            resumos.Count, numeroPagina, TamanhoPagina));
    }

    private static async Task<IResult> Obter(Guid id, ClaimsPrincipal user, OrionDbContext db)
    {
        var (usuario, negado) = await Permissoes.Exigir(user, db, Permissoes.OrdemServico);
        if (usuario is null) return negado!;

        var cliente = await db.Clientes.SingleOrDefaultAsync(c => c.Id == id && c.EmpresaId == usuario.EmpresaId);
        if (cliente is null) return Results.NotFound();

        var cupons = await db.Cupons.Include(c => c.Itens)
            .Where(c => c.EmpresaId == usuario.EmpresaId && c.ClienteId == id)
            .AsSplitQuery()
            .ToListAsync();
        var envios = await db.EnviosWhatsapp
            .Where(e => e.EmpresaId == usuario.EmpresaId && e.ClienteId == id)
            .ToListAsync();

        var eventos = new List<EventoHistorico>
        {
            new("cadastro", cliente.CriadoEm, "Cliente cadastrado", null, null, null, null, []),
        };
        foreach (var c in cupons)
        {
            var itens = c.Itens.OrderBy(i => i.Ordem)
                .Select(i => new ItemEvento(i.Descricao, i.Codigo, i.CodigoBarras, i.Quantidade, i.ValorUnitario, i.Total))
                .ToList();
            var pagamento = Pagamento(c.FormaPagamento) + (c.FormaPagamento2 is { } f2 ? $" + {Pagamento(f2)}" : "");
            var detalhe = string.Join(" · ", new[]
            {
                $"Pagamento: {pagamento}",
                c.Desconto > 0 ? $"Desconto: {c.Desconto.ToString("C", Real)}" : null,
                $"Vendedor: {c.VendedorNome ?? c.EmitidoPor}",
                c.Itens.Count == 0 ? c.Referente : null,
                c.Observacao is { } obs ? $"Obs.: {obs}" : null,
            }.Where(t => t is not null));
            eventos.Add(new("venda", c.EmitidoEm, $"Venda — cupom Nº {c.Numero:000000}", detalhe, c.Total, c.Id,
                c.CanceladoEm is null ? null : "cancelado", itens));
            if (c.CanceladoEm is { } cancelado)
                eventos.Add(new("cancelamento", cancelado, $"Venda cancelada — cupom Nº {c.Numero:000000}",
                    $"Motivo: {c.MotivoCancelamento}", c.Total, c.Id, null, []));
        }
        foreach (var e in envios)
        {
            var titulo = e.Status switch
            {
                "enviado" => "Mensagem de WhatsApp enviada",
                "teste" => "Mensagem de WhatsApp (teste: não saiu de verdade)",
                _ => "Mensagem de WhatsApp não enviada",
            };
            eventos.Add(new("mensagem", e.CriadoEm, titulo, e.Status == "erro" && e.Erro is { } erro ? $"{e.Mensagem}\n\nMotivo: {erro}" : e.Mensagem,
                null, null, e.Status, []));
        }

        var validos = cupons.Where(c => c.CanceladoEm is null).ToList();
        var total = validos.Sum(c => c.Total);
        var resumo = new ResumoCliente(
            validos.Count,
            total,
            validos.Count == 0 ? 0 : Math.Round(total / validos.Count, 2),
            validos.SelectMany(c => c.Itens).Sum(i => i.Quantidade),
            envios.Count(e => e.Status == "enviado"),
            envios.Count(e => e.Status == "erro"),
            validos.Count == 0 ? null : validos.Min(c => c.EmitidoEm),
            validos.Count == 0 ? null : validos.Max(c => c.EmitidoEm));

        return Results.Ok(new HistoricoCliente(
            cliente.Id, cliente.Numero, cliente.Nome, cliente.Celular, cliente.Documento, CupomEndpoints.EnderecoDo(cliente),
            cliente.EnvioEm, cliente.CriadoEm, resumo, eventos.OrderByDescending(e => e.Data).ToList()));
    }

    private static string Pagamento(string forma) => forma switch
    {
        "dinheiro" => "Dinheiro",
        "pix" => "Pix",
        "cartao-credito" => "Cartão de crédito",
        "cartao-debito" => "Cartão de débito",
        "boleto" => "Boleto",
        "transferencia" => "Transferência",
        _ => "Outro",
    };
}
