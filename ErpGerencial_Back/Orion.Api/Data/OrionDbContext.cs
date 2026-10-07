using Microsoft.EntityFrameworkCore;

namespace Orion.Api.Data;

public class OrionDbContext(DbContextOptions<OrionDbContext> options) : DbContext(options)
{
    public DbSet<Usuario> Usuarios => Set<Usuario>();
    public DbSet<Empresa> Empresas => Set<Empresa>();
    public DbSet<Produto> Produtos => Set<Produto>();
    public DbSet<CodigoLogin> CodigosLogin => Set<CodigoLogin>();
    public DbSet<DispositivoConfiavel> DispositivosConfiaveis => Set<DispositivoConfiavel>();

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
            e.Property(u => u.GoogleId).HasColumnName("google_id").HasMaxLength(255);
            e.Property(u => u.EmpresaId).HasColumnName("empresa_id");
            e.Property(u => u.Administrador).HasColumnName("administrador");
            e.Property(u => u.Permissoes).HasColumnName("permissoes");
            e.Property(u => u.Ativo).HasColumnName("ativo").HasDefaultValue(true);
            e.Property(u => u.CriadoEm).HasColumnName("criado_em");
            e.HasIndex(u => u.Email).IsUnique();
            e.HasIndex(u => u.GoogleId).IsUnique();
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
            e.Property(emp => emp.CriadoEm).HasColumnName("criado_em");
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
            // ID sequencial e código não se repetem dentro da mesma empresa.
            e.HasIndex(p => new { p.EmpresaId, p.Numero }).IsUnique();
            e.HasIndex(p => new { p.EmpresaId, p.Codigo }).IsUnique().HasFilter("codigo IS NOT NULL");
            e.HasOne(p => p.Empresa).WithMany().HasForeignKey(p => p.EmpresaId).OnDelete(DeleteBehavior.Cascade);
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
            e.Property(c => c.UsadoEm).HasColumnName("usado_em");
            e.Property(c => c.CriadoEm).HasColumnName("criado_em");
            e.HasOne(c => c.Usuario).WithMany().HasForeignKey(c => c.UsuarioId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<DispositivoConfiavel>(e =>
        {
            e.ToTable("dispositivos_confiaveis");
            e.Property(d => d.Id).HasColumnName("id");
            e.Property(d => d.UsuarioId).HasColumnName("usuario_id");
            e.Property(d => d.TokenHash).HasColumnName("token_hash").HasMaxLength(64);
            e.Property(d => d.Descricao).HasColumnName("descricao").HasMaxLength(300);
            e.Property(d => d.ExpiraEm).HasColumnName("expira_em");
            e.Property(d => d.CriadoEm).HasColumnName("criado_em");
            e.Property(d => d.UltimoUsoEm).HasColumnName("ultimo_uso_em");
            e.HasIndex(d => d.TokenHash).IsUnique();
            e.HasOne(d => d.Usuario).WithMany().HasForeignKey(d => d.UsuarioId).OnDelete(DeleteBehavior.Cascade);
        });
    }
}
