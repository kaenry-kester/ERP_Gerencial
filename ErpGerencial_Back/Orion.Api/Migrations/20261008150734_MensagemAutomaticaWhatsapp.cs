using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Orion.Api.Migrations
{
    /// <inheritdoc />
    public partial class MensagemAutomaticaWhatsapp : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "mensagem_automatica_ativa",
                table: "empresas",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "mensagem_manutencao",
                table: "empresas",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "whatsapp_remetente",
                table: "empresas",
                type: "character varying(11)",
                maxLength: 11,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "envios_whatsapp",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    empresa_id = table.Column<Guid>(type: "uuid", nullable: false),
                    cliente_id = table.Column<Guid>(type: "uuid", nullable: false),
                    data_referencia = table.Column<DateOnly>(type: "date", nullable: false),
                    telefone = table.Column<string>(type: "character varying(13)", maxLength: 13, nullable: false),
                    mensagem = table.Column<string>(type: "character varying(1200)", maxLength: 1200, nullable: false),
                    status = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    erro = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    criado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_envios_whatsapp", x => x.id);
                    table.ForeignKey(
                        name: "FK_envios_whatsapp_clientes_cliente_id",
                        column: x => x.cliente_id,
                        principalTable: "clientes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_envios_whatsapp_empresas_empresa_id",
                        column: x => x.empresa_id,
                        principalTable: "empresas",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_envios_whatsapp_cliente_id_data_referencia",
                table: "envios_whatsapp",
                columns: new[] { "cliente_id", "data_referencia" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_envios_whatsapp_empresa_id_criado_em",
                table: "envios_whatsapp",
                columns: new[] { "empresa_id", "criado_em" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "envios_whatsapp");

            migrationBuilder.DropColumn(
                name: "mensagem_automatica_ativa",
                table: "empresas");

            migrationBuilder.DropColumn(
                name: "mensagem_manutencao",
                table: "empresas");

            migrationBuilder.DropColumn(
                name: "whatsapp_remetente",
                table: "empresas");
        }
    }
}
