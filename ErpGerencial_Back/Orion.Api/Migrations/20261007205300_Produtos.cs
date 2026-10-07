using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Orion.Api.Migrations
{
    /// <inheritdoc />
    public partial class Produtos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "produtos",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    empresa_id = table.Column<Guid>(type: "uuid", nullable: false),
                    numero = table.Column<int>(type: "integer", nullable: false),
                    nome = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    codigo = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    preco_custo = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    preco_venda_pf = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    preco_venda_pj = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    quantidade = table.Column<decimal>(type: "numeric(14,3)", precision: 14, scale: 3, nullable: false),
                    marca = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    modelo = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    cor = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    voltagem = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    observacao = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    criado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    atualizado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_produtos", x => x.id);
                    table.ForeignKey(
                        name: "FK_produtos_empresas_empresa_id",
                        column: x => x.empresa_id,
                        principalTable: "empresas",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_produtos_empresa_id_codigo",
                table: "produtos",
                columns: new[] { "empresa_id", "codigo" },
                unique: true,
                filter: "codigo IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_produtos_empresa_id_numero",
                table: "produtos",
                columns: new[] { "empresa_id", "numero" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "produtos");
        }
    }
}
