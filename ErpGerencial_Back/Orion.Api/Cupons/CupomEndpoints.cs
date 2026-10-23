using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Orion.Api.Auth;
using Orion.Api.Data;
using Orion.Api.Produtos;

namespace Orion.Api.Cupons;

/// <summary>Item do cupom: um produto do cadastro (ProdutoId) ou um item avulso (só a descrição).</summary>
public record CupomItemRequest(Guid? ProdutoId, string? Descricao, decimal Quantidade, decimal ValorUnitario);

public record CupomRequest(
    Guid? ClienteId,
    string? ClienteNome,
    string? ClienteDocumento,
    string? ClienteEndereco,
    List<CupomItemRequest>? Itens,
    /// <summary>Valor do recibo avulso (sem itens).</summary>
    decimal? Valor,
    decimal? Desconto,
    string FormaPagamento,
    decimal? ValorRecebido,
    string? Referente,
    string? Observacao,
    /// <summary>Quanto foi pago na 1ª forma (com a 2ª, a venda é paga em duas partes).</summary>
    decimal? ValorPagamento1 = null,
    string? FormaPagamento2 = null,
    decimal? ValorPagamento2 = null,
    /// <summary>Vendedor (usuário da empresa); null: quem está emitindo.</summary>
    Guid? VendedorId = null);

public record CancelarCupomRequest(string? Motivo);

public record CupomItemDto(
    Guid Id, Guid? ProdutoId, string Descricao, string? Codigo, string? CodigoBarras,
    decimal Quantidade, decimal ValorUnitario, decimal Total);

public record CupomDto(
    Guid Id,
    int Numero,
    string EmitenteNome,
    string? EmitenteRazaoSocial,
    string? EmitenteDocumento,
    string? EmitenteEndereco,
    string? EmitenteCidade,
    string? EmitenteUf,
    string? EmitenteTelefone,
    Guid? ClienteId,
    string? ClienteNome,
    string? ClienteDocumento,
    string? ClienteEndereco,
    List<CupomItemDto> Itens,
    decimal Subtotal,
    decimal Desconto,
    decimal Total,
    string FormaPagamento,
    decimal? ValorPagamento1,
    string? FormaPagamento2,
    decimal? ValorPagamento2,
    /// <summary>Total pago (soma das formas).</summary>
    decimal? ValorRecebido,
    /// <summary>Total pago menos o total da venda.</summary>
    decimal? Troco,
    string? Referente,
    string? Observacao,
    string EmitidoPor,
    string? VendedorNome,
    DateTime EmitidoEm,
    DateTime? CanceladoEm,
    string? MotivoCancelamento,
    /// <summary>Nota emitida no site do governo: "cupom" (consumidor) ou "nota" (empresa).</summary>
    string? NotaTipo,
    string? NotaNumero,
    DateTime? NotaRegistradaEm);

public record AnotarNotaRequest(string? Tipo, string? Numero);

public record ListaCupons(List<CupomDto> Itens, int Total, int Pagina, int TamanhoPagina);

/// <summary>
/// Cupons de venda e recibos (documentos NÃO fiscais) da empresa. Tudo exige a permissão "cupom-fiscal".
/// Emitir dá baixa no estoque dos produtos do cadastro; cancelar devolve. Cupom não se exclui nem se edita.
/// </summary>
public static class CupomEndpoints
{
    private const int TamanhoPagina = 50;
    private const int MaximoItens = 200;
    private const decimal ValorMaximo = 999_999_999_999m;

    public static readonly string[] FormasPagamento =
        ["dinheiro", "pix", "cartao-credito", "cartao-debito", "boleto", "transferencia", "outro"];

    public static void MapCupomEndpoints(this WebApplication app)
    {
        var grupo = app.MapGroup("/api/cupons").RequireAuthorization();
        grupo.MapGet("/", Listar);
        grupo.MapGet("/{id:guid}", Obter);
        grupo.MapPost("/", Emitir);
        grupo.MapPost("/{id:guid}/cancelar", Cancelar);
        grupo.MapPut("/{id:guid}/nota", AnotarNota);
    }

    /// <summary>
    /// Lista paginada (50 por página), mais novos primeiro; busca pelo Nº, cliente, CPF/CNPJ ou "correspondente a".
    /// Filtros do Financeiro: período (de/ate, dias no horário de Brasília), forma de pagamento, vendedor e situação.
    /// </summary>
    private static async Task<IResult> Listar(
        ClaimsPrincipal user, OrionDbContext db, string? busca, int? pagina,
        DateOnly? de, DateOnly? ate, string? forma, Guid? vendedorId, string? situacao)
    {
        // Quem vê o Financeiro também lista as vendas (mesmo sem emitir cupons)
        var usuario = await UsuarioAtual.Carregar(user, db);
        if (usuario is null) return Results.Unauthorized();
        if (!Permissoes.Tem(usuario, Permissoes.CupomFiscal) && !Permissoes.Tem(usuario, Permissoes.Financeiro))
            return Results.Json(new { erro = "Você não tem permissão para isso" }, statusCode: StatusCodes.Status403Forbidden);

        var consulta = Filtrar(db.Cupons.Where(c => c.EmpresaId == usuario.EmpresaId), de, ate, forma, vendedorId, situacao);
        if (!string.IsNullOrWhiteSpace(busca))
        {
            var texto = busca.Trim();
            var termo = $"%{texto}%";
            var numero = int.TryParse(texto.TrimStart('0'), out var n) ? n : -1;
            var documento = Validacao.NormalizarDocumento(texto);
            consulta = consulta.Where(c =>
                c.Numero == numero
                || (c.ClienteNome != null && EF.Functions.ILike(c.ClienteNome, termo))
                || (documento.Length >= 3 && c.ClienteDocumento != null && c.ClienteDocumento.Contains(documento))
                || (c.Referente != null && EF.Functions.ILike(c.Referente, termo)));
        }

        var numeroPagina = Math.Max(1, pagina ?? 1);
        var total = await consulta.CountAsync();
        var itens = await consulta
            .Include(c => c.Itens)
            .OrderByDescending(c => c.Numero)
            .Skip((numeroPagina - 1) * TamanhoPagina)
            .Take(TamanhoPagina)
            .AsSplitQuery()
            .ToListAsync();
        return Results.Ok(new ListaCupons(itens.Select(Dto).ToList(), total, numeroPagina, TamanhoPagina));
    }

    /// <summary>Filtros do Financeiro (os mesmos do resumo).</summary>
    public static IQueryable<Cupom> Filtrar(
        IQueryable<Cupom> consulta, DateOnly? de, DateOnly? ate, string? forma, Guid? vendedorId, string? situacao)
    {
        if (de is { } inicio)
        {
            var desde = Horario.InicioDoDiaUtc(inicio);
            consulta = consulta.Where(c => c.EmitidoEm >= desde);
        }
        if (ate is { } fim)
        {
            var antes = Horario.InicioDoDiaUtc(fim.AddDays(1));
            consulta = consulta.Where(c => c.EmitidoEm < antes);
        }
        if (!string.IsNullOrWhiteSpace(forma))
            consulta = consulta.Where(c => c.FormaPagamento == forma || c.FormaPagamento2 == forma);
        if (vendedorId is { } vendedor)
            consulta = consulta.Where(c => (c.VendedorId ?? c.UsuarioId) == vendedor);
        consulta = situacao switch
        {
            "emitidos" => consulta.Where(c => c.CanceladoEm == null),
            "cancelados" => consulta.Where(c => c.CanceladoEm != null),
            _ => consulta,
        };
        return consulta;
    }

    private static async Task<IResult> Obter(Guid id, ClaimsPrincipal user, OrionDbContext db)
    {
        var usuario = await UsuarioAtual.Carregar(user, db);
        if (usuario is null) return Results.Unauthorized();
        if (!Permissoes.Tem(usuario, Permissoes.CupomFiscal) && !Permissoes.Tem(usuario, Permissoes.Financeiro))
            return Results.Json(new { erro = "Você não tem permissão para isso" }, statusCode: StatusCodes.Status403Forbidden);
        var cupom = await db.Cupons.Include(c => c.Itens)
            .SingleOrDefaultAsync(c => c.Id == id && c.EmpresaId == usuario.EmpresaId);
        return cupom is null ? Results.NotFound() : Results.Ok(Dto(cupom));
    }

    private static async Task<IResult> Emitir(CupomRequest req, ClaimsPrincipal user, OrionDbContext db)
    {
        var (usuario, negado) = await Permissoes.Exigir(user, db, Permissoes.CupomFiscal);
        if (usuario is null) return negado!;

        var erros = Validar(req);
        if (erros.Count > 0) return Results.ValidationProblem(erros);

        // Produtos do cadastro citados nos itens (só os da empresa)
        var idsProdutos = req.Itens!.Where(i => i.ProdutoId is not null).Select(i => i.ProdutoId!.Value).Distinct().ToList();
        var produtos = await db.Produtos
            .Where(p => p.EmpresaId == usuario.EmpresaId && idsProdutos.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id);
        if (produtos.Count != idsProdutos.Count)
            return Erro("itens", "Um dos produtos não existe mais. Tire-o e adicione de novo.");

        Cliente? cliente = null;
        if (req.ClienteId is { } clienteId)
        {
            cliente = await db.Clientes.SingleOrDefaultAsync(c => c.Id == clienteId && c.EmpresaId == usuario.EmpresaId);
            if (cliente is null)
                return Erro("clienteNome", "Este cliente não existe mais");
        }

        var vendedor = usuario;
        if (req.VendedorId is { } idVendedor && idVendedor != usuario.Id)
        {
            vendedor = await db.Usuarios.SingleOrDefaultAsync(u => u.Id == idVendedor && u.EmpresaId == usuario.EmpresaId && u.Ativo);
            if (vendedor is null) return Erro("vendedorId", "Este vendedor não existe mais");
        }

        var empresa = usuario.Empresa!;
        var cupom = new Cupom
        {
            EmpresaId = empresa.Id,
            EmitenteNome = empresa.Nome,
            EmitenteRazaoSocial = empresa.RazaoSocial,
            EmitenteDocumento = empresa.Documento,
            EmitenteEndereco = empresa.Endereco,
            EmitenteCidade = empresa.Cidade,
            EmitenteUf = empresa.Uf,
            EmitenteTelefone = empresa.Telefone,
            ClienteId = cliente?.Id,
            ClienteNome = Opcional(req.ClienteNome) ?? cliente?.Nome,
            ClienteDocumento = Opcional(Validacao.NormalizarDocumento(req.ClienteDocumento ?? "")) ?? cliente?.Documento,
            ClienteEndereco = Opcional(req.ClienteEndereco) ?? (cliente is null ? null : EnderecoDo(cliente)),
            FormaPagamento = req.FormaPagamento,
            Referente = Opcional(req.Referente),
            Observacao = Opcional(req.Observacao),
            EmitidoPor = usuario.Nome,
            UsuarioId = usuario.Id,
            VendedorId = vendedor.Id,
            VendedorNome = vendedor.Nome,
        };

        var posicao = 0;
        foreach (var item in req.Itens!)
        {
            var produto = item.ProdutoId is { } idProduto ? produtos[idProduto] : null;
            var quantidade = Math.Round(item.Quantidade, 3);
            var unitario = Math.Round(item.ValorUnitario, 2);
            cupom.Itens.Add(new CupomItem
            {
                Ordem = ++posicao,
                ProdutoId = produto?.Id,
                Descricao = Opcional(item.Descricao) ?? produto!.Nome,
                Codigo = produto?.Codigo,
                CodigoBarras = produto?.CodigoBarras,
                Quantidade = quantidade,
                ValorUnitario = unitario,
                Total = Math.Round(quantidade * unitario, 2),
                CustoUnitario = produto?.PrecoCusto ?? 0,
            });
            // Baixa no estoque (pode ficar negativo: a venda acontece mesmo sem o estoque atualizado)
            if (produto is not null) Estoque.Movimentar(db, produto, "venda", -quantidade, usuario, cupomId: cupom.Id);
        }

        cupom.Subtotal = cupom.Itens.Count > 0 ? cupom.Itens.Sum(i => i.Total) : Math.Round(req.Valor ?? 0, 2);
        cupom.Desconto = Math.Round(req.Desconto ?? 0, 2);
        if (cupom.Desconto > cupom.Subtotal)
            return Erro("desconto", "Maior que o valor da venda");
        cupom.Total = cupom.Subtotal - cupom.Desconto;

        // Pagamento: uma forma (o valor pago pode passar do total: troco) ou duas (a venda dividida em duas partes)
        var valor1 = req.ValorPagamento1 ?? req.ValorRecebido;
        if (req.FormaPagamento2 is { } forma2)
        {
            if (req.ValorPagamento2 is not > 0) return Erro("valorPagamento2", "Digite o valor da 2ª forma");
            cupom.FormaPagamento2 = forma2;
            cupom.ValorPagamento2 = Math.Round(req.ValorPagamento2.Value, 2);
            // Sem o valor da 1ª forma: ela paga o que falta
            cupom.ValorPagamento1 = Math.Round(valor1 ?? Math.Max(0, cupom.Total - cupom.ValorPagamento2.Value), 2);
        }
        else if (valor1 is { } pago)
        {
            cupom.ValorPagamento1 = Math.Round(pago, 2);
        }
        if (cupom.ValorPagamento1 is not null)
        {
            var totalPago = cupom.ValorPagamento1.Value + (cupom.ValorPagamento2 ?? 0);
            if (totalPago < cupom.Total) return Erro("valorPagamento1", "O valor pago é menor que o total");
            // Troco só sai do dinheiro
            if (totalPago > cupom.Total && req.FormaPagamento != "dinheiro" && cupom.FormaPagamento2 != "dinheiro")
                return Erro("valorPagamento1", "Troco só em dinheiro: o valor pago passou do total");
            cupom.ValorRecebido = totalPago;
        }

        db.Cupons.Add(cupom);
        // O Nº é o maior da empresa + 1; se dois cupons forem emitidos juntos, tenta de novo.
        for (var tentativa = 0; ; tentativa++)
        {
            cupom.Numero = (await db.Cupons.Where(c => c.EmpresaId == cupom.EmpresaId)
                .MaxAsync(c => (int?)c.Numero) ?? 0) + 1;
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

        return Results.Created($"/api/cupons/{cupom.Id}", Dto(cupom));
    }

    /// <summary>
    /// Anota a nota emitida no site do governo: tipo ("cupom" ou "nota") e o número. Número vazio apaga a anotação.
    /// </summary>
    private static async Task<IResult> AnotarNota(Guid id, AnotarNotaRequest req, ClaimsPrincipal user, OrionDbContext db)
    {
        var (usuario, negado) = await Permissoes.Exigir(user, db, Permissoes.CupomFiscal);
        if (usuario is null) return negado!;
        var cupom = await db.Cupons.Include(c => c.Itens)
            .SingleOrDefaultAsync(c => c.Id == id && c.EmpresaId == usuario.EmpresaId);
        if (cupom is null) return Results.NotFound();

        var numero = req.Numero?.Trim() ?? "";
        if (numero.Length == 0)
        {
            cupom.NotaTipo = null;
            cupom.NotaNumero = null;
            cupom.NotaRegistradaEm = null;
        }
        else
        {
            if (req.Tipo is not ("cupom" or "nota")) return Erro("tipo", "Escolha cupom fiscal ou nota fiscal");
            if (numero.Length > 30) return Erro("numero", "Máximo de 30 letras");
            cupom.NotaTipo = req.Tipo;
            cupom.NotaNumero = numero;
            cupom.NotaRegistradaEm = DateTime.UtcNow;
        }
        await db.SaveChangesAsync();
        return Results.Ok(Dto(cupom));
    }

    /// <summary>Cancela o cupom (fica registrado, com o motivo) e devolve ao estoque os produtos dele.</summary>
    private static async Task<IResult> Cancelar(
        Guid id, CancelarCupomRequest req, ClaimsPrincipal user, OrionDbContext db)
    {
        var (usuario, negado) = await Permissoes.Exigir(user, db, Permissoes.CupomFiscal);
        if (usuario is null) return negado!;

        var motivo = req.Motivo?.Trim() ?? "";
        if (motivo.Length == 0) return Erro("motivo", "Digite o motivo");
        if (motivo.Length > 300) return Erro("motivo", "Máximo de 300 letras");

        var cupom = await db.Cupons.Include(c => c.Itens)
            .SingleOrDefaultAsync(c => c.Id == id && c.EmpresaId == usuario.EmpresaId);
        if (cupom is null) return Results.NotFound();
        if (cupom.CanceladoEm is not null) return Results.Conflict(new { erro = "Este cupom já foi cancelado" });

        cupom.CanceladoEm = DateTime.UtcNow;
        cupom.MotivoCancelamento = motivo;

        var idsProdutos = cupom.Itens.Where(i => i.ProdutoId is not null).Select(i => i.ProdutoId!.Value).Distinct().ToList();
        var produtos = await db.Produtos.Where(p => idsProdutos.Contains(p.Id)).ToDictionaryAsync(p => p.Id);
        foreach (var item in cupom.Itens)
        {
            if (item.ProdutoId is { } idProduto && produtos.TryGetValue(idProduto, out var produto))
                Estoque.Movimentar(db, produto, "cancelamento", item.Quantidade, usuario, cupomId: cupom.Id, observacao: motivo);
        }

        await db.SaveChangesAsync();
        return Results.Ok(Dto(cupom));
    }

    private static Dictionary<string, string[]> Validar(CupomRequest req)
    {
        var erros = new Dictionary<string, string[]>();
        var itens = req.Itens ?? [];

        if (!FormasPagamento.Contains(req.FormaPagamento)) erros["formaPagamento"] = ["Escolha a forma de pagamento"];
        if (req.FormaPagamento2 is not null && !FormasPagamento.Contains(req.FormaPagamento2))
            erros["formaPagamento2"] = ["Forma de pagamento inválida"];
        if (req.ValorPagamento1 is < 0 or > 999_999_999_999m) erros["valorPagamento1"] = ["Valor inválido"];
        if (req.ValorPagamento2 is < 0 or > 999_999_999_999m) erros["valorPagamento2"] = ["Valor inválido"];

        if (itens.Count > MaximoItens) erros["itens"] = [$"No máximo {MaximoItens} itens"];
        for (var i = 0; i < itens.Count && !erros.ContainsKey("itens"); i++)
        {
            var item = itens[i];
            if (item.ProdutoId is null && string.IsNullOrWhiteSpace(item.Descricao))
                erros["itens"] = [$"Item {i + 1}: digite a descrição"];
            else if ((item.Descricao?.Trim().Length ?? 0) > 200)
                erros["itens"] = [$"Item {i + 1}: descrição com no máximo 200 letras"];
            else if (item.Quantidade <= 0)
                erros["itens"] = [$"Item {i + 1}: a quantidade precisa ser maior que zero"];
            else if (item.Quantidade > 999_999_999m || item.ValorUnitario > ValorMaximo)
                erros["itens"] = [$"Item {i + 1}: valor muito alto"];
            else if (item.ValorUnitario < 0)
                erros["itens"] = [$"Item {i + 1}: o valor não pode ser negativo"];
        }

        // Recibo avulso (sem itens): o valor e o "correspondente a" são obrigatórios
        if (itens.Count == 0)
        {
            if (req.Valor is not > 0) erros["valor"] = ["Digite o valor ou adicione produtos"];
            else if (req.Valor > ValorMaximo) erros["valor"] = ["Valor muito alto"];
            if (string.IsNullOrWhiteSpace(req.Referente)) erros["referente"] = ["Diga a que se refere o valor"];
        }

        if (req.Desconto is < 0) erros["desconto"] = ["Não pode ser negativo"];
        if (req.ValorRecebido is < 0 or > 999_999_999_999m) erros["valorRecebido"] = ["Valor inválido"];

        void Tamanho(string campo, string? valor, int maximo)
        {
            if ((valor?.Trim().Length ?? 0) > maximo) erros[campo] = [$"Máximo de {maximo} letras"];
        }
        Tamanho("clienteNome", req.ClienteNome, 200);
        Tamanho("clienteEndereco", req.ClienteEndereco, 300);
        Tamanho("referente", req.Referente, 300);
        Tamanho("observacao", req.Observacao, 1000);

        var documento = Validacao.NormalizarDocumento(req.ClienteDocumento ?? "");
        if (documento.Length > 0 && documento.Length is not (11 or 14)) erros["clienteDocumento"] = ["CPF ou CNPJ incompleto"];
        return erros;
    }

    private static IResult Erro(string campo, string mensagem) =>
        Results.ValidationProblem(new Dictionary<string, string[]> { [campo] = [mensagem] });

    private static string? Opcional(string? valor) => string.IsNullOrWhiteSpace(valor) ? null : valor.Trim();

    /// <summary>"Rua X, 10 - Centro - Cidade/UF" com o que o cadastro do cliente tiver.</summary>
    public static string? EnderecoDo(Cliente c)
    {
        var rua = string.Join(", ", new[] { c.Logradouro, c.NumeroEndereco, c.Complemento }.Where(p => !string.IsNullOrWhiteSpace(p)));
        var cidade = string.Join("/", new[] { c.Cidade, c.Uf }.Where(p => !string.IsNullOrWhiteSpace(p)));
        var partes = new[] { rua, c.Bairro, cidade }.Where(p => !string.IsNullOrWhiteSpace(p)).ToList();
        return partes.Count == 0 ? null : string.Join(" - ", partes);
    }

    public static CupomDto Dto(Cupom c) => new(
        c.Id, c.Numero,
        c.EmitenteNome, c.EmitenteRazaoSocial, c.EmitenteDocumento, c.EmitenteEndereco, c.EmitenteCidade, c.EmitenteUf,
        c.EmitenteTelefone,
        c.ClienteId, c.ClienteNome, c.ClienteDocumento, c.ClienteEndereco,
        c.Itens.OrderBy(i => i.Ordem)
            .Select(i => new CupomItemDto(
                i.Id, i.ProdutoId, i.Descricao, i.Codigo, i.CodigoBarras, i.Quantidade, i.ValorUnitario, i.Total))
            .ToList(),
        c.Subtotal, c.Desconto, c.Total, c.FormaPagamento, c.ValorPagamento1, c.FormaPagamento2, c.ValorPagamento2,
        c.ValorRecebido, c.ValorRecebido is { } recebido ? recebido - c.Total : null,
        c.Referente, c.Observacao, c.EmitidoPor, c.VendedorNome ?? c.EmitidoPor, c.EmitidoEm, c.CanceladoEm,
        c.MotivoCancelamento,
        c.NotaTipo, c.NotaNumero, c.NotaRegistradaEm);
}
