using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Orion.Api.Migrations
{
    /// <inheritdoc />
    public partial class EmpresaSempreMei : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "regime_tributario",
                table: "empresas",
                type: "integer",
                nullable: false,
                defaultValue: 4,
                oldClrType: typeof(int),
                oldType: "integer",
                oldDefaultValue: 1);

            // Todas as empresas emitem como MEI
            migrationBuilder.Sql("UPDATE empresas SET regime_tributario = 4;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "regime_tributario",
                table: "empresas",
                type: "integer",
                nullable: false,
                defaultValue: 1,
                oldClrType: typeof(int),
                oldType: "integer",
                oldDefaultValue: 4);
        }
    }
}
