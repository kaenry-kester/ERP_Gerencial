# Órion — ERP Gerencial

Sistema de gestão (ERP) feito para uma loja MEI que vende e instala purificadores de água. O ERP reúne vendas, estoque, clientes, finanças e o atendimento pelo WhatsApp num só lugar. Ele funciona como um programa instalado no computador da loja, sem servidor e sem mensalidade.

## Funcionalidades

- **Produtos e estoque**: cadastro com fotos, código de barras e categorias. Aviso de estoque baixo e histórico de
  todas as entradas e saídas.
- **Clientes**: ficha completa, com os dados do aparelho do cliente (item, marca e modelo). O CEP preenche o endereço.
- **Frente de caixa (PDV)**: venda com leitor de código de barras. Gera cupom de 80 mm e recibo A4, imprime e baixa
  em PDF. Também envia o cupom em PDF para o WhatsApp do cliente.
- **Orçamentos**: planilha de serviços que vira cupom em um clique.
- **Financeiro**: painel com gráficos e filtros por período, forma de pagamento e vendedor.
- **WhatsApp automático**: lembretes de manutenção mandados sozinhos para cada cliente, no intervalo escolhido.
- **Equipe e permissões**: vários usuários por empresa (administrador e funcionário), com acesso liberado por módulo.
- **Busca inteligente**: encontra os registros sem ligar para letras maiúsculas e acentos.
- **Segurança dos dados**: cópia de segurança automática do banco, com cópia na nuvem (Google Drive ou OneDrive).
- **Instalação simples**: tudo vem num único `.zip` com atalho na Área de Trabalho. Funciona offline, na rede da loja.

## Tecnologias

| Camada | Tecnologias |
|---|---|
| **Front-end** | React, TypeScript, Vite, React Router, CSS (sem framework), html-to-image (PDF), Vitest, Oxlint |
| **Back-end** | C# / ASP.NET Core 10 (Minimal APIs), Entity Framework Core, autenticação JWT, BackgroundService (tarefas agendadas), MailKit, xUnit (testes de integração) |
| **Banco de dados** | PostgreSQL, migrações do EF Core, extensão `unaccent`, backup automático com `pg_dump` |
| **Integrações** | Evolution API (WhatsApp), Node.js, Python (conexão do celular), ViaCEP |

| Pastas | Organização |
|---|---|
| `ErpGerencial_Front` | Site (React + Vite + TypeScript) |
| `ErpGerencial_Back/Orion.Api` | API (ASP.NET Core 10 + Entity Framework + PostgreSQL) |
| `ErpGerencial_Back/Orion.Api.Tests` | Testes automáticos da API |
| `ErpGerencial_Automacao` | Evolution API (WhatsApp) e ferramentas para conectar o celular |
| `Instalador` | Montagem do pacote `Orion.zip` para a loja |
