using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Orion.Api.Migrations
{
    /// <inheritdoc />
    public partial class RemoverCaixaEOrdemServico : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_cupons_caixas_caixa_id",
                table: "cupons");

            migrationBuilder.DropForeignKey(
                name: "FK_cupons_ordens_servico_ordem_servico_id",
                table: "cupons");

            migrationBuilder.DropTable(
                name: "movimentos_caixa");

            migrationBuilder.DropTable(
                name: "ordem_servico_itens");

            migrationBuilder.DropTable(
                name: "caixas");

            migrationBuilder.DropTable(
                name: "ordens_servico");

            migrationBuilder.DropIndex(
                name: "IX_cupons_caixa_id",
                table: "cupons");

            migrationBuilder.DropIndex(
                name: "IX_cupons_ordem_servico_id",
                table: "cupons");

            migrationBuilder.DropColumn(
                name: "caixa_id",
                table: "cupons");

            migrationBuilder.DropColumn(
                name: "ordem_servico_id",
                table: "cupons");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "caixa_id",
                table: "cupons",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ordem_servico_id",
                table: "cupons",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "caixas",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    aberto_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    empresa_id = table.Column<Guid>(type: "uuid", nullable: false),
                    fechado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    fechado_por = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    numero = table.Column<int>(type: "integer", nullable: false),
                    observacao = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    operador_nome = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    usuario_id = table.Column<Guid>(type: "uuid", nullable: true),
                    valor_abertura = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    valor_contado = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: true),
                    valor_esperado = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_caixas", x => x.id);
                    table.ForeignKey(
                        name: "FK_caixas_empresas_empresa_id",
                        column: x => x.empresa_id,
                        principalTable: "empresas",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_caixas_usuarios_usuario_id",
                        column: x => x.usuario_id,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "ordens_servico",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    aberta_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    acessorios = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    atualizada_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    cliente_celular = table.Column<string>(type: "character varying(11)", maxLength: 11, nullable: true),
                    cliente_id = table.Column<Guid>(type: "uuid", nullable: true),
                    cliente_nome = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    concluida_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    criado_por = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    cupom_id = table.Column<Guid>(type: "uuid", nullable: true),
                    defeito = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    diagnostico = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    empresa_id = table.Column<Guid>(type: "uuid", nullable: false),
                    entregue_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    equipamento = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    garantia = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    marca = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    modelo = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    numero = table.Column<int>(type: "integer", nullable: false),
                    numero_serie = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    observacao = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    previsao_em = table.Column<DateOnly>(type: "date", nullable: true),
                    servico = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "aberta"),
                    tecnico_id = table.Column<Guid>(type: "uuid", nullable: true),
                    tecnico_nome = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ordens_servico", x => x.id);
                    table.ForeignKey(
                        name: "FK_ordens_servico_clientes_cliente_id",
                        column: x => x.cliente_id,
                        principalTable: "clientes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_ordens_servico_cupons_cupom_id",
                        column: x => x.cupom_id,
                        principalTable: "cupons",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_ordens_servico_empresas_empresa_id",
                        column: x => x.empresa_id,
                        principalTable: "empresas",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ordens_servico_usuarios_tecnico_id",
                        column: x => x.tecnico_id,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "movimentos_caixa",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    caixa_id = table.Column<Guid>(type: "uuid", nullable: false),
                    criado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    motivo = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    tipo = table.Column<string>(type: "character varying(12)", maxLength: 12, nullable: false),
                    usuario_nome = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    valor = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_movimentos_caixa", x => x.id);
                    table.ForeignKey(
                        name: "FK_movimentos_caixa_caixas_caixa_id",
                        column: x => x.caixa_id,
                        principalTable: "caixas",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ordem_servico_itens",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    ordem_servico_id = table.Column<Guid>(type: "uuid", nullable: false),
                    descricao = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    ordem = table.Column<int>(type: "integer", nullable: false),
                    produto_id = table.Column<Guid>(type: "uuid", nullable: true),
                    quantidade = table.Column<decimal>(type: "numeric(14,3)", precision: 14, scale: 3, nullable: false),
                    total = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    valor_unitario = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ordem_servico_itens", x => x.id);
                    table.ForeignKey(
                        name: "FK_ordem_servico_itens_ordens_servico_ordem_servico_id",
                        column: x => x.ordem_servico_id,
                        principalTable: "ordens_servico",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ordem_servico_itens_produtos_produto_id",
                        column: x => x.produto_id,
                        principalTable: "produtos",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_cupons_caixa_id",
                table: "cupons",
                column: "caixa_id");

            migrationBuilder.CreateIndex(
                name: "IX_cupons_ordem_servico_id",
                table: "cupons",
                column: "ordem_servico_id");

            migrationBuilder.CreateIndex(
                name: "IX_caixas_empresa_id_numero",
                table: "caixas",
                columns: new[] { "empresa_id", "numero" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_caixas_empresa_id_usuario_id",
                table: "caixas",
                columns: new[] { "empresa_id", "usuario_id" },
                unique: true,
                filter: "fechado_em IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_caixas_usuario_id",
                table: "caixas",
                column: "usuario_id");

            migrationBuilder.CreateIndex(
                name: "IX_movimentos_caixa_caixa_id",
                table: "movimentos_caixa",
                column: "caixa_id");

            migrationBuilder.CreateIndex(
                name: "IX_ordem_servico_itens_ordem_servico_id_ordem",
                table: "ordem_servico_itens",
                columns: new[] { "ordem_servico_id", "ordem" });

            migrationBuilder.CreateIndex(
                name: "IX_ordem_servico_itens_produto_id",
                table: "ordem_servico_itens",
                column: "produto_id");

            migrationBuilder.CreateIndex(
                name: "IX_ordens_servico_cliente_id",
                table: "ordens_servico",
                column: "cliente_id");

            migrationBuilder.CreateIndex(
                name: "IX_ordens_servico_cupom_id",
                table: "ordens_servico",
                column: "cupom_id");

            migrationBuilder.CreateIndex(
                name: "IX_ordens_servico_empresa_id_numero",
                table: "ordens_servico",
                columns: new[] { "empresa_id", "numero" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ordens_servico_empresa_id_status",
                table: "ordens_servico",
                columns: new[] { "empresa_id", "status" });

            migrationBuilder.CreateIndex(
                name: "IX_ordens_servico_tecnico_id",
                table: "ordens_servico",
                column: "tecnico_id");

            migrationBuilder.AddForeignKey(
                name: "FK_cupons_caixas_caixa_id",
                table: "cupons",
                column: "caixa_id",
                principalTable: "caixas",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_cupons_ordens_servico_ordem_servico_id",
                table: "cupons",
                column: "ordem_servico_id",
                principalTable: "ordens_servico",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }
    }
}
