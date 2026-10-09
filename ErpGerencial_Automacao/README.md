# Robô de mensagens automáticas (WhatsApp)

Na **data e horário do envio** marcados no cadastro de cada cliente, envia pelo WhatsApp a **mensagem
personalizada** do cliente (na página dele) ou, se ele não tiver, a **mensagem padrão** (na lista de
clientes, campo "Mensagem padrão (para todos)"). Verifica o banco a cada minuto e envia a qualquer hora;
depois do envio, o horário marcado no cliente é apagado. Cada envio aparece no histórico da página
"Mensagem automática" ("Enviada", "Teste" ou "Não enviada", com o motivo).

O envio é feito pelo **WhatsApp Web**, no Google Chrome, com o celular da empresa.

## Primeira vez

1. Na pasta `ErpGerencial_Automacao`:

   ```
   python -m venv .venv
   .venv\Scripts\python.exe -m pip install -r requirements.txt
   copy .env.exemplo .env
   ```

   Abra o `.env` e coloque a senha do banco.

2. Conecte o WhatsApp do celular que envia (abre o Chrome com o QR Code):

   ```
   .venv\Scripts\python.exe lembretes.py conectar 16991039268
   ```

   No celular: **WhatsApp → Aparelhos conectados → Conectar um aparelho** e escaneie o QR Code.
   O login fica salvo em `sessoes/16991039268` (não compartilhe essa pasta: ela dá acesso às conversas).

3. Teste mandando uma mensagem para você mesmo:

   ```
   .venv\Scripts\python.exe lembretes.py testar 16991039268 16991039268 "Teste do robô"
   ```

4. No site: em **Clientes → Inserir mensagem automática**, informe o celular que envia; na lista de
   clientes, escreva a **Mensagem padrão**; no cadastro de cada cliente, marque a **Data e horário do envio**.

## Uso no dia a dia

O robô já sobe junto com o site no `npm run dev:tudo` (pasta `ErpGerencial_Front`). Para rodar sozinho:

```
.venv\Scripts\python.exe lembretes.py                  roda sem parar
.venv\Scripts\python.exe lembretes.py --uma-vez        verifica uma vez
```

O computador precisa estar ligado, com internet, e o Chrome abre sozinho na hora de enviar.
Para só registrar no histórico sem enviar nada (testes), use `WHATSAPP_MODO=teste` no `.env`.

## Atenção

Automatizar o WhatsApp Web não é um recurso oficial do WhatsApp. Com poucas mensagens por dia para
clientes que já conhecem a empresa, o risco é baixo, mas envio em massa pode fazer o número ser
bloqueado. Para vender o sistema para muitos clientes, o caminho seguro é a API oficial
(WhatsApp Business Platform, da Meta), que é paga por conversa e exige mensagens pré-aprovadas.
