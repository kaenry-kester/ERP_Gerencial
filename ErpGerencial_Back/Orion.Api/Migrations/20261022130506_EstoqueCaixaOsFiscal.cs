using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Orion.Api.Migrations
{
    /// <inheritdoc />
    public partial class EstoqueCaixaOsFiscal : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "categoria_id",
                table: "produtos",
                type: "uuid",
                nullable: true);

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

            migrationBuilder.AddColumn<decimal>(
                name: "estoque_minimo",
                table: "produtos",
                type: "numeric(14,3)",
                precision: 14,
                scale: 3,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<Guid>(
                name: "fornecedor_id",
                table: "produtos",
                type: "uuid",
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
                name: "unidade",
                table: "produtos",
                type: "character varying(6)",
                maxLength: 6,
                nullable: false,
                defaultValue: "UN");

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
                defaultValue: 1);

            migrationBuilder.AddColumn<Guid>(
                name: "caixa_id",
                table: "cupons",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "nfce_chave",
                table: "cupons",
                type: "character varying(44)",
                maxLength: 44,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "nfce_emitida_em",
                table: "cupons",
                type: "timestamp with time zone",
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
                name: "nfce_serie",
                table: "cupons",
                type: "character varying(5)",
                maxLength: 5,
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

            migrationBuilder.AddColumn<Guid>(
                name: "ordem_servico_id",
                table: "cupons",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "finalidade",
                table: "codigos_login",
                type: "character varying(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "caixas",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    empresa_id = table.Column<Guid>(type: "uuid", nullable: false),
                    numero = table.Column<int>(type: "integer", nullable: false),
                    usuario_id = table.Column<Guid>(type: "uuid", nullable: true),
                    operador_nome = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    aberto_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    valor_abertura = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    fechado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    fechado_por = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    valor_contado = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: true),
                    valor_esperado = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: true),
                    observacao = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true)
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
                name: "categorias",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    empresa_id = table.Column<Guid>(type: "uuid", nullable: false),
                    nome = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    criado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_categorias", x => x.id);
                    table.ForeignKey(
                        name: "FK_categorias_empresas_empresa_id",
                        column: x => x.empresa_id,
                        principalTable: "empresas",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "fornecedores",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    empresa_id = table.Column<Guid>(type: "uuid", nullable: false),
                    numero = table.Column<int>(type: "integer", nullable: false),
                    nome = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    documento = table.Column<string>(type: "character varying(14)", maxLength: 14, nullable: true),
                    telefone = table.Column<string>(type: "character varying(11)", maxLength: 11, nullable: true),
                    email = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: true),
                    contato = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    observacao = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    criado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    atualizado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_fornecedores", x => x.id);
                    table.ForeignKey(
                        name: "FK_fornecedores_empresas_empresa_id",
                        column: x => x.empresa_id,
                        principalTable: "empresas",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ordens_servico",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    empresa_id = table.Column<Guid>(type: "uuid", nullable: false),
                    numero = table.Column<int>(type: "integer", nullable: false),
                    cliente_id = table.Column<Guid>(type: "uuid", nullable: true),
                    cliente_nome = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    cliente_celular = table.Column<string>(type: "character varying(11)", maxLength: 11, nullable: true),
                    equipamento = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    marca = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    modelo = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    numero_serie = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    acessorios = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    defeito = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    diagnostico = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    servico = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    observacao = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "aberta"),
                    tecnico_id = table.Column<Guid>(type: "uuid", nullable: true),
                    tecnico_nome = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    previsao_em = table.Column<DateOnly>(type: "date", nullable: true),
                    garantia = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    cupom_id = table.Column<Guid>(type: "uuid", nullable: true),
                    criado_por = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    aberta_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    concluida_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    entregue_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    atualizada_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
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
                    tipo = table.Column<string>(type: "character varying(12)", maxLength: 12, nullable: false),
                    valor = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    motivo = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    usuario_nome = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    criado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
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
                name: "movimentos_estoque",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    empresa_id = table.Column<Guid>(type: "uuid", nullable: false),
                    produto_id = table.Column<Guid>(type: "uuid", nullable: false),
                    tipo = table.Column<string>(type: "character varying(15)", maxLength: 15, nullable: false),
                    quantidade = table.Column<decimal>(type: "numeric(14,3)", precision: 14, scale: 3, nullable: false),
                    saldo_apos = table.Column<decimal>(type: "numeric(14,3)", precision: 14, scale: 3, nullable: false),
                    custo_unitario = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: true),
                    fornecedor_id = table.Column<Guid>(type: "uuid", nullable: true),
                    documento = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    observacao = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    cupom_id = table.Column<Guid>(type: "uuid", nullable: true),
                    usuario_id = table.Column<Guid>(type: "uuid", nullable: true),
                    usuario_nome = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    criado_em = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_movimentos_estoque", x => x.id);
                    table.ForeignKey(
                        name: "FK_movimentos_estoque_cupons_cupom_id",
                        column: x => x.cupom_id,
                        principalTable: "cupons",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_movimentos_estoque_empresas_empresa_id",
                        column: x => x.empresa_id,
                        principalTable: "empresas",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_movimentos_estoque_fornecedores_fornecedor_id",
                        column: x => x.fornecedor_id,
                        principalTable: "fornecedores",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_movimentos_estoque_produtos_produto_id",
                        column: x => x.produto_id,
                        principalTable: "produtos",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_movimentos_estoque_usuarios_usuario_id",
                        column: x => x.usuario_id,
                        principalTable: "usuarios",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "ordem_servico_itens",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    ordem_servico_id = table.Column<Guid>(type: "uuid", nullable: false),
                    ordem = table.Column<int>(type: "integer", nullable: false),
                    produto_id = table.Column<Guid>(type: "uuid", nullable: true),
                    descricao = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    quantidade = table.Column<decimal>(type: "numeric(14,3)", precision: 14, scale: 3, nullable: false),
                    valor_unitario = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    total = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false)
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
                name: "IX_produtos_categoria_id",
                table: "produtos",
                column: "categoria_id");

            migrationBuilder.CreateIndex(
                name: "IX_produtos_fornecedor_id",
                table: "produtos",
                column: "fornecedor_id");

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
                name: "IX_categorias_empresa_id_nome",
                table: "categorias",
                columns: new[] { "empresa_id", "nome" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_fornecedores_empresa_id_documento",
                table: "fornecedores",
                columns: new[] { "empresa_id", "documento" },
                unique: true,
                filter: "documento IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_fornecedores_empresa_id_numero",
                table: "fornecedores",
                columns: new[] { "empresa_id", "numero" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_movimentos_caixa_caixa_id",
                table: "movimentos_caixa",
                column: "caixa_id");

            migrationBuilder.CreateIndex(
                name: "IX_movimentos_estoque_cupom_id",
                table: "movimentos_estoque",
                column: "cupom_id");

            migrationBuilder.CreateIndex(
                name: "IX_movimentos_estoque_empresa_id_criado_em",
                table: "movimentos_estoque",
                columns: new[] { "empresa_id", "criado_em" });

            migrationBuilder.CreateIndex(
                name: "IX_movimentos_estoque_fornecedor_id",
                table: "movimentos_estoque",
                column: "fornecedor_id");

            migrationBuilder.CreateIndex(
                name: "IX_movimentos_estoque_produto_id_criado_em",
                table: "movimentos_estoque",
                columns: new[] { "produto_id", "criado_em" });

            migrationBuilder.CreateIndex(
                name: "IX_movimentos_estoque_usuario_id",
                table: "movimentos_estoque",
                column: "usuario_id");

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

            migrationBuilder.AddForeignKey(
                name: "FK_produtos_categorias_categoria_id",
                table: "produtos",
                column: "categoria_id",
                principalTable: "categorias",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_produtos_fornecedores_fornecedor_id",
                table: "produtos",
                column: "fornecedor_id",
                principalTable: "fornecedores",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);

            // O saldo que os produtos já tinham vira o "estoque inicial" do histórico de movimentações
            migrationBuilder.Sql("""
                INSERT INTO movimentos_estoque (id, empresa_id, produto_id, tipo, quantidade, saldo_apos, usuario_nome, observacao, criado_em)
                SELECT gen_random_uuid(), empresa_id, id, 'inicial', quantidade, quantidade, 'Sistema',
                       'Saldo que o produto já tinha quando o histórico começou', now()
                FROM produtos
                WHERE quantidade <> 0;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_cupons_caixas_caixa_id",
                table: "cupons");

            migrationBuilder.DropForeignKey(
                name: "FK_cupons_ordens_servico_ordem_servico_id",
                table: "cupons");

            migrationBuilder.DropForeignKey(
                name: "FK_produtos_categorias_categoria_id",
                table: "produtos");

            migrationBuilder.DropForeignKey(
                name: "FK_produtos_fornecedores_fornecedor_id",
                table: "produtos");

            migrationBuilder.DropTable(
                name: "categorias");

            migrationBuilder.DropTable(
                name: "movimentos_caixa");

            migrationBuilder.DropTable(
                name: "movimentos_estoque");

            migrationBuilder.DropTable(
                name: "ordem_servico_itens");

            migrationBuilder.DropTable(
                name: "caixas");

            migrationBuilder.DropTable(
                name: "fornecedores");

            migrationBuilder.DropTable(
                name: "ordens_servico");

            migrationBuilder.DropIndex(
                name: "IX_produtos_categoria_id",
                table: "produtos");

            migrationBuilder.DropIndex(
                name: "IX_produtos_fornecedor_id",
                table: "produtos");

            migrationBuilder.DropIndex(
                name: "IX_cupons_caixa_id",
                table: "cupons");

            migrationBuilder.DropIndex(
                name: "IX_cupons_ordem_servico_id",
                table: "cupons");

            migrationBuilder.DropColumn(
                name: "categoria_id",
                table: "produtos");

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
                name: "estoque_minimo",
                table: "produtos");

            migrationBuilder.DropColumn(
                name: "fornecedor_id",
                table: "produtos");

            migrationBuilder.DropColumn(
                name: "ncm",
                table: "produtos");

            migrationBuilder.DropColumn(
                name: "origem",
                table: "produtos");

            migrationBuilder.DropColumn(
                name: "unidade",
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
                name: "caixa_id",
                table: "cupons");

            migrationBuilder.DropColumn(
                name: "nfce_chave",
                table: "cupons");

            migrationBuilder.DropColumn(
                name: "nfce_emitida_em",
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
                name: "nfce_serie",
                table: "cupons");

            migrationBuilder.DropColumn(
                name: "nfce_status",
                table: "cupons");

            migrationBuilder.DropColumn(
                name: "nfce_url_danfe",
                table: "cupons");

            migrationBuilder.DropColumn(
                name: "ordem_servico_id",
                table: "cupons");

            migrationBuilder.DropColumn(
                name: "finalidade",
                table: "codigos_login");
        }
    }
}
