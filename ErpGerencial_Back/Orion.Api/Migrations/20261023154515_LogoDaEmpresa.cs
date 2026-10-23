using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Orion.Api.Migrations
{
    /// <inheritdoc />
    public partial class LogoDaEmpresa : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "logo_horizontal_id",
                table: "empresas",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "logo_quadrada_id",
                table: "empresas",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "empresa_logos",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    empresa_id = table.Column<Guid>(type: "uuid", nullable: false),
                    tipo_conteudo = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    dados = table.Column<byte[]>(type: "bytea", nullable: false),
                    criado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_empresa_logos", x => x.id);
                    table.ForeignKey(
                        name: "FK_empresa_logos_empresas_empresa_id",
                        column: x => x.empresa_id,
                        principalTable: "empresas",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_empresa_logos_empresa_id",
                table: "empresa_logos",
                column: "empresa_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "empresa_logos");

            migrationBuilder.DropColumn(
                name: "logo_horizontal_id",
                table: "empresas");

            migrationBuilder.DropColumn(
                name: "logo_quadrada_id",
                table: "empresas");
        }
    }
}
