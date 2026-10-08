"""
Envio de mensagens pelo WhatsApp Web, controlando o Google Chrome com o Playwright.

Cada celular que envia tem a sua própria pasta de sessão (sessoes/<celular>). Na primeira vez,
rode `python lembretes.py conectar <celular>` e escaneie o QR Code com esse celular
(WhatsApp > Aparelhos conectados). Depois disso o login fica salvo.
"""

import time
from pathlib import Path
from urllib.parse import quote

from playwright.sync_api import Error as ErroPlaywright
from playwright.sync_api import sync_playwright

PASTA_SESSOES = Path(__file__).resolve().parent / "sessoes"
ENDERECO = "https://web.whatsapp.com/"

# Elementos do WhatsApp Web
LISTA_DE_CONVERSAS = "#pane-side"
QR_CODE = "canvas"
CAIXA_DE_TEXTO = 'footer div[contenteditable="true"]'
JANELA_DE_AVISO = 'div[role="dialog"]'
RELOGIO_PENDENTE = 'span[data-icon="msg-time"]'


class ErroEnvio(Exception):
    """A mensagem não saiu (motivo em português, vai para o histórico)."""


def sessao_existe(remetente: str) -> bool:
    return (PASTA_SESSOES / remetente).exists()


class WhatsAppWeb:
    """
    Uso:
        with WhatsAppWeb("16991039268") as wa:
            if wa.conectado():
                wa.enviar("16999998888", "Olá!")
    """

    def __init__(self, remetente: str, oculto: bool = False):
        self.remetente = remetente
        self.oculto = oculto
        self._playwright = None
        self._navegador = None
        self.pagina = None

    def __enter__(self):
        self._playwright = sync_playwright().start()
        # Usa o Google Chrome instalado no computador, com a sessão salva deste celular.
        self._navegador = self._playwright.chromium.launch_persistent_context(
            user_data_dir=str(PASTA_SESSOES / self.remetente),
            channel="chrome",
            headless=self.oculto,
            no_viewport=True,
            locale="pt-BR",
        )
        self.pagina = self._navegador.pages[0] if self._navegador.pages else self._navegador.new_page()
        return self

    def __exit__(self, *_):
        try:
            if self._navegador:
                self._navegador.close()
        finally:
            if self._playwright:
                self._playwright.stop()

    def conectado(self, segundos: int = 60) -> bool:
        """Abre o WhatsApp Web e diz se a conta está conectada (lista de conversas) ou pede QR Code."""
        self.pagina.goto(ENDERECO)
        try:
            self.pagina.wait_for_selector(f"{LISTA_DE_CONVERSAS}, {QR_CODE}", timeout=segundos * 1000)
        except ErroPlaywright:
            return False
        return self.pagina.locator(LISTA_DE_CONVERSAS).count() > 0

    def aguardar_login(self, minutos: int = 3) -> bool:
        """Mostra o QR Code e espera a pessoa escanear com o celular."""
        if self.conectado():
            return True
        try:
            self.pagina.wait_for_selector(LISTA_DE_CONVERSAS, timeout=minutos * 60_000)
            # Dá tempo de o WhatsApp Web terminar de sincronizar antes de fechar.
            self.pagina.wait_for_timeout(5000)
            return True
        except ErroPlaywright:
            return False

    def enviar(self, destino: str, mensagem: str) -> None:
        """
        Envia a mensagem para um celular brasileiro (só dígitos, com DDD).
        Lança ErroEnvio se o número não tiver WhatsApp ou a conversa não abrir.
        """
        pagina = self.pagina
        pagina.goto(f"{ENDERECO}send?phone=55{destino}&text={quote(mensagem)}")

        # Espera a conversa abrir com o texto já na caixa, ou o aviso de número inválido.
        limite = time.monotonic() + 60
        while True:
            caixa = pagina.locator(CAIXA_DE_TEXTO)
            if caixa.count() and caixa.first.inner_text().strip():
                break
            aviso = pagina.locator(JANELA_DE_AVISO)
            if aviso.count():
                texto = aviso.first.inner_text().lower()
                if "inválido" in texto or "invalid" in texto:
                    raise ErroEnvio("Este celular não tem WhatsApp ou o número está errado")
            if time.monotonic() > limite:
                raise ErroEnvio("A conversa não abriu a tempo no WhatsApp Web")
            pagina.wait_for_timeout(500)

        caixa.first.click()
        pagina.keyboard.press("Enter")

        # Enviada: a caixa esvazia e o relógio de "enviando" some.
        try:
            pagina.wait_for_function(
                "s => !document.querySelector(s)?.innerText.trim()", arg=CAIXA_DE_TEXTO, timeout=15_000
            )
            pagina.wait_for_timeout(1500)
            pagina.wait_for_selector(RELOGIO_PENDENTE, state="detached", timeout=30_000)
        except ErroPlaywright as erro:
            raise ErroEnvio("O WhatsApp não confirmou o envio") from erro
