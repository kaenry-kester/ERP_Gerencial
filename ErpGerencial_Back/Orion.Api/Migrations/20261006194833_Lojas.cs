using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Orion.Api.Migrations
{
    /// <inheritdoc />
    public partial class Lojas : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "lojas",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    usuario_id = table.Column<Guid>(type: "uuid", nullable: false),
                    razao_social = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    nome_fantasia = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    cnpj = table.Column<string>(type: "character(14)", fixedLength: true, maxLength: 14, nullable: false),
                    nome_dono = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    cpf_dono = table.Column<string>(type: "character(11)", fixedLength: true, maxLength: 11, nullable: false),
                    email = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: false),
                    celular = table.Column<string>(type: "character varying(11)", maxLength: 11, nullable: false),
                    senha_hash = table.Column<string>(type: "text", nullable: false),
                    criado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lojas", x => x.id);
                    table.ForeignKey(
                        name: "FK_lojas_usuarios_usuario_id",
                        column: x => x.usuario_id,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_lojas_cnpj",
                table: "lojas",
                column: "cnpj",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_lojas_usuario_id",
                table: "lojas",
                column: "usuario_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "lojas");
        }
    }
}
