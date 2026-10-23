# Órion — ERP Gerencial

ERP para pequenas empresas: produtos e estoque, clientes, caixa (PDV) com cupons, financeiro, histórico dos clientes
e mensagens automáticas de WhatsApp.

| Pasta | O que é |
|---|---|
| `ErpGerencial_Front` | Site (React + Vite + TypeScript) |
| `ErpGerencial_Back/Orion.Api` | API (ASP.NET Core 10 + Entity Framework + PostgreSQL) |
| `ErpGerencial_Back/Orion.Api.Tests` | Testes automáticos da API |
| `ErpGerencial_Automacao` | Evolution API (WhatsApp) e ferramentas para conectar o celular — ver o README de lá |

## Módulos

- **Produtos**: cadastro com fotos, código de barras, categorias, estoque mínimo (aviso de estoque baixo), ajuste de
  estoque e o histórico de todas as movimentações.
- **Clientes**: ficha completa e mensagem automática de WhatsApp no intervalo escolhido.
- **Cupons e recibos**: frente de caixa (PDV) com leitor de código de barras. Cupom não fiscal (80 mm) e recibo A4;
  atalho para emitir a nota no gov.br (Emissor Nacional).
- **Número de ordem de serviço**: o histórico completo de cada cliente (vendas, mensagens e cancelamentos).
- **Financeiro**: painel com filtros (período, mês, ano, pagamento, vendedor), gráficos e o registro de todas as vendas.

## Rodar no computador (desenvolvimento)

Precisa de: .NET 10, Node.js, PostgreSQL.

1. Conexão e chave nos user-secrets da API (pasta `ErpGerencial_Back/Orion.Api`):

   ```
   dotnet user-secrets set "ConnectionStrings:Orion" "Host=localhost;Database=orion;Username=postgres;Password=SUA_SENHA"
   dotnet user-secrets set "Jwt:Chave" "uma-chave-longa-e-aleatoria-com-pelo-menos-32-letras"
   ```

   O banco é criado e atualizado sozinho quando a API sobe (migrações).

2. Tudo de uma vez, na pasta `ErpGerencial_Front`: `npm install` e depois `npm run dev:tudo` (API, site e WhatsApp).
   O site abre em http://localhost:5173.

## Testes automáticos

- **API** (pasta `ErpGerencial_Back`): `dotnet test Orion.Api.Tests -c Release`
  Sobem a API de verdade contra um banco **só de testes** (`orion_testes`, apagado e recriado a cada execução, no mesmo
  PostgreSQL). Os testes param na hora se estiverem ligados a qualquer outro banco. Use `-c Release` enquanto a API
  estiver rodando em `dotnet watch` (que trava os arquivos da compilação Debug).
- **Site** (pasta `ErpGerencial_Front`): `npm test` (valores por extenso, dinheiro, documentos, código de barras, senha).

## Backup do banco

A API faz **backup automático todo dia** (às 2h, ou logo ao iniciar se o do dia ainda não foi feito) com o `pg_dump`
do PostgreSQL instalado, e apaga os backups com mais de 30 dias. Padrão: pasta `Documentos\Orion-Backups`.

Para a cópia ir para a nuvem, aponte a pasta para uma pasta do Google Drive ou OneDrive (user-secrets ou appsettings):

```
dotnet user-secrets set "Backup:Pasta" "C:\Users\SEU_USUARIO\OneDrive\Orion-Backups"
```

Outras opções: `Backup:Horario` ("02:00"), `Backup:ManterDias` (30), `Backup:PgDump` (caminho do `pg_dump.exe`, se não
for achado sozinho em `[disco]:\Program Files\PostgreSQL\[versão]\bin`), `Backup:Ativo` (false desliga).

**Restaurar** (apaga o que está no banco e põe o backup no lugar — pare a API antes):

```
pg_restore --clean --if-exists --no-owner -h localhost -U postgres -d orion "orion-2026-10-22-0200.dump"
```

## Programa para a loja (pasta / Orion.zip)

Para instalar no computador da loja, sem servidor e sem mensalidade. Gera uma pasta com tudo dentro (o Órion
publicado para Windows, PostgreSQL portátil, Node + Evolution para o WhatsApp) e o `Orion.zip`:

```
cd Instalador
powershell -ExecutionPolicy Bypass -File montar-pacote.ps1
```

Saída em `pacote/` (fora do git). O cliente descompacta e usa os atalhos da pasta:
**Iniciar Orion**, **Parar Orion**, **Restaurar copia de seguranca** e **Esqueci a senha** (ver `LEIA-ME.txt`).

- Na primeira vez cria o banco (porta 5433, só deste computador), gera as chaves e prepara o WhatsApp (porta 8090).
- O Órion abre em `http://localhost:5000` (e pela rede da loja). Sem HTTPS e sem e-mail de recuperação:
  o administrador troca a senha da equipe em Equipe; a do próprio administrador, pelo atalho "Esqueci a senha".
- **Cópias de segurança**: a cada hora e ao fechar, na pasta `Orion-Copias` do Google Drive (ou OneDrive) —
  todas das últimas 24 h e uma por dia por 30 dias. Aviso na tela inicial se a última tiver mais de 1 dia.
- O pacote sai **vazio** e **sem sessões de WhatsApp** (a pasta `instances` e o `.env` da Evolution não vão junto).
- Testes do pacote: `ORION_SEM_NAVEGADOR=1` (não abre o navegador) e `ORION_PASTA_BACKUP` (pasta das cópias).

## Colocar num servidor

1. Compile o site para dentro da API (pasta `ErpGerencial_Front`): `npm run build:api` → `Orion.Api/wwwroot`.
   A API passa a servir o site no mesmo endereço (as rotas do site abrem o `index.html`).
2. Publique a API: `dotnet publish ErpGerencial_Back/Orion.Api -c Release -o publicar`.
3. No servidor, configure (variáveis de ambiente ou `appsettings.Production.json`):
   - `ConnectionStrings__Orion` e `Jwt__Chave`;
   - `Cors__Origens__0` = endereço do site, se ele ficar em outro domínio;
   - `Email__Host`, `Email__Porta`, `Email__Usuario`, `Email__Senha`, `Email__Remetente` (códigos do "Esqueci minha senha"
     e da troca de e-mail — **sem SMTP, em produção, o código não sai**);
   - `Evolution__Url` e `Evolution__Chave` (WhatsApp).
4. Em produção a API redireciona para HTTPS. Atrás de um proxy (Nginx, IIS, Caddy) ela entende o `X-Forwarded-*`.
5. Confira em `https://SEU_ENDERECO/api/saude` → `{"status":"ok","banco":"conectado"}`.

## Nota fiscal e cupom fiscal (gov.br)

A empresa é MEI e emite as notas no site do governo, o **Emissor Nacional** (https://www.nfse.gov.br/EmissorNacional),
entrando com a conta gov.br. O Órion não emite nota sozinho: ele só ajuda.

1. Na página da venda, botão **Emitir cupom fiscal** (venda para o consumidor) ou **Emitir nota fiscal** (venda para
   empresa).
2. O site do governo abre numa aba nova e os dados da venda (CPF/CNPJ, nome, endereço, descrição e valor) já ficam
   copiados; cada um também tem um botão **Copiar**.
3. Depois de emitir lá, anote o número da nota na venda (**Salvar número**). Ele fica guardado e pode ser apagado.

O site do governo não permite login nem preenchimento automático por outro programa (e a senha gov.br não deve ser
guardada aqui). A emissão automática de verdade exigiria o certificado digital A1 do CNPJ.
