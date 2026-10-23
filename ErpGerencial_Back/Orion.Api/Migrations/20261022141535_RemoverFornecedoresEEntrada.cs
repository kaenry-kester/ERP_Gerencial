using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Orion.Api.Migrations
{
    /// <inheritdoc />
    public partial class RemoverFornecedoresEEntrada : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_movimentos_estoque_fornecedores_fornecedor_id",
                table: "movimentos_estoque");

            migrationBuilder.DropForeignKey(
                name: "FK_produtos_fornecedores_fornecedor_id",
                table: "produtos");

            migrationBuilder.DropTable(
                name: "fornecedores");

            migrationBuilder.DropIndex(
                name: "IX_produtos_fornecedor_id",
                table: "produtos");

            migrationBuilder.DropIndex(
                name: "IX_movimentos_estoque_fornecedor_id",
                table: "movimentos_estoque");

            migrationBuilder.DropColumn(
                name: "fornecedor_id",
                table: "produtos");

            migrationBuilder.DropColumn(
                name: "documento",
                table: "movimentos_estoque");

            migrationBuilder.DropColumn(
                name: "fornecedor_id",
                table: "movimentos_estoque");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "fornecedor_id",
                table: "produtos",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "documento",
                table: "movimentos_estoque",
                type: "character varying(60)",
                maxLength: 60,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "fornecedor_id",
                table: "movimentos_estoque",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "fornecedores",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    atualizado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    contato = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    criado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    documento = table.Column<string>(type: "character varying(14)", maxLength: 14, nullable: true),
                    email = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: true),
                    empresa_id = table.Column<Guid>(type: "uuid", nullable: false),
                    nome = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    numero = table.Column<int>(type: "integer", nullable: false),
                    observacao = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    telefone = table.Column<string>(type: "character varying(11)", maxLength: 11, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_fornecedores", x => x.id);
                    table.ForeignKey(
                        name: "FK_fornecedores_empresas_empresa_id",
                        column: x => x.empresa_id,
                        principalTable: "empresas",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_produtos_fornecedor_id",
                table: "produtos",
                column: "fornecedor_id");

            migrationBuilder.CreateIndex(
                name: "IX_movimentos_estoque_fornecedor_id",
                table: "movimentos_estoque",
                column: "fornecedor_id");

            migrationBuilder.CreateIndex(
                name: "IX_fornecedores_empresa_id_documento",
                table: "fornecedores",
                columns: new[] { "empresa_id", "documento" },
                unique: true,
                filter: "documento IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_fornecedores_empresa_id_numero",
                table: "fornecedores",
                columns: new[] { "empresa_id", "numero" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_movimentos_estoque_fornecedores_fornecedor_id",
                table: "movimentos_estoque",
                column: "fornecedor_id",
                principalTable: "fornecedores",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_produtos_fornecedores_fornecedor_id",
                table: "produtos",
                column: "fornecedor_id",
                principalTable: "fornecedores",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }
    }
}
