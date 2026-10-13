using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Orion.Api.Migrations
{
    /// <inheritdoc />
    public partial class FichaDoCliente : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "celular2",
                table: "clientes",
                type: "character varying(11)",
                maxLength: 11,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "conjuge",
                table: "clientes",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "data_compra",
                table: "clientes",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "data_nascimento",
                table: "clientes",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ponto_referencia",
                table: "clientes",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "produto",
                table: "clientes",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "rg_inscricao",
                table: "clientes",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "telefone_comercial",
                table: "clientes",
                type: "character varying(11)",
                maxLength: 11,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "telefone_residencial",
                table: "clientes",
                type: "character varying(11)",
                maxLength: 11,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "celular2",
                table: "clientes");

            migrationBuilder.DropColumn(
                name: "conjuge",
                table: "clientes");

            migrationBuilder.DropColumn(
                name: "data_compra",
                table: "clientes");

            migrationBuilder.DropColumn(
                name: "data_nascimento",
                table: "clientes");

            migrationBuilder.DropColumn(
                name: "ponto_referencia",
                table: "clientes");

            migrationBuilder.DropColumn(
                name: "produto",
                table: "clientes");

            migrationBuilder.DropColumn(
                name: "rg_inscricao",
                table: "clientes");

            migrationBuilder.DropColumn(
                name: "telefone_comercial",
                table: "clientes");

            migrationBuilder.DropColumn(
                name: "telefone_residencial",
                table: "clientes");
        }
    }
}
