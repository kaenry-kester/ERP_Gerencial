"""
Robô de mensagens automáticas do Órion (WhatsApp).

A cada minuto olha o banco e, quando chega a data e o horário do envio marcados no cadastro de um
cliente ("Data e horário do envio"), envia a mensagem pelo WhatsApp Web. Depois do envio, o horário
marcado é apagado. A mensagem é a personalizada do cliente ou, se ele não tiver, a mensagem padrão
(da lista de clientes). Cada envio fica em envios_whatsapp (histórico da página "Mensagem automática").

Comandos (dentro da pasta ErpGerencial_Automacao, com o ambiente .venv):
    python lembretes.py                         roda sem parar (verifica a cada minuto)
    python lembretes.py --uma-vez               verifica uma vez
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
log = logging.getLogger("lembretes")

# Envios com data e hora já vencidas (marcadas no cadastro do cliente).
SQL_PENDENTES = """
SELECT c.id AS cliente_id, c.nome, c.celular,
       e.id AS empresa_id, e.nome AS empresa, e.whatsapp_remetente AS remetente,
       coalesce(c.mensagem_whatsapp, e.mensagem_manutencao) AS modelo,
       (c.envio_em AT TIME ZONE 'America/Sao_Paulo')::date AS data,
       c.envio_em
FROM clientes c
JOIN empresas e ON e.id = c.empresa_id
WHERE c.envio_em IS NOT NULL AND c.envio_em <= now()
ORDER BY e.whatsapp_remetente NULLS FIRST, c.envio_em
"""

SQL_REGISTRAR = """
INSERT INTO envios_whatsapp (id, empresa_id, cliente_id, data_referencia, tipo, telefone, mensagem, status, erro, criado_em)
VALUES (gen_random_uuid(), %(empresa_id)s, %(cliente_id)s, %(data)s, 'agendado', %(telefone)s, %(mensagem)s,
        %(status)s, %(erro)s, now())
"""

# Depois do envio, apaga o horário marcado (se a pessoa não tiver mudado a data enquanto isso).
SQL_LIMPAR_HORARIO = """
UPDATE clientes SET envio_em = NULL WHERE id = %(cliente_id)s AND envio_em = %(envio_em)s
"""

SEM_CELULAR = "Configure o celular que envia em Clientes > Mensagem automática"
SEM_MENSAGEM = "Sem mensagem: escreva a mensagem padrão (lista de clientes) ou a personalizada do cliente"


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
    """Grava o resultado no histórico e apaga o horário marcado no cliente."""
    conexao.execute(SQL_REGISTRAR, {
        "empresa_id": envio["empresa_id"], "cliente_id": envio["cliente_id"], "data": envio["data"],
        "telefone": envio["celular"], "mensagem": mensagem, "status": status, "erro": erro,
    })
    conexao.execute(SQL_LIMPAR_HORARIO, {"cliente_id": envio["cliente_id"], "envio_em": envio["envio_em"]})
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


def verificar(conexao, modo: str, oculto: bool = False) -> int:
    """Envia as mensagens cujo horário já chegou. Devolve quantas processou."""
    envios = conexao.execute(SQL_PENDENTES).fetchall()
    if not envios:
        return 0
    log.info("%s mensagem(ns) com o horário de envio vencido.", len(envios))
    processar(conexao, envios, modo, oculto)
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
                verificar(conexao, modo, oculto=args.oculto)
        except Exception:  # o robô não pode parar por causa de uma falha passageira (banco fora, Chrome travou...)
            log.exception("Falha ao verificar os envios agendados")
            if args.uma_vez:
                return 1
        if args.uma_vez:
            return 0
        time.sleep(segundos)


if __name__ == "__main__":
    sys.exit(main())
