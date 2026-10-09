using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Orion.Api.Migrations
{
    /// <inheritdoc />
    public partial class EnvioPorDataEHora : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "mensagem_automatica_ativa",
                table: "empresas");

            migrationBuilder.RenameColumn(
                name: "envio_teste_em",
                table: "clientes",
                newName: "envio_em");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "envio_em",
                table: "clientes",
                newName: "envio_teste_em");

            migrationBuilder.AddColumn<bool>(
                name: "mensagem_automatica_ativa",
                table: "empresas",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }
    }
}
