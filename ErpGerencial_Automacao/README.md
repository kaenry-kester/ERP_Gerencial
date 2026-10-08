# Robô de mensagens automáticas (WhatsApp)

No dia da manutenção de cada cliente (dia do cadastro + intervalo em meses), envia pelo WhatsApp
a **mensagem padrão** (na lista de clientes, campo "Mensagem padrão (para todos)") ou, se o cliente tiver,
a **mensagem personalizada** dele (na ficha do cliente, botão "Enviar mensagem personalizada").
Verifica o banco a cada minuto; as manutenções saem só entre 9h e 20h (horário de Brasília), e nunca
duas vezes para o mesmo cliente na mesma data.
Cada envio aparece no histórico da página ("Enviada", "Teste" ou "Não enviada", com o motivo).

**Temporário, para testes:** no cadastro do cliente, o campo "Data e horário do envio (teste)" faz o
robô enviar nesse momento (a qualquer hora, sem esperar a manutenção). Depois do envio, o campo é apagado.

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

4. No site, em **Clientes**: digite a **Mensagem padrão**; em **Clientes → Mensagem automática**,
   informe o celular que envia e marque **Enviar automaticamente**.

## Uso no dia a dia

O robô já sobe junto com o site no `npm run dev:tudo` (pasta `ErpGerencial_Front`). Para rodar sozinho:

```
.venv\Scripts\python.exe lembretes.py                  roda sem parar
.venv\Scripts\python.exe lembretes.py --uma-vez        verifica uma vez
.venv\Scripts\python.exe lembretes.py --uma-vez --agora   ignora o horário comercial
```

O computador precisa estar ligado, com internet, e o Chrome abre sozinho na hora de enviar.
Para só registrar no histórico sem enviar nada (testes), use `WHATSAPP_MODO=teste` no `.env`.

## Atenção

Automatizar o WhatsApp Web não é um recurso oficial do WhatsApp. Com poucas mensagens por dia para
clientes que já conhecem a empresa, o risco é baixo, mas envio em massa pode fazer o número ser
bloqueado. Para vender o sistema para muitos clientes, o caminho seguro é a API oficial
(WhatsApp Business Platform, da Meta), que é paga por conversa e exige mensagens pré-aprovadas.
