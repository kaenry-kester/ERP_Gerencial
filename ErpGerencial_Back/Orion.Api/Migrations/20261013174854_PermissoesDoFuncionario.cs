using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Orion.Api.Migrations
{
    /// <summary>
    /// Fim do acesso "Personalizado": todo usuário que não é administrador vira funcionário, com as
    /// permissões fixas (ver produtos, ver clientes e cadastrar cliente). Ver Auth/Permissoes.cs.
    /// </summary>
    public partial class PermissoesDoFuncionario : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                "UPDATE usuarios SET permissoes = ARRAY['produtos', 'clientes', 'clientes-cadastrar'] WHERE NOT administrador;");
            migrationBuilder.Sql("UPDATE usuarios SET permissoes = '{}' WHERE administrador;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // As permissões personalizadas de antes não são guardadas: voltar mantém as do funcionário.
        }
    }
}
