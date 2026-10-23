using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Orion.Api.Migrations
{
    /// <inheritdoc />
    public partial class RemoverEmissorFiscalNotaGov : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "cest",
                table: "produtos");

            migrationBuilder.DropColumn(
                name: "cfop",
                table: "produtos");

            migrationBuilder.DropColumn(
                name: "cst_csosn",
                table: "produtos");

            migrationBuilder.DropColumn(
                name: "ncm",
                table: "produtos");

            migrationBuilder.DropColumn(
                name: "origem",
                table: "produtos");

            migrationBuilder.DropColumn(
                name: "fiscal_ambiente",
                table: "empresas");

            migrationBuilder.DropColumn(
                name: "fiscal_token",
                table: "empresas");

            migrationBuilder.DropColumn(
                name: "inscricao_estadual",
                table: "empresas");

            migrationBuilder.DropColumn(
                name: "regime_tributario",
                table: "empresas");

            migrationBuilder.DropColumn(
                name: "nfce_chave",
                table: "cupons");

            migrationBuilder.DropColumn(
                name: "nfce_mensagem",
                table: "cupons");

            migrationBuilder.DropColumn(
                name: "nfce_numero",
                table: "cupons");

            migrationBuilder.DropColumn(
                name: "nfce_qrcode",
                table: "cupons");

            migrationBuilder.DropColumn(
                name: "nfce_ref",
                table: "cupons");

            migrationBuilder.DropColumn(
                name: "nfce_status",
                table: "cupons");

            migrationBuilder.DropColumn(
                name: "nfce_url_danfe",
                table: "cupons");

            migrationBuilder.DropColumn(
                name: "nota_modelo",
                table: "cupons");

            migrationBuilder.RenameColumn(
                name: "nfce_serie",
                table: "cupons",
                newName: "nota_tipo");

            migrationBuilder.RenameColumn(
                name: "nfce_emitida_em",
                table: "cupons",
                newName: "nota_registrada_em");

            migrationBuilder.AddColumn<string>(
                name: "nota_numero",
                table: "cupons",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "nota_numero",
                table: "cupons");

            migrationBuilder.RenameColumn(
                name: "nota_tipo",
                table: "cupons",
                newName: "nfce_serie");

            migrationBuilder.RenameColumn(
                name: "nota_registrada_em",
                table: "cupons",
                newName: "nfce_emitida_em");

            migrationBuilder.AddColumn<string>(
                name: "cest",
                table: "produtos",
                type: "character varying(7)",
                maxLength: 7,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "cfop",
                table: "produtos",
                type: "character varying(4)",
                maxLength: 4,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "cst_csosn",
                table: "produtos",
                type: "character varying(3)",
                maxLength: 3,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ncm",
                table: "produtos",
                type: "character varying(8)",
                maxLength: 8,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "origem",
                table: "produtos",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "fiscal_ambiente",
                table: "empresas",
                type: "character varying(12)",
                maxLength: 12,
                nullable: false,
                defaultValue: "desligado");

            migrationBuilder.AddColumn<string>(
                name: "fiscal_token",
                table: "empresas",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "inscricao_estadual",
                table: "empresas",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "regime_tributario",
                table: "empresas",
                type: "integer",
                nullable: false,
                defaultValue: 4);

            migrationBuilder.AddColumn<string>(
                name: "nfce_chave",
                table: "cupons",
                type: "character varying(44)",
                maxLength: 44,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "nfce_mensagem",
                table: "cupons",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "nfce_numero",
                table: "cupons",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "nfce_qrcode",
                table: "cupons",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "nfce_ref",
                table: "cupons",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "nfce_status",
                table: "cupons",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "nfce_url_danfe",
                table: "cupons",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "nota_modelo",
                table: "cupons",
                type: "character varying(4)",
                maxLength: 4,
                nullable: true);
        }
    }
}
