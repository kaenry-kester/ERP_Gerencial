"""
Envio de mensagens pelo WhatsApp através da Evolution API (pasta evolution-api, roda em http://localhost:8080).

A Evolution conversa direto com o WhatsApp, como um "aparelho conectado", sem abrir navegador: cada mensagem
sai em menos de um segundo. Cada celular que envia vira uma "instância" da Evolution, com o nome igual ao
número (só dígitos, com DDD). Na primeira vez, rode `python lembretes.py conectar <celular>` e conecte esse
celular (WhatsApp > Aparelhos conectados). Depois disso o login fica salvo na Evolution.

Configuração no .env: EVOLUTION_URL (padrão http://localhost:8080) e EVOLUTION_CHAVE (a AUTHENTICATION_API_KEY
do evolution-api/.env).
"""

import json
import os
import urllib.error
import urllib.request
from urllib.parse import quote

# Situação da conexão, como a Evolution descreve
CONECTADO = "open"
CONECTANDO = "connecting"
INEXISTENTE = "inexistente"


class ErroEnvio(Exception):
    """A mensagem não saiu (motivo em português, vai para o histórico)."""


def _endereco() -> str:
    return os.environ.get("EVOLUTION_URL", "http://localhost:8080").rstrip("/")


def _detalhe(resposta: dict | list) -> str:
    """Tira a mensagem de erro da resposta da Evolution ({"response": {"message": [...]}})."""
    mensagem = resposta.get("response", {}).get("message", resposta) if isinstance(resposta, dict) else resposta
    return "; ".join(map(str, mensagem)) if isinstance(mensagem, list) else str(mensagem)


class EvolutionAPI:
    """
    Uso:
        wa = EvolutionAPI("16991039268")
        if wa.conectado():
            wa.enviar("16999998888", "Olá!")
    """

    def __init__(self, remetente: str):
        self.remetente = remetente
        self.instancia = quote(remetente)

    def _chamar(self, metodo: str, caminho: str, dados: dict | None = None, segundos: int = 60) -> tuple[int, dict | list]:
        """Chama a Evolution e devolve (código HTTP, resposta). Lança ErroEnvio se ela não estiver rodando."""
        corpo = json.dumps(dados).encode() if dados is not None else None
        pedido = urllib.request.Request(
            _endereco() + caminho, data=corpo, method=metodo,
            headers={"apikey": os.environ.get("EVOLUTION_CHAVE", ""), "Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(pedido, timeout=segundos) as resposta:
                return resposta.status, json.loads(resposta.read() or b"{}")
        except urllib.error.HTTPError as erro:
            texto = erro.read().decode(errors="replace")
            if erro.code == 401:
                raise ErroEnvio("A Evolution API recusou a chave: confira EVOLUTION_CHAVE no .env") from None
            try:
                return erro.code, json.loads(texto)
            except ValueError:
                return erro.code, {"response": {"message": texto}}
        except (urllib.error.URLError, TimeoutError, ConnectionError) as erro:
            if isinstance(erro, TimeoutError) or isinstance(getattr(erro, "reason", None), TimeoutError):
                raise ErroEnvio("A Evolution API demorou demais para responder (o celular está conectado?)") from None
            raise ErroEnvio(f"A Evolution API não está rodando em {_endereco()}") from None

    def estado(self) -> str:
        """"open" (conectado), "connecting", "close" ou "inexistente" (celular nunca foi conectado)."""
        codigo, resposta = self._chamar("GET", f"/instance/connectionState/{self.instancia}", segundos=15)
        if codigo == 404:
            return INEXISTENTE
        return (resposta.get("instance") or {}).get("state") or "close"

    def conectado(self) -> bool:
        return self.estado() == CONECTADO

    def iniciar_conexao(self) -> dict:
        """
        Cria a instância deste celular (se ainda não existir) e pede a conexão.
        Devolve {"pairingCode": código para digitar no celular, "base64": imagem do QR Code (data:image/png...)}.
        """
        if self.estado() == INEXISTENTE:
            codigo, resposta = self._chamar("POST", "/instance/create", {
                "instanceName": self.remetente, "integration": "WHATSAPP-BAILEYS", "qrcode": False,
            })
            if codigo >= 300:
                raise ErroEnvio(f"Não foi possível criar a conexão: {_detalhe(resposta)}")
        _, resposta = self._chamar("GET", f"/instance/connect/{self.instancia}?number=55{self.remetente}")
        return resposta if isinstance(resposta, dict) else {}

    def enviar(self, destino: str, mensagem: str) -> None:
        """
        Envia a mensagem para um celular brasileiro (só dígitos, com DDD).
        Lança ErroEnvio se o número não tiver WhatsApp ou a Evolution não aceitar o envio.
        """
        # Confere se o número tem WhatsApp (a Evolution também acerta o nono dígito dos celulares).
        codigo, resposta = self._chamar("POST", f"/chat/whatsappNumbers/{self.instancia}", {"numbers": [f"55{destino}"]})
        if codigo >= 300:
            raise ErroEnvio(f"Não foi possível conferir o número: {_detalhe(resposta)}")
        numero = resposta[0] if isinstance(resposta, list) and resposta else {}
        if not numero.get("exists"):
            raise ErroEnvio("Este celular não tem WhatsApp ou o número está errado")

        # "delay": mostra "digitando..." por um instante antes de enviar, como uma pessoa faria.
        codigo, resposta = self._chamar("POST", f"/message/sendText/{self.instancia}", {
            "number": numero.get("jid") or f"55{destino}", "text": mensagem, "delay": 1500,
        })
        if codigo >= 300 or not (resposta.get("key") or {}).get("id"):
            raise ErroEnvio(f"O WhatsApp não aceitou a mensagem: {_detalhe(resposta)}")
