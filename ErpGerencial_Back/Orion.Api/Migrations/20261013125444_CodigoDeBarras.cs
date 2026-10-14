using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Orion.Api.Migrations
{
    /// <inheritdoc />
    public partial class CodigoDeBarras : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "codigo_barras",
                table: "produtos",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_produtos_empresa_id_codigo_barras",
                table: "produtos",
                columns: new[] { "empresa_id", "codigo_barras" },
                unique: true,
                filter: "codigo_barras IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_produtos_empresa_id_codigo_barras",
                table: "produtos");

            migrationBuilder.DropColumn(
                name: "codigo_barras",
                table: "produtos");
        }
    }
}
