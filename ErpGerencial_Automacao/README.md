# WhatsApp do Órion (mensagens automáticas)

As mensagens automáticas são enviadas **pela própria API do Órion, em segundo plano** (`Orion.Api/WhatsApp/EnvioAutomatico.cs`):
não há robô para abrir. A cada minuto ela procura os clientes cujo horário de envio chegou e envia pelo WhatsApp.

- **Quando:** na data e hora escolhidas no calendário do cadastro do cliente. O intervalo é a diferença entre o momento
  em que o cadastro foi salvo e esse envio, em minutos, horas, dias, semanas ou meses (agora 16h30, envio 17h → a cada
  30 minutos; 14/10 → 14/12 → a cada 2 meses). Depois de cada envio, a API já marca o próximo. "Cancelar envios
  automáticos" no cadastro para tudo.
- **O quê:** a mensagem **personalizada** do cliente (na página dele) ou, se ele não tiver, a **mensagem padrão**
  (Clientes → Mensagem automática). As duas aceitam emojis e uma imagem (vai como foto, com o texto de legenda).
- **Histórico:** cada envio aparece em "Histórico de envios" (página do cliente) e "Últimos envios"
  ("Enviada", "Teste" ou "Não enviada", com o motivo).

**Nunca para:** não há limite de mensagens por dia; todas as que vencem saem a cada verificação, com uma pausa curta
sorteada (3 a 8 segundos) entre uma e outra. O intervalo de cada cliente segue sempre contando — mesmo se um envio der
erro, o próximo já fica marcado — e só o botão **Cancelar envios automáticos** para os envios de um cliente. Se o
WhatsApp (Evolution) estiver fora do ar, nada se perde: as mensagens saem assim que ele voltar. Ajuste a pausa em
`Orion.Api/appsettings.json`, seção `EnvioAutomatico` (`PausaMinSegundos`, `PausaMaxSegundos`); para só registrar no
histórico sem enviar nada (testes), use `"Modo": "teste"`.

O envio passa pela **[Evolution API](https://github.com/EvolutionAPI/evolution-api)** (open-source), com o celular da
empresa conectado como "aparelho conectado". Ela roda neste computador, em `http://localhost:8080`, e guarda o login
de cada celular no banco `evolution` (mesmo PostgreSQL do Órion). A API do Órion lê o endereço e a chave dos
user-secrets (`Evolution:Url` e `Evolution:Chave`).

## Primeira vez

Precisa do **Node.js** (o mesmo do site), do **Git** e do **Python** (só para conectar o celular).

1. Ferramentas (na pasta `ErpGerencial_Automacao`):

   ```
   python -m venv .venv
   .venv\Scripts\python.exe -m pip install -r requirements.txt
   copy .env.exemplo .env
   ```

2. Evolution API (também na pasta `ErpGerencial_Automacao`):

   ```
   git clone --depth 1 --branch 2.3.7 https://github.com/EvolutionAPI/evolution-api.git
   copy evolution.env.exemplo evolution-api\.env
   git -C evolution-api apply ..\evolution-somente-envio.patch
   ```

   O patch deixa a Evolution **somente para envio**: ela não baixa histórico, ignora grupos, status e canais, não
   fica "online" no celular e descarta as mensagens, confirmações, chamadas, conversas e contatos que chegam — nada
   disso é processado nem aparece no terminal.

   No `evolution-api\.env`, troque `SUA_SENHA` (do banco) e invente a `AUTHENTICATION_API_KEY`; copie essa mesma chave
   para `EVOLUTION_CHAVE` no `.env` desta pasta e para a API (`dotnet user-secrets set Evolution:Chave <chave>` na pasta
   `ErpGerencial_Back/Orion.Api`). Crie o banco (`CREATE DATABASE evolution;`) e instale:

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

   No celular: **WhatsApp → Aparelhos conectados → Conectar um aparelho**. Toque em **"Conectar com número de
   telefone"** e digite o código que aparece, ou escaneie o QR Code que abre na tela.

4. Teste mandando uma mensagem para você mesmo:

   ```
   .venv\Scripts\python.exe lembretes.py testar 16991039268 16991039268 "Teste do Órion"
   ```

5. No site: em **Clientes → Mensagem automática**, informe o celular que envia e escreva a mensagem padrão; no
   cadastro de cada cliente, escolha no **Calendário** o dia e o horário do próximo envio.

## Uso no dia a dia

`npm run dev:tudo` (pasta `ErpGerencial_Front`) sobe a API (que já faz o envio automático), o site e a Evolution; se
algum deles cair, ele é reiniciado sozinho em 5 segundos.
O computador precisa estar ligado, com internet. Se a Evolution estiver fora do ar, nada se perde: a API só avisa no
log e tenta de novo na verificação seguinte.

O painel da Evolution (ver os celulares conectados, desconectar) fica em `http://localhost:8080/manager`
(entra com a `AUTHENTICATION_API_KEY`).

## Atenção

A Evolution API não é um recurso oficial do WhatsApp. Com poucas mensagens por dia para clientes que já conhecem a
empresa, o risco é baixo, mas envio em massa pode fazer o número ser bloqueado. Para vender o sistema para muitos
clientes, o caminho seguro é a API oficial (WhatsApp Business Platform, da Meta), que é paga por conversa e exige
mensagens pré-aprovadas.
