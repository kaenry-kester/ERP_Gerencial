using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Orion.Api.Migrations
{
    /// <inheritdoc />
    public partial class TipoDeIntervalo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "intervalo_manutencao_meses",
                table: "clientes",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AddColumn<string>(
                name: "tipo_intervalo",
                table: "clientes",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "meses");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "tipo_intervalo",
                table: "clientes");

            migrationBuilder.AlterColumn<int>(
                name: "intervalo_manutencao_meses",
                table: "clientes",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);
        }
    }
}
