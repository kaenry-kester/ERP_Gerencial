using Microsoft.EntityFrameworkCore;

namespace Orion.Api.Data;

public class OrionDbContext(DbContextOptions<OrionDbContext> options) : DbContext(options)
{
    public DbSet<Usuario> Usuarios => Set<Usuario>();
    public DbSet<Empresa> Empresas => Set<Empresa>();
    public DbSet<Produto> Produtos => Set<Produto>();
    public DbSet<ProdutoImagem> ProdutoImagens => Set<ProdutoImagem>();
    public DbSet<Cliente> Clientes => Set<Cliente>();
    public DbSet<ClienteFoto> ClienteFotos => Set<ClienteFoto>();
    public DbSet<EnvioWhatsapp> EnviosWhatsapp => Set<EnvioWhatsapp>();
    public DbSet<MensagemImagem> MensagemImagens => Set<MensagemImagem>();
    public DbSet<CodigoLogin> CodigosLogin => Set<CodigoLogin>();
    public DbSet<Cupom> Cupons => Set<Cupom>();
    public DbSet<CupomItem> CupomItens => Set<CupomItem>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Usuario>(e =>
        {
            e.ToTable("usuarios");
            e.Property(u => u.Id).HasColumnName("id");
            e.Property(u => u.Nome).HasColumnName("nome").HasMaxLength(120);
            e.Property(u => u.Email).HasColumnName("email").HasMaxLength(254);
            e.Property(u => u.Telefone).HasColumnName("telefone").HasMaxLength(11);
            e.Property(u => u.SenhaHash).HasColumnName("senha_hash");
            e.Property(u => u.EmpresaId).HasColumnName("empresa_id");
            e.Property(u => u.Administrador).HasColumnName("administrador");
            e.Property(u => u.Permissoes).HasColumnName("permissoes");
            e.Property(u => u.Ativo).HasColumnName("ativo").HasDefaultValue(true);
            e.Property(u => u.CriadoEm).HasColumnName("criado_em");
            e.HasIndex(u => u.Email).IsUnique();
            e.HasOne(u => u.Empresa)
                .WithMany(emp => emp.Usuarios)
                .HasForeignKey(u => u.EmpresaId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Empresa>(e =>
        {
            e.ToTable("empresas");
            e.Property(emp => emp.Id).HasColumnName("id");
            e.Property(emp => emp.Nome).HasColumnName("nome").HasMaxLength(100);
            e.Property(emp => emp.RazaoSocial).HasColumnName("razao_social").HasMaxLength(150);
            e.Property(emp => emp.Documento).HasColumnName("documento").HasMaxLength(14);
            e.Property(emp => emp.Email).HasColumnName("email").HasMaxLength(254);
            e.Property(emp => emp.Telefone).HasColumnName("telefone").HasMaxLength(11);
            e.Property(emp => emp.Endereco).HasColumnName("endereco").HasMaxLength(200);
            e.Property(emp => emp.Cidade).HasColumnName("cidade").HasMaxLength(100);
            e.Property(emp => emp.Uf).HasColumnName("uf").HasMaxLength(2);
            e.Property(emp => emp.CriadoEm).HasColumnName("criado_em");
            e.Property(emp => emp.WhatsappRemetente).HasColumnName("whatsapp_remetente").HasMaxLength(11);
            e.Property(emp => emp.MensagemManutencao).HasColumnName("mensagem_manutencao").HasMaxLength(1000);
            // Como no Bling, um CNPJ/CPF tem uma conta só (quando informado).
            e.HasIndex(emp => emp.Documento).IsUnique().HasFilter("documento IS NOT NULL");
        });

        modelBuilder.Entity<Produto>(e =>
        {
            e.ToTable("produtos");
            e.Property(p => p.Id).HasColumnName("id");
            e.Property(p => p.EmpresaId).HasColumnName("empresa_id");
            e.Property(p => p.Numero).HasColumnName("numero");
            e.Property(p => p.Nome).HasColumnName("nome").HasMaxLength(200);
            e.Property(p => p.Codigo).HasColumnName("codigo").HasMaxLength(60);
            e.Property(p => p.CodigoBarras).HasColumnName("codigo_barras").HasMaxLength(50);
            e.Property(p => p.PrecoCusto).HasColumnName("preco_custo").HasPrecision(14, 2);
            e.Property(p => p.PrecoVendaPf).HasColumnName("preco_venda_pf").HasPrecision(14, 2);
            e.Property(p => p.PrecoVendaPj).HasColumnName("preco_venda_pj").HasPrecision(14, 2);
            e.Property(p => p.Quantidade).HasColumnName("quantidade").HasPrecision(14, 3);
            e.Property(p => p.Marca).HasColumnName("marca").HasMaxLength(80);
            e.Property(p => p.Modelo).HasColumnName("modelo").HasMaxLength(80);
            e.Property(p => p.Cor).HasColumnName("cor").HasMaxLength(50);
            e.Property(p => p.Voltagem).HasColumnName("voltagem").HasMaxLength(30);
            e.Property(p => p.Observacao).HasColumnName("observacao").HasMaxLength(2000);
            e.Property(p => p.CriadoEm).HasColumnName("criado_em");
            e.Property(p => p.AtualizadoEm).HasColumnName("atualizado_em");
            // ID sequencial, código e código de barras não se repetem dentro da mesma empresa.
            e.HasIndex(p => new { p.EmpresaId, p.Numero }).IsUnique();
            e.HasIndex(p => new { p.EmpresaId, p.Codigo }).IsUnique().HasFilter("codigo IS NOT NULL");
            e.HasIndex(p => new { p.EmpresaId, p.CodigoBarras }).IsUnique().HasFilter("codigo_barras IS NOT NULL");
            e.HasOne(p => p.Empresa).WithMany().HasForeignKey(p => p.EmpresaId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ProdutoImagem>(e =>
        {
            e.ToTable("produto_imagens");
            e.Property(i => i.Id).HasColumnName("id");
            e.Property(i => i.ProdutoId).HasColumnName("produto_id");
            e.Property(i => i.Ordem).HasColumnName("ordem");
            e.Property(i => i.TipoConteudo).HasColumnName("tipo_conteudo").HasMaxLength(20);
            e.Property(i => i.Dados).HasColumnName("dados");
            e.Property(i => i.CriadoEm).HasColumnName("criado_em");
            e.HasIndex(i => new { i.ProdutoId, i.Ordem });
            // Excluir o produto apaga as imagens dele.
            e.HasOne(i => i.Produto).WithMany().HasForeignKey(i => i.ProdutoId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Cliente>(e =>
        {
            e.ToTable("clientes");
            e.Property(c => c.Id).HasColumnName("id");
            e.Property(c => c.EmpresaId).HasColumnName("empresa_id");
            e.Property(c => c.Numero).HasColumnName("numero");
            e.Property(c => c.Nome).HasColumnName("nome").HasMaxLength(200);
            e.Property(c => c.Celular).HasColumnName("celular").HasMaxLength(11);
            e.Property(c => c.Documento).HasColumnName("documento").HasMaxLength(14);
            e.Property(c => c.Produto).HasColumnName("produto").HasMaxLength(200);
            e.Property(c => c.RgInscricao).HasColumnName("rg_inscricao").HasMaxLength(30);
            e.Property(c => c.DataNascimento).HasColumnName("data_nascimento");
            e.Property(c => c.PontoReferencia).HasColumnName("ponto_referencia").HasMaxLength(200);
            e.Property(c => c.TelefoneResidencial).HasColumnName("telefone_residencial").HasMaxLength(11);
            e.Property(c => c.TelefoneComercial).HasColumnName("telefone_comercial").HasMaxLength(11);
            e.Property(c => c.Celular2).HasColumnName("celular2").HasMaxLength(11);
            e.Property(c => c.Conjuge).HasColumnName("conjuge").HasMaxLength(200);
            e.Property(c => c.DataCompra).HasColumnName("data_compra");
            e.Property(c => c.Cep).HasColumnName("cep").HasMaxLength(8);
            e.Property(c => c.Logradouro).HasColumnName("logradouro").HasMaxLength(150);
            e.Property(c => c.NumeroEndereco).HasColumnName("numero_endereco").HasMaxLength(20);
            e.Property(c => c.Complemento).HasColumnName("complemento").HasMaxLength(100);
            e.Property(c => c.Bairro).HasColumnName("bairro").HasMaxLength(100);
            e.Property(c => c.Cidade).HasColumnName("cidade").HasMaxLength(100);
            e.Property(c => c.Uf).HasColumnName("uf").HasMaxLength(2);
            e.Property(c => c.TipoIntervalo).HasColumnName("tipo_intervalo").HasMaxLength(10).HasDefaultValue("meses");
            e.Property(c => c.IntervaloQuantidade).HasColumnName("intervalo_quantidade");
            e.Property(c => c.IntervaloUnidade).HasColumnName("intervalo_unidade").HasMaxLength(10).HasDefaultValue("meses");
            e.Property(c => c.MensagemWhatsapp).HasColumnName("mensagem_whatsapp").HasMaxLength(1000);
            e.Property(c => c.EnvioEm).HasColumnName("envio_em");
            e.Property(c => c.CriadoEm).HasColumnName("criado_em");
            e.Property(c => c.AtualizadoEm).HasColumnName("atualizado_em");
            // ID sequencial não se repete dentro da mesma empresa.
            e.HasIndex(c => new { c.EmpresaId, c.Numero }).IsUnique();
            e.HasOne(c => c.Empresa).WithMany().HasForeignKey(c => c.EmpresaId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ClienteFoto>(e =>
        {
            e.ToTable("cliente_fotos");
            e.Property(f => f.Id).HasColumnName("id");
            e.Property(f => f.ClienteId).HasColumnName("cliente_id");
            e.Property(f => f.TipoConteudo).HasColumnName("tipo_conteudo").HasMaxLength(20);
            e.Property(f => f.Dados).HasColumnName("dados");
            e.Property(f => f.CriadoEm).HasColumnName("criado_em");
            // Uma foto por cliente; excluir o cliente apaga a foto.
            e.HasIndex(f => f.ClienteId).IsUnique();
            e.HasOne(f => f.Cliente).WithMany().HasForeignKey(f => f.ClienteId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<MensagemImagem>(e =>
        {
            e.ToTable("mensagem_imagens");
            e.Property(i => i.Id).HasColumnName("id");
            e.Property(i => i.EmpresaId).HasColumnName("empresa_id");
            e.Property(i => i.ClienteId).HasColumnName("cliente_id");
            e.Property(i => i.TipoConteudo).HasColumnName("tipo_conteudo").HasMaxLength(20);
            e.Property(i => i.Dados).HasColumnName("dados");
            e.Property(i => i.CriadoEm).HasColumnName("criado_em");
            // Uma imagem na mensagem padrão da empresa e uma na mensagem de cada cliente.
            e.HasIndex(i => i.EmpresaId).IsUnique().HasFilter("cliente_id IS NULL");
            e.HasIndex(i => i.ClienteId).IsUnique().HasFilter("cliente_id IS NOT NULL");
            e.HasOne<Empresa>().WithMany().HasForeignKey(i => i.EmpresaId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne<Cliente>().WithMany().HasForeignKey(i => i.ClienteId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<EnvioWhatsapp>(e =>
        {
            e.ToTable("envios_whatsapp");
            e.Property(w => w.Id).HasColumnName("id");
            e.Property(w => w.EmpresaId).HasColumnName("empresa_id");
            e.Property(w => w.ClienteId).HasColumnName("cliente_id");
            e.Property(w => w.DataReferencia).HasColumnName("data_referencia");
            e.Property(w => w.Tipo).HasColumnName("tipo").HasMaxLength(12).HasDefaultValue("manutencao");
            e.Property(w => w.Telefone).HasColumnName("telefone").HasMaxLength(13);
            e.Property(w => w.Mensagem).HasColumnName("mensagem").HasMaxLength(1200);
            e.Property(w => w.Status).HasColumnName("status").HasMaxLength(10);
            e.Property(w => w.Erro).HasColumnName("erro").HasMaxLength(500);
            e.Property(w => w.CriadoEm).HasColumnName("criado_em");
            // Nunca duas mensagens de manutenção para o mesmo cliente na mesma data (testes agendados podem repetir).
            e.HasIndex(w => new { w.ClienteId, w.DataReferencia }).IsUnique().HasFilter("tipo = 'manutencao'");
            e.HasIndex(w => new { w.EmpresaId, w.CriadoEm });
            e.HasOne(w => w.Cliente).WithMany().HasForeignKey(w => w.ClienteId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne<Empresa>().WithMany().HasForeignKey(w => w.EmpresaId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Cupom>(e =>
        {
            e.ToTable("cupons");
            e.Property(c => c.Id).HasColumnName("id");
            e.Property(c => c.EmpresaId).HasColumnName("empresa_id");
            e.Property(c => c.Numero).HasColumnName("numero");
            e.Property(c => c.EmitenteNome).HasColumnName("emitente_nome").HasMaxLength(100);
            e.Property(c => c.EmitenteRazaoSocial).HasColumnName("emitente_razao_social").HasMaxLength(150);
            e.Property(c => c.EmitenteDocumento).HasColumnName("emitente_documento").HasMaxLength(14);
            e.Property(c => c.EmitenteEndereco).HasColumnName("emitente_endereco").HasMaxLength(200);
            e.Property(c => c.EmitenteCidade).HasColumnName("emitente_cidade").HasMaxLength(100);
            e.Property(c => c.EmitenteUf).HasColumnName("emitente_uf").HasMaxLength(2);
            e.Property(c => c.EmitenteTelefone).HasColumnName("emitente_telefone").HasMaxLength(11);
            e.Property(c => c.ClienteId).HasColumnName("cliente_id");
            e.Property(c => c.ClienteNome).HasColumnName("cliente_nome").HasMaxLength(200);
            e.Property(c => c.ClienteDocumento).HasColumnName("cliente_documento").HasMaxLength(14);
            e.Property(c => c.ClienteEndereco).HasColumnName("cliente_endereco").HasMaxLength(300);
            e.Property(c => c.Subtotal).HasColumnName("subtotal").HasPrecision(14, 2);
            e.Property(c => c.Desconto).HasColumnName("desconto").HasPrecision(14, 2);
            e.Property(c => c.Total).HasColumnName("total").HasPrecision(14, 2);
            e.Property(c => c.FormaPagamento).HasColumnName("forma_pagamento").HasMaxLength(20);
            e.Property(c => c.ValorRecebido).HasColumnName("valor_recebido").HasPrecision(14, 2);
            e.Property(c => c.ValorPagamento1).HasColumnName("valor_pagamento1").HasPrecision(14, 2);
            e.Property(c => c.FormaPagamento2).HasColumnName("forma_pagamento2").HasMaxLength(20);
            e.Property(c => c.ValorPagamento2).HasColumnName("valor_pagamento2").HasPrecision(14, 2);
            e.Property(c => c.VendedorId).HasColumnName("vendedor_id");
            e.Property(c => c.VendedorNome).HasColumnName("vendedor_nome").HasMaxLength(120);
            e.Property(c => c.Referente).HasColumnName("referente").HasMaxLength(300);
            e.Property(c => c.Observacao).HasColumnName("observacao").HasMaxLength(1000);
            e.Property(c => c.EmitidoPor).HasColumnName("emitido_por").HasMaxLength(120);
            e.Property(c => c.UsuarioId).HasColumnName("usuario_id");
            e.Property(c => c.EmitidoEm).HasColumnName("emitido_em");
            e.Property(c => c.CanceladoEm).HasColumnName("cancelado_em");
            e.Property(c => c.MotivoCancelamento).HasColumnName("motivo_cancelamento").HasMaxLength(300);
            // Nº sequencial não se repete dentro da mesma empresa.
            e.HasIndex(c => new { c.EmpresaId, c.Numero }).IsUnique();
            // Financeiro (vendas por período) e histórico do cliente
            e.HasIndex(c => new { c.EmpresaId, c.EmitidoEm });
            e.HasIndex(c => c.ClienteId);
            e.HasOne(c => c.Empresa).WithMany().HasForeignKey(c => c.EmpresaId).OnDelete(DeleteBehavior.Cascade);
            // Excluir o cliente ou o usuário não apaga os cupons (os dados ficaram copiados neles).
            e.HasOne<Cliente>().WithMany().HasForeignKey(c => c.ClienteId).OnDelete(DeleteBehavior.SetNull);
            e.HasOne<Usuario>().WithMany().HasForeignKey(c => c.UsuarioId).OnDelete(DeleteBehavior.SetNull);
            e.HasOne<Usuario>().WithMany().HasForeignKey(c => c.VendedorId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<CupomItem>(e =>
        {
            e.ToTable("cupom_itens");
            e.Property(i => i.Id).HasColumnName("id");
            e.Property(i => i.CupomId).HasColumnName("cupom_id");
            e.Property(i => i.Ordem).HasColumnName("ordem");
            e.Property(i => i.ProdutoId).HasColumnName("produto_id");
            e.Property(i => i.Descricao).HasColumnName("descricao").HasMaxLength(200);
            e.Property(i => i.Codigo).HasColumnName("codigo").HasMaxLength(60);
            e.Property(i => i.CodigoBarras).HasColumnName("codigo_barras").HasMaxLength(50);
            e.Property(i => i.CustoUnitario).HasColumnName("custo_unitario").HasPrecision(14, 2);
            e.Property(i => i.Quantidade).HasColumnName("quantidade").HasPrecision(14, 3);
            e.Property(i => i.ValorUnitario).HasColumnName("valor_unitario").HasPrecision(14, 2);
            e.Property(i => i.Total).HasColumnName("total").HasPrecision(14, 2);
            e.HasIndex(i => new { i.CupomId, i.Ordem });
            e.HasOne(i => i.Cupom).WithMany(c => c.Itens).HasForeignKey(i => i.CupomId).OnDelete(DeleteBehavior.Cascade);
            // Excluir o produto não apaga o item (descrição e valores ficaram copiados).
            e.HasOne<Produto>().WithMany().HasForeignKey(i => i.ProdutoId).OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<CodigoLogin>(e =>
        {
            e.ToTable("codigos_login");
            e.Property(c => c.Id).HasColumnName("id");
            e.Property(c => c.UsuarioId).HasColumnName("usuario_id");
            e.Property(c => c.CodigoHash).HasColumnName("codigo_hash").HasMaxLength(64);
            e.Property(c => c.ExpiraEm).HasColumnName("expira_em");
            e.Property(c => c.EnviadoEm).HasColumnName("enviado_em");
            e.Property(c => c.Tentativas).HasColumnName("tentativas");
            e.Property(c => c.NovoEmail).HasColumnName("novo_email").HasMaxLength(254);
            e.Property(c => c.Canal).HasColumnName("canal").HasMaxLength(10);
            e.Property(c => c.UsadoEm).HasColumnName("usado_em");
            e.Property(c => c.CriadoEm).HasColumnName("criado_em");
            e.HasOne(c => c.Usuario).WithMany().HasForeignKey(c => c.UsuarioId).OnDelete(DeleteBehavior.Cascade);
        });
    }
}
