using Microsoft.EntityFrameworkCore;

namespace Orion.Api.Data;

public class OrionDbContext(DbContextOptions<OrionDbContext> options) : DbContext(options)
{
    public DbSet<Usuario> Usuarios => Set<Usuario>();

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
            e.Property(u => u.CriadoEm).HasColumnName("criado_em");
            e.HasIndex(u => u.Email).IsUnique();
        });
    }
}
