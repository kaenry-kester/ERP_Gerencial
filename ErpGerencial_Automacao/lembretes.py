"""
Robô de mensagens automáticas de manutenção do Órion (WhatsApp).

A cada minuto olha o banco e envia pelo WhatsApp Web:
  - no dia da manutenção (dia do cadastro + intervalo em meses), em horário comercial (9h às 20h de
    Brasília), para os clientes das empresas que ligaram a mensagem automática;
  - TEMPORÁRIO, para testes: na data e hora escolhidas no cadastro do cliente ("Data e horário do
    envio (teste)"), a qualquer hora; depois do envio o agendamento é apagado.
A mensagem é a do cadastro do cliente ou, se estiver vazia, a da página "Mensagem automática".
Cada envio fica em envios_whatsapp (histórico da página "Mensagem automática" do site).

Comandos (dentro da pasta ErpGerencial_Automacao, com o ambiente .venv):
    python lembretes.py                         roda sem parar (verifica a cada minuto)
    python lembretes.py --uma-vez [--agora]     verifica uma vez (--agora ignora o horário comercial)
    python lembretes.py conectar 16991039268    conecta o WhatsApp desse celular (QR Code)
    python lembretes.py testar 16991039268 16999998888 "Olá!"   envia uma mensagem de teste

Configuração no arquivo .env (veja .env.exemplo):
    ORION_BANCO                conexão com o PostgreSQL
    WHATSAPP_MODO              "web" (envia de verdade) ou "teste" (só registra, nada sai)
    VERIFICAR_A_CADA_SEGUNDOS  intervalo entre as verificações (padrão: 60)
"""

import argparse
import logging
import os
import random
import re
import sys
import time
from datetime import date
from itertools import groupby
from pathlib import Path

import psycopg
from psycopg.rows import dict_row

from whatsapp import ErroEnvio, WhatsAppWeb

PASTA = Path(__file__).resolve().parent
HORA_INICIO, HORA_FIM = 9, 20
log = logging.getLogger("lembretes")

SQL_AGORA = """
SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date AS hoje,
       extract(hour FROM now() AT TIME ZONE 'America/Sao_Paulo')::int AS hora
"""

# Mesma conta do site: dia do cadastro (em Brasília) + o intervalo em meses.
# Quem já recebeu hoje não entra; quem deu erro entra de novo (nova tentativa).
SQL_MANUTENCAO = """
SELECT c.id AS cliente_id, c.nome, c.celular,
       e.id AS empresa_id, e.nome AS empresa, e.whatsapp_remetente AS remetente,
       coalesce(c.mensagem_whatsapp, e.mensagem_manutencao) AS modelo,
       %(hoje)s::date AS data, 'manutencao' AS tipo
FROM clientes c
JOIN empresas e ON e.id = c.empresa_id
WHERE e.mensagem_automatica_ativa
  AND coalesce(c.mensagem_whatsapp, e.mensagem_manutencao) IS NOT NULL
  AND e.whatsapp_remetente IS NOT NULL
  AND ((c.criado_em AT TIME ZONE 'America/Sao_Paulo')::date
       + make_interval(months => c.intervalo_manutencao_meses))::date = %(hoje)s
  AND NOT EXISTS (
    SELECT 1 FROM envios_whatsapp w
    WHERE w.cliente_id = c.id AND w.tipo = 'manutencao' AND w.data_referencia = %(hoje)s AND w.status <> 'erro')
ORDER BY e.whatsapp_remetente, c.numero
"""

# TEMPORÁRIO (testes): envios com data e hora escolhidas no cadastro do cliente, já vencidos.
SQL_AGENDADOS = """
SELECT c.id AS cliente_id, c.nome, c.celular,
       e.id AS empresa_id, e.nome AS empresa, e.whatsapp_remetente AS remetente,
       coalesce(c.mensagem_whatsapp, e.mensagem_manutencao) AS modelo,
       (c.envio_teste_em AT TIME ZONE 'America/Sao_Paulo')::date AS data, 'agendado' AS tipo,
       c.envio_teste_em
FROM clientes c
JOIN empresas e ON e.id = c.empresa_id
WHERE c.envio_teste_em IS NOT NULL AND c.envio_teste_em <= now()
ORDER BY e.whatsapp_remetente NULLS FIRST, c.envio_teste_em
"""

SQL_REGISTRAR_MANUTENCAO = """
INSERT INTO envios_whatsapp (id, empresa_id, cliente_id, data_referencia, tipo, telefone, mensagem, status, erro, criado_em)
VALUES (gen_random_uuid(), %(empresa_id)s, %(cliente_id)s, %(data)s, 'manutencao', %(telefone)s, %(mensagem)s,
        %(status)s, %(erro)s, now())
ON CONFLICT (cliente_id, data_referencia) WHERE tipo = 'manutencao' DO UPDATE
SET telefone = EXCLUDED.telefone, mensagem = EXCLUDED.mensagem, status = EXCLUDED.status,
    erro = EXCLUDED.erro, criado_em = EXCLUDED.criado_em
WHERE envios_whatsapp.status = 'erro'
"""

SQL_REGISTRAR_AGENDADO = """
INSERT INTO envios_whatsapp (id, empresa_id, cliente_id, data_referencia, tipo, telefone, mensagem, status, erro, criado_em)
VALUES (gen_random_uuid(), %(empresa_id)s, %(cliente_id)s, %(data)s, 'agendado', %(telefone)s, %(mensagem)s,
        %(status)s, %(erro)s, now())
"""

# Depois do teste, apaga o agendamento (se a pessoa não tiver mudado a data enquanto isso).
SQL_LIMPAR_AGENDADO = """
UPDATE clientes SET envio_teste_em = NULL WHERE id = %(cliente_id)s AND envio_teste_em = %(envio_teste_em)s
"""

SEM_CELULAR = "Configure o celular que envia em Clientes > Mensagem automática"
SEM_MENSAGEM = "Sem mensagem: digite no cadastro do cliente ou em Clientes > Mensagem automática"


def carregar_env() -> None:
    """Lê o arquivo .env da pasta (CHAVE=valor por linha) sem sobrescrever variáveis já definidas."""
    arquivo = PASTA / ".env"
    if not arquivo.exists():
        return
    for linha in arquivo.read_text(encoding="utf-8").splitlines():
        linha = linha.strip()
        if linha and not linha.startswith("#") and "=" in linha:
            chave, valor = linha.split("=", 1)
            os.environ.setdefault(chave.strip(), valor.strip())


def montar(modelo: str, nome: str, data: date, empresa: str) -> str:
    """Troca {nome} (primeiro nome do cliente), {data} e {empresa} no texto digitado no site."""
    primeiro_nome = nome.split()[0] if nome.split() else nome
    trocas = {"nome": primeiro_nome, "data": data.strftime("%d/%m/%Y"), "empresa": empresa}
    return re.sub(r"\{(nome|data|empresa)\}", lambda m: trocas[m.group(1).lower()], modelo, flags=re.IGNORECASE).strip()


def mensagem_de(envio: dict) -> str:
    return montar(envio["modelo"] or "", envio["nome"], envio["data"], envio["empresa"])


def registrar(conexao, envio: dict, mensagem: str, status: str, erro: str | None = None) -> None:
    """Grava o resultado no histórico; no teste agendado, também apaga o agendamento do cliente."""
    dados = {
        "empresa_id": envio["empresa_id"], "cliente_id": envio["cliente_id"], "data": envio["data"],
        "telefone": envio["celular"], "mensagem": mensagem, "status": status, "erro": erro,
    }
    if envio["tipo"] == "agendado":
        conexao.execute(SQL_REGISTRAR_AGENDADO, dados)
        conexao.execute(SQL_LIMPAR_AGENDADO, {"cliente_id": envio["cliente_id"], "envio_teste_em": envio["envio_teste_em"]})
    else:
        conexao.execute(SQL_REGISTRAR_MANUTENCAO, dados)
    conexao.commit()


def processar(conexao, envios: list[dict], modo: str, oculto: bool) -> None:
    """Envia uma lista de mensagens, abrindo um navegador por celular que envia."""
    # Sem celular que envia ou sem mensagem: nem abre o navegador, só registra o motivo.
    for e in envios:
        if not e["remetente"] or not e["modelo"]:
            motivo = SEM_CELULAR if not e["remetente"] else SEM_MENSAGEM
            registrar(conexao, e, mensagem_de(e), "erro", motivo)
            log.warning("Não enviada para %s: %s", e["nome"], motivo)
    prontos = [e for e in envios if e["remetente"] and e["modelo"]]

    for remetente, grupo in groupby(prontos, key=lambda e: e["remetente"]):
        lista = list(grupo)
        if modo == "teste":
            for e in lista:
                mensagem = mensagem_de(e)
                log.info("[modo teste] De +55%s para +55%s:\n%s", remetente, e["celular"], mensagem)
                registrar(conexao, e, mensagem, "teste")
            continue

        with WhatsAppWeb(remetente, oculto=oculto) as whatsapp:
            if not whatsapp.conectado():
                motivo = f"WhatsApp de {remetente} desconectado: rode 'python lembretes.py conectar {remetente}'"
                log.error(motivo)
                for e in lista:
                    registrar(conexao, e, mensagem_de(e), "erro", motivo)
                continue
            for i, e in enumerate(lista):
                mensagem = mensagem_de(e)
                try:
                    whatsapp.enviar(e["celular"], mensagem)
                    registrar(conexao, e, mensagem, "enviado")
                    log.info("Enviada para %s (+55%s).", e["nome"], e["celular"])
                except ErroEnvio as erro:
                    registrar(conexao, e, mensagem, "erro", str(erro))
                    log.warning("Não enviada para %s (+55%s): %s", e["nome"], e["celular"], erro)
                # Pausa entre uma mensagem e outra, como uma pessoa faria.
                if i < len(lista) - 1:
                    time.sleep(random.uniform(4, 9))


def verificar(conexao, modo: str, ignorar_horario: bool = False, oculto: bool = False) -> int:
    """Envia os testes agendados vencidos e as manutenções de hoje. Devolve quantas mensagens processou."""
    agora = conexao.execute(SQL_AGORA).fetchone()
    hoje, hora = agora["hoje"], agora["hora"]

    envios = conexao.execute(SQL_AGENDADOS).fetchall()
    if ignorar_horario or HORA_INICIO <= hora < HORA_FIM:
        envios += conexao.execute(SQL_MANUTENCAO, {"hoje": hoje}).fetchall()
    if not envios:
        return 0

    agendados = sum(e["tipo"] == "agendado" for e in envios)
    log.info("%s mensagem(ns) para enviar (%s de manutenção, %s de teste agendado).",
             len(envios), len(envios) - agendados, agendados)
    processar(conexao, sorted(envios, key=lambda e: e["remetente"] or ""), modo, oculto)
    return len(envios)


def so_digitos(valor: str) -> str:
    digitos = re.sub(r"\D", "", valor)
    # Aceita com ou sem o +55 na frente.
    return digitos[2:] if len(digitos) in (12, 13) and digitos.startswith("55") else digitos


def main() -> int:
    # Acentos certos no terminal do Windows (o log vai para o stderr)
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(message)s", datefmt="%d/%m %H:%M:%S")
    carregar_env()

    parser = argparse.ArgumentParser(description="Mensagens automáticas de manutenção pelo WhatsApp.")
    parser.add_argument("--uma-vez", action="store_true", help="verifica uma vez e termina")
    parser.add_argument("--agora", action="store_true", help="ignora o horário comercial")
    parser.add_argument("--oculto", action="store_true", help="tenta abrir o Chrome sem janela")
    comandos = parser.add_subparsers(dest="comando")
    conectar = comandos.add_parser("conectar", help="conecta o WhatsApp de um celular (QR Code)")
    conectar.add_argument("celular")
    testar = comandos.add_parser("testar", help="envia uma mensagem de teste agora")
    testar.add_argument("remetente")
    testar.add_argument("destino")
    testar.add_argument("mensagem")
    args = parser.parse_args()

    if args.comando == "conectar":
        celular = so_digitos(args.celular)
        print(f"Abrindo o WhatsApp Web para o celular {celular}.")
        print("No celular: WhatsApp > Aparelhos conectados > Conectar um aparelho, e escaneie o QR Code.")
        with WhatsAppWeb(celular) as whatsapp:
            if whatsapp.aguardar_login():
                print("Conectado! O login ficou salvo; o robô já pode enviar por este celular.")
                return 0
        print("O QR Code não foi escaneado a tempo. Rode o comando de novo.")
        return 1

    if args.comando == "testar":
        with WhatsAppWeb(so_digitos(args.remetente), oculto=args.oculto) as whatsapp:
            if not whatsapp.conectado():
                print(f"WhatsApp desconectado. Rode: python lembretes.py conectar {so_digitos(args.remetente)}")
                return 1
            try:
                whatsapp.enviar(so_digitos(args.destino), args.mensagem)
            except ErroEnvio as erro:
                print(f"Não enviada: {erro}")
                return 1
        print("Mensagem enviada.")
        return 0

    banco = os.environ.get("ORION_BANCO")
    if not banco:
        print("Configure ORION_BANCO no arquivo .env (veja .env.exemplo).")
        return 1
    modo = os.environ.get("WHATSAPP_MODO", "web").lower()
    segundos = int(os.environ.get("VERIFICAR_A_CADA_SEGUNDOS", "60"))
    log.info("Robô de mensagens automáticas iniciado (modo %s, verifica a cada %s segundos).", modo, segundos)

    while True:
        try:
            with psycopg.connect(banco, row_factory=dict_row) as conexao:
                verificar(conexao, modo, ignorar_horario=args.agora, oculto=args.oculto)
        except Exception:  # o robô não pode parar por causa de uma falha passageira (banco fora, Chrome travou...)
            log.exception("Falha ao verificar as manutenções de hoje")
            if args.uma_vez:
                return 1
        if args.uma_vez:
            return 0
        time.sleep(segundos)


if __name__ == "__main__":
    sys.exit(main())
