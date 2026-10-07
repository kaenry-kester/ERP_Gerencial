using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Orion.Api.Migrations
{
    /// <inheritdoc />
    public partial class EmpresasEUsuarios : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "administrador",
                table: "usuarios",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "ativo",
                table: "usuarios",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<Guid>(
                name: "empresa_id",
                table: "usuarios",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<List<string>>(
                name: "permissoes",
                table: "usuarios",
                type: "text[]",
                nullable: false,
                defaultValueSql: "'{}'");

            migrationBuilder.CreateTable(
                name: "empresas",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    nome = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    razao_social = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    documento = table.Column<string>(type: "character varying(14)", maxLength: 14, nullable: true),
                    email = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: true),
                    telefone = table.Column<string>(type: "character varying(11)", maxLength: 11, nullable: true),
                    criado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_empresas", x => x.id);
                });

            // Cada loja vira a empresa da conta que a criou (a mais antiga, se houver mais de uma),
            // e essa pessoa vira a administradora. Depois a tabela de lojas sai.
            migrationBuilder.Sql("""
                INSERT INTO empresas (id, nome, razao_social, documento, email, telefone, criado_em)
                SELECT DISTINCT ON (usuario_id) id, nome_fantasia, razao_social, trim(cnpj), email, celular, criado_em
                FROM lojas
                ORDER BY usuario_id, criado_em;

                UPDATE usuarios u
                SET empresa_id = e.id, administrador = true
                FROM lojas l
                JOIN empresas e ON e.id = l.id
                WHERE l.usuario_id = u.id;
                """);

            migrationBuilder.DropTable(
                name: "lojas");

            migrationBuilder.CreateIndex(
                name: "IX_usuarios_empresa_id",
                table: "usuarios",
                column: "empresa_id");

            migrationBuilder.CreateIndex(
                name: "IX_empresas_documento",
                table: "empresas",
                column: "documento",
                unique: true,
                filter: "documento IS NOT NULL");

            migrationBuilder.AddForeignKey(
                name: "FK_usuarios_empresas_empresa_id",
                table: "usuarios",
                column: "empresa_id",
                principalTable: "empresas",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_usuarios_empresas_empresa_id",
                table: "usuarios");

            migrationBuilder.DropTable(
                name: "empresas");

            migrationBuilder.DropIndex(
                name: "IX_usuarios_empresa_id",
                table: "usuarios");

            migrationBuilder.DropColumn(
                name: "administrador",
                table: "usuarios");

            migrationBuilder.DropColumn(
                name: "ativo",
                table: "usuarios");

            migrationBuilder.DropColumn(
                name: "empresa_id",
                table: "usuarios");

            migrationBuilder.DropColumn(
                name: "permissoes",
                table: "usuarios");

            migrationBuilder.CreateTable(
                name: "lojas",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    usuario_id = table.Column<Guid>(type: "uuid", nullable: false),
                    celular = table.Column<string>(type: "character varying(11)", maxLength: 11, nullable: false),
                    cnpj = table.Column<string>(type: "character(14)", fixedLength: true, maxLength: 14, nullable: false),
                    cpf_dono = table.Column<string>(type: "character(11)", fixedLength: true, maxLength: 11, nullable: false),
                    criado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    email = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: false),
                    nome_dono = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    nome_fantasia = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    razao_social = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    senha_hash = table.Column<string>(type: "text", nullable: false)
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
    }
}
