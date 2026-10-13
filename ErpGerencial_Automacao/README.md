# Robô de mensagens automáticas (WhatsApp)

Envia pelo WhatsApp, no horário marcado no cadastro de cada cliente ("Intervalo de manutenção"):
- **Mensalmente:** a cada N meses, **às 6h**, no mesmo dia do mês em que o intervalo foi salvo (salvo em
  08/10 com 2 meses → 08/12 às 06:00). Depois de enviar, o robô já marca o próximo (08/02 às 06:00...).
- **Data específica:** na data e hora escolhidas, uma vez só (depois do envio, fica sem horário).

A mensagem é a **personalizada** do cliente (na página dele) ou, se ele não tiver, a **mensagem padrão**
(na lista de clientes). Verifica o banco a cada minuto. Cada envio aparece no histórico da página
"Mensagem automática" ("Enviada", "Teste" ou "Não enviada", com o motivo).

**Proteção contra bloqueio do número:** cada celular manda **uma mensagem por vez, com um intervalo
sorteado de 2 a 5 minutos** entre elas (se muitas vencerem juntas, às 6h, elas saem espalhadas pela manhã)
e **no máximo 40 por dia**; o que passar fica para o dia seguinte, sem se perder. Ajuste no `.env`:
`LIMITE_DIARIO`, `ESPACO_MIN_SEGUNDOS` e `ESPACO_MAX_SEGUNDOS`.

O envio é feito pela **[Evolution API](https://github.com/EvolutionAPI/evolution-api)** (open-source), com o
celular da empresa conectado como "aparelho conectado". Ela conversa direto com o WhatsApp, sem abrir
navegador: cada mensagem sai em menos de um segundo. Roda neste computador, em `http://localhost:8080`,
e guarda o login de cada celular no banco `evolution` (mesmo PostgreSQL do Órion).

## Primeira vez

Precisa do **Node.js** (o mesmo do site) e do **Git**.

1. Robô (na pasta `ErpGerencial_Automacao`):

   ```
   python -m venv .venv
   .venv\Scripts\python.exe -m pip install -r requirements.txt
   copy .env.exemplo .env
   ```

   Abra o `.env` e coloque a senha do banco.

2. Evolution API (também na pasta `ErpGerencial_Automacao`):

   ```
   git clone --depth 1 --branch 2.3.7 https://github.com/EvolutionAPI/evolution-api.git
   copy evolution.env.exemplo evolution-api\.env
   ```

   No `evolution-api\.env`, troque `SUA_SENHA` (do banco) e invente a `AUTHENTICATION_API_KEY`; copie essa
   mesma chave para `EVOLUTION_CHAVE` no `.env` do robô. Crie o banco (`CREATE DATABASE evolution;`) e instale:

   ```
   cd evolution-api
   npm ci
   npm install-scripts approve @prisma/client @prisma/engines prisma esbuild sharp protobufjs baileys
   npm rebuild
   npm run db:generate
   npm run db:deploy:win
   npx tsup
   ```

3. Suba a Evolution (`npm run whatsapp` na pasta `ErpGerencial_Front`) e conecte o celular que envia:

   ```
   .venv\Scripts\python.exe lembretes.py conectar 16991039268
   ```

   No celular: **WhatsApp → Aparelhos conectados → Conectar um aparelho**. Toque em **"Conectar com número
   de telefone"** e digite o código que aparece no terminal, ou escaneie o QR Code que abre na tela.

4. Teste mandando uma mensagem para você mesmo:

   ```
   .venv\Scripts\python.exe lembretes.py testar 16991039268 16991039268 "Teste do robô"
   ```

5. No site: em **Clientes → Inserir mensagem automática**, informe o celular que envia; na lista de
   clientes, escreva a **Mensagem padrão**; no cadastro de cada cliente, escolha o **Intervalo de manutenção** (mensalmente ou data específica).

## Uso no dia a dia

A Evolution e o robô já sobem junto com o site no `npm run dev:tudo` (pasta `ErpGerencial_Front`). Para rodar sozinho:

```
.venv\Scripts\python.exe lembretes.py                  roda sem parar
.venv\Scripts\python.exe lembretes.py --uma-vez        verifica uma vez
```

O computador precisa estar ligado, com internet, e a Evolution rodando. Se ela estiver fora do ar, o robô
não perde nada: só avisa e tenta de novo na verificação seguinte.
Para só registrar no histórico sem enviar nada (testes), use `WHATSAPP_MODO=teste` no `.env`.

O painel da Evolution (ver os celulares conectados, desconectar) fica em `http://localhost:8080/manager`
(entra com a `AUTHENTICATION_API_KEY`).

## Atenção

A Evolution API não é um recurso oficial do WhatsApp. Com poucas mensagens por dia para clientes que já
conhecem a empresa, o risco é baixo, mas envio em massa pode fazer o número ser bloqueado. Para vender o
sistema para muitos clientes, o caminho seguro é a API oficial (WhatsApp Business Platform, da Meta), que
é paga por conversa e exige mensagens pré-aprovadas.
