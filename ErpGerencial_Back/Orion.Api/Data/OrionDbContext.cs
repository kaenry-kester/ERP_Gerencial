using Microsoft.EntityFrameworkCore;

namespace Orion.Api.Data;

public class OrionDbContext(DbContextOptions<OrionDbContext> options) : DbContext(options)
{
    public DbSet<Usuario> Usuarios => Set<Usuario>();
    public DbSet<Loja> Lojas => Set<Loja>();

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
            e.Property(u => u.CriadoEm).HasColumnName("criado_em");
            e.HasIndex(u => u.Email).IsUnique();
            e.HasIndex(u => u.GoogleId).IsUnique();
        });

        modelBuilder.Entity<Loja>(e =>
        {
            e.ToTable("lojas");
            e.Property(l => l.Id).HasColumnName("id");
            e.Property(l => l.UsuarioId).HasColumnName("usuario_id");
            e.Property(l => l.RazaoSocial).HasColumnName("razao_social").HasMaxLength(150);
            e.Property(l => l.NomeFantasia).HasColumnName("nome_fantasia").HasMaxLength(100);
            e.Property(l => l.Cnpj).HasColumnName("cnpj").HasMaxLength(14).IsFixedLength();
            e.Property(l => l.NomeDono).HasColumnName("nome_dono").HasMaxLength(120);
            e.Property(l => l.CpfDono).HasColumnName("cpf_dono").HasMaxLength(11).IsFixedLength();
            e.Property(l => l.Email).HasColumnName("email").HasMaxLength(254);
            e.Property(l => l.Celular).HasColumnName("celular").HasMaxLength(11);
            e.Property(l => l.SenhaHash).HasColumnName("senha_hash");
            e.Property(l => l.CriadoEm).HasColumnName("criado_em");
            e.HasIndex(l => l.Cnpj).IsUnique();
            e.HasOne(l => l.Usuario)
                .WithMany()
                .HasForeignKey(l => l.UsuarioId)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }
}
