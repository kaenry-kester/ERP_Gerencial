using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Orion.Api.Migrations
{
    /// <inheritdoc />
    public partial class CuponsERecibos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "cidade",
                table: "empresas",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "endereco",
                table: "empresas",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "uf",
                table: "empresas",
                type: "character varying(2)",
                maxLength: 2,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "cupons",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    empresa_id = table.Column<Guid>(type: "uuid", nullable: false),
                    numero = table.Column<int>(type: "integer", nullable: false),
                    emitente_nome = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    emitente_razao_social = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    emitente_documento = table.Column<string>(type: "character varying(14)", maxLength: 14, nullable: true),
                    emitente_endereco = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    emitente_cidade = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    emitente_uf = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: true),
                    emitente_telefone = table.Column<string>(type: "character varying(11)", maxLength: 11, nullable: true),
                    cliente_id = table.Column<Guid>(type: "uuid", nullable: true),
                    cliente_nome = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    cliente_documento = table.Column<string>(type: "character varying(14)", maxLength: 14, nullable: true),
                    cliente_endereco = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    subtotal = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    desconto = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    total = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    forma_pagamento = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    valor_recebido = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: true),
                    referente = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    observacao = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    emitido_por = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    usuario_id = table.Column<Guid>(type: "uuid", nullable: true),
                    emitido_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    cancelado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    motivo_cancelamento = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_cupons", x => x.id);
                    table.ForeignKey(
                        name: "FK_cupons_clientes_cliente_id",
                        column: x => x.cliente_id,
                        principalTable: "clientes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_cupons_empresas_empresa_id",
                        column: x => x.empresa_id,
                        principalTable: "empresas",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_cupons_usuarios_usuario_id",
                        column: x => x.usuario_id,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "cupom_itens",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    cupom_id = table.Column<Guid>(type: "uuid", nullable: false),
                    ordem = table.Column<int>(type: "integer", nullable: false),
                    produto_id = table.Column<Guid>(type: "uuid", nullable: true),
                    descricao = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    codigo = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    quantidade = table.Column<decimal>(type: "numeric(14,3)", precision: 14, scale: 3, nullable: false),
                    valor_unitario = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    total = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_cupom_itens", x => x.id);
                    table.ForeignKey(
                        name: "FK_cupom_itens_cupons_cupom_id",
                        column: x => x.cupom_id,
                        principalTable: "cupons",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_cupom_itens_produtos_produto_id",
                        column: x => x.produto_id,
                        principalTable: "produtos",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_cupom_itens_cupom_id_ordem",
                table: "cupom_itens",
                columns: new[] { "cupom_id", "ordem" });

            migrationBuilder.CreateIndex(
                name: "IX_cupom_itens_produto_id",
                table: "cupom_itens",
                column: "produto_id");

            migrationBuilder.CreateIndex(
                name: "IX_cupons_cliente_id",
                table: "cupons",
                column: "cliente_id");

            migrationBuilder.CreateIndex(
                name: "IX_cupons_empresa_id_numero",
                table: "cupons",
                columns: new[] { "empresa_id", "numero" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_cupons_usuario_id",
                table: "cupons",
                column: "usuario_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "cupom_itens");

            migrationBuilder.DropTable(
                name: "cupons");

            migrationBuilder.DropColumn(
                name: "cidade",
                table: "empresas");

            migrationBuilder.DropColumn(
                name: "endereco",
                table: "empresas");

            migrationBuilder.DropColumn(
                name: "uf",
                table: "empresas");
        }
    }
}
