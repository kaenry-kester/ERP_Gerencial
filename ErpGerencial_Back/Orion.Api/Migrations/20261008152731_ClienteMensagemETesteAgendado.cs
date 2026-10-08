using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Orion.Api.Migrations
{
    /// <inheritdoc />
    public partial class ClienteMensagemETesteAgendado : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_envios_whatsapp_cliente_id_data_referencia",
                table: "envios_whatsapp");

            migrationBuilder.AddColumn<string>(
                name: "tipo",
                table: "envios_whatsapp",
                type: "character varying(12)",
                maxLength: 12,
                nullable: false,
                defaultValue: "manutencao");

            migrationBuilder.AddColumn<DateTime>(
                name: "envio_teste_em",
                table: "clientes",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "mensagem_whatsapp",
                table: "clientes",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_envios_whatsapp_cliente_id_data_referencia",
                table: "envios_whatsapp",
                columns: new[] { "cliente_id", "data_referencia" },
                unique: true,
                filter: "tipo = 'manutencao'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_envios_whatsapp_cliente_id_data_referencia",
                table: "envios_whatsapp");

            migrationBuilder.DropColumn(
                name: "tipo",
                table: "envios_whatsapp");

            migrationBuilder.DropColumn(
                name: "envio_teste_em",
                table: "clientes");

            migrationBuilder.DropColumn(
                name: "mensagem_whatsapp",
                table: "clientes");

            migrationBuilder.CreateIndex(
                name: "IX_envios_whatsapp_cliente_id_data_referencia",
                table: "envios_whatsapp",
                columns: new[] { "cliente_id", "data_referencia" },
                unique: true);
        }
    }
}
