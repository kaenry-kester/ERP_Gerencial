using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Orion.Api.Migrations
{
    /// <inheritdoc />
    public partial class NotaFiscalEmpresa : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "nota_modelo",
                table: "cupons",
                type: "character varying(4)",
                maxLength: 4,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "nota_modelo",
                table: "cupons");
        }
    }
}
