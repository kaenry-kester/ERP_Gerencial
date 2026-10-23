"""
Ferramentas do WhatsApp do Órion (Evolution API, pasta evolution-api).

O envio automático das mensagens agora é feito pela própria API (Orion.Api, WhatsApp/EnvioAutomatico.cs), em segundo
plano: não é preciso deixar nenhum robô aberto. Este arquivo ficou só com os comandos para conectar o celular que envia
e para mandar uma mensagem de teste.

Comandos (dentro da pasta ErpGerencial_Automacao, com o ambiente .venv):
    python lembretes.py conectar 16991039268    conecta o WhatsApp desse celular (código ou QR Code)
    python lembretes.py testar 16991039268 16999998888 "Olá!"   envia uma mensagem de teste

Configuração no arquivo .env (veja .env.exemplo):
    EVOLUTION_URL              endereço da Evolution API (padrão: http://localhost:8080)
    EVOLUTION_CHAVE            chave da Evolution API (AUTHENTICATION_API_KEY do evolution-api/.env)
"""

import argparse
import os
import re
import sys
import time
from pathlib import Path

from whatsapp import CONECTADO, ErroEnvio, EvolutionAPI

PASTA = Path(__file__).resolve().parent


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


def so_digitos(valor: str) -> str:
    digitos = re.sub(r"\D", "", valor)
    # Aceita com ou sem o +55 na frente.
    return digitos[2:] if len(digitos) in (12, 13) and digitos.startswith("55") else digitos


PAGINA_CONEXAO = """<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta http-equiv="refresh" content="3">
<title>Conectar WhatsApp - Órion</title>
<style>
  body {{ margin: 0; min-height: 100vh; display: grid; place-items: center; background: #eef1f3;
         font-family: Montserrat, Segoe UI, sans-serif; color: #11161a; }}
  main {{ width: min(460px, 92vw); padding: 2rem; background: #fff; border-radius: 4px; text-align: center; }}
  h1 {{ margin: 0 0 .5rem; font-size: 1.3rem; color: #0f4255; }}
  p {{ margin: .4rem 0; line-height: 1.45; color: #4a5560; }}
  .codigo {{ margin: .8rem 0; font-size: 2rem; font-weight: 800; letter-spacing: .12em; color: #145369; }}
  img {{ width: 260px; height: 260px; image-rendering: pixelated; }}
  .ok {{ font-size: 1.6rem; font-weight: 800; color: #2e6b47; }}
</style></head><body><main>{conteudo}</main></body></html>"""


def conectar(celular: str, minutos: int = 5) -> int:
    """
    Conecta o WhatsApp do celular na Evolution. Abre no navegador uma página com o código de pareamento e o
    QR Code, que se atualiza sozinha (o QR muda a cada ~20 s); o navegador não trava o arquivo, ao contrário
    do visualizador de imagens do Windows.
    """
    whatsapp = EvolutionAPI(celular)
    if whatsapp.conectado():
        print(f"O celular {celular} já está conectado. O robô já pode enviar por ele.")
        return 0
    pagina = PASTA / f"conectar-{celular}.html"
    numero = f"({celular[:2]}) {celular[2:-4]}-{celular[-4:]}"

    def mostrar(conteudo: str) -> None:
        pagina.write_text(PAGINA_CONEXAO.format(conteudo=conteudo), encoding="utf-8")

    print(f"Conectando o WhatsApp do celular {celular}. No celular: WhatsApp > Aparelhos conectados > Conectar um aparelho.")
    print(f"  O código e o QR Code aparecem no navegador: {pagina}")
    codigo_atual = None
    aberta = False
    limite = time.monotonic() + minutos * 60
    while time.monotonic() < limite:
        conexao = whatsapp.iniciar_conexao()
        if whatsapp.estado() == CONECTADO:
            mostrar(f'<h1>WhatsApp {numero}</h1><p class="ok">Conectado!</p><p>Pode fechar esta página.</p>')
            print("Conectado! O login ficou salvo; o robô já pode enviar por este celular.")
            return 0
        codigo = conexao.get("pairingCode") or ""
        qr = conexao.get("base64") or ""
        if codigo and codigo != codigo_atual:
            codigo_atual = codigo
            print(f'  Código para "Conectar com número de telefone": {codigo[:4]}-{codigo[4:]}')
        mostrar(
            f"<h1>Conectar o WhatsApp {numero}</h1>"
            "<p>No celular: <b>WhatsApp → Aparelhos conectados → Conectar um aparelho</b>.</p>"
            + (f'<p>Toque em <b>"Conectar com número de telefone"</b> e digite:</p>'
               f'<p class="codigo">{codigo[:4]}-{codigo[4:]}</p>' if codigo else "")
            + (f'<p>ou escaneie o QR Code:</p><img src="{qr}" alt="QR Code">' if qr.startswith("data:image") else "")
            + "<p><small>Esta página se atualiza sozinha.</small></p>"
        )
        if not aberta and hasattr(os, "startfile"):
            os.startfile(pagina)  # abre no navegador padrão do Windows
            aberta = True
        time.sleep(3)
    mostrar("<h1>Tempo esgotado</h1><p>O celular não foi conectado a tempo. Rode o comando de novo.</p>")
    print("O celular não foi conectado a tempo. Rode o comando de novo.")
    return 1


def main() -> int:
    # Acentos certos no terminal do Windows
    sys.stdout.reconfigure(encoding="utf-8")
    carregar_env()

    parser = argparse.ArgumentParser(description="Ferramentas do WhatsApp do Órion (o envio automático é feito pela API).")
    comandos = parser.add_subparsers(dest="comando", required=True)
    comando_conectar = comandos.add_parser("conectar", help="conecta o WhatsApp de um celular (código ou QR Code)")
    comando_conectar.add_argument("celular")
    testar = comandos.add_parser("testar", help="envia uma mensagem de teste agora")
    testar.add_argument("remetente")
    testar.add_argument("destino")
    testar.add_argument("mensagem")
    args = parser.parse_args()

    try:
        if args.comando == "conectar":
            return conectar(so_digitos(args.celular))

        whatsapp = EvolutionAPI(so_digitos(args.remetente))
        if not whatsapp.conectado():
            print(f"WhatsApp desconectado. Rode: python lembretes.py conectar {so_digitos(args.remetente)}")
            return 1
        whatsapp.enviar(so_digitos(args.destino), args.mensagem)
        print("Mensagem enviada.")
        return 0
    except ErroEnvio as erro:
        print(f"Não deu certo: {erro}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
