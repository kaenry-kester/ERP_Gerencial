using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Orion.Api.Migrations
{
    /// <inheritdoc />
    public partial class IntervaloComUnidadeEImagemDaMensagem : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "intervalo_manutencao_meses",
                table: "clientes",
                newName: "intervalo_quantidade");

            migrationBuilder.AddColumn<string>(
                name: "intervalo_unidade",
                table: "clientes",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "meses");

            migrationBuilder.CreateTable(
                name: "mensagem_imagens",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    empresa_id = table.Column<Guid>(type: "uuid", nullable: false),
                    cliente_id = table.Column<Guid>(type: "uuid", nullable: true),
                    tipo_conteudo = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    dados = table.Column<byte[]>(type: "bytea", nullable: false),
                    criado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_mensagem_imagens", x => x.id);
                    table.ForeignKey(
                        name: "FK_mensagem_imagens_clientes_cliente_id",
                        column: x => x.cliente_id,
                        principalTable: "clientes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_mensagem_imagens_empresas_empresa_id",
                        column: x => x.empresa_id,
                        principalTable: "empresas",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_mensagem_imagens_cliente_id",
                table: "mensagem_imagens",
                column: "cliente_id",
                unique: true,
                filter: "cliente_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_mensagem_imagens_empresa_id",
                table: "mensagem_imagens",
                column: "empresa_id",
                unique: true,
                filter: "cliente_id IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "mensagem_imagens");

            migrationBuilder.DropColumn(
                name: "intervalo_unidade",
                table: "clientes");

            migrationBuilder.RenameColumn(
                name: "intervalo_quantidade",
                table: "clientes",
                newName: "intervalo_manutencao_meses");
        }
    }
}
