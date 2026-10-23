using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Orion.Api.Migrations
{
    /// <inheritdoc />
    public partial class CaixaFinanceiroHistorico : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "forma_pagamento2",
                table: "cupons",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "valor_pagamento1",
                table: "cupons",
                type: "numeric(14,2)",
                precision: 14,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "valor_pagamento2",
                table: "cupons",
                type: "numeric(14,2)",
                precision: 14,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "vendedor_id",
                table: "cupons",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "vendedor_nome",
                table: "cupons",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "codigo_barras",
                table: "cupom_itens",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "custo_unitario",
                table: "cupom_itens",
                type: "numeric(14,2)",
                precision: 14,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateIndex(
                name: "IX_cupons_empresa_id_emitido_em",
                table: "cupons",
                columns: new[] { "empresa_id", "emitido_em" });

            migrationBuilder.CreateIndex(
                name: "IX_cupons_vendedor_id",
                table: "cupons",
                column: "vendedor_id");

            migrationBuilder.AddForeignKey(
                name: "FK_cupons_usuarios_vendedor_id",
                table: "cupons",
                column: "vendedor_id",
                principalTable: "usuarios",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_cupons_usuarios_vendedor_id",
                table: "cupons");

            migrationBuilder.DropIndex(
                name: "IX_cupons_empresa_id_emitido_em",
                table: "cupons");

            migrationBuilder.DropIndex(
                name: "IX_cupons_vendedor_id",
                table: "cupons");

            migrationBuilder.DropColumn(
                name: "forma_pagamento2",
                table: "cupons");

            migrationBuilder.DropColumn(
                name: "valor_pagamento1",
                table: "cupons");

            migrationBuilder.DropColumn(
                name: "valor_pagamento2",
                table: "cupons");

            migrationBuilder.DropColumn(
                name: "vendedor_id",
                table: "cupons");

            migrationBuilder.DropColumn(
                name: "vendedor_nome",
                table: "cupons");

            migrationBuilder.DropColumn(
                name: "codigo_barras",
                table: "cupom_itens");

            migrationBuilder.DropColumn(
                name: "custo_unitario",
                table: "cupom_itens");
        }
    }
}
