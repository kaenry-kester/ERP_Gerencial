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
   clientes, escreva a **Mensagem padrão**; no cadastro de cada cliente, escolha o **Intervalo de manutenção** (mensalmente ou data específica).

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
