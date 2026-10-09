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
BOTAO_ENVIAR = 'footer button[aria-label="Enviar"], footer button[aria-label="Send"]'
JANELA_DE_AVISO = 'div[role="dialog"]'

# Situação da mensagem enviada, como o WhatsApp Web descreve (aria-label do ícone de tique)
SITUACAO_OK = ("enviada", "entregue", "lida", "sent", "delivered", "read")
SITUACAO_PENDENTE = ("pendente", "pending")

# Lê a situação da última mensagem que contém o texto (fora da caixa de digitação):
# null = ainda não apareceu na conversa; "" = apareceu, sem situação ainda; senão o texto da situação.
JS_SITUACAO = """(trecho) => {
    const main = document.querySelector('#main');
    if (!main) return null;
    const textos = [...main.querySelectorAll('span')].filter(s => !s.closest('footer') && (s.innerText || '').includes(trecho));
    const ultimo = textos.pop();
    if (!ultimo) return null;
    let bolha = ultimo;
    for (let i = 0; i < 10 && bolha && !bolha.querySelector('[aria-label]'); i++) bolha = bolha.parentElement;
    const rotulos = bolha ? [...bolha.querySelectorAll('[aria-label]')].map(e => (e.getAttribute('aria-label') || '').trim().toLowerCase()) : [];
    return rotulos.join('|');
}"""


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

        # Espera a conversa abrir de vez: texto na caixa e sem a janela "Iniciando conversa".
        # (Enviar durante essa janela faz a caixa esvaziar sem a mensagem sair.)
        limite = time.monotonic() + 60
        while True:
            aviso = pagina.locator(JANELA_DE_AVISO)
            texto_aviso = aviso.first.inner_text().lower() if aviso.count() else ""
            if "inválido" in texto_aviso or "invalid" in texto_aviso:
                raise ErroEnvio("Este celular não tem WhatsApp ou o número está errado")
            caixa = pagina.locator(CAIXA_DE_TEXTO)
            if not texto_aviso and caixa.count() and caixa.first.inner_text().strip():
                break
            if time.monotonic() > limite:
                raise ErroEnvio("A conversa não abriu a tempo no WhatsApp Web")
            pagina.wait_for_timeout(500)
        pagina.wait_for_timeout(1500)

        # Clica em "Enviar" (ou aperta Enter, se o botão não estiver lá)
        botao = pagina.locator(BOTAO_ENVIAR)
        if botao.count():
            botao.first.click()
        else:
            caixa.first.click()
            pagina.keyboard.press("Enter")

        # Só conta como enviada quando a mensagem aparece na conversa e o WhatsApp
        # confirma (enviada, entregue ou lida). Pendente por muito tempo = erro (o robô tenta de novo).
        trecho = mensagem.strip().splitlines()[0][:30]
        limite = time.monotonic() + 45
        situacao = None
        while time.monotonic() < limite:
            situacao = pagina.evaluate(JS_SITUACAO, trecho)
            if situacao and any(ok in situacao for ok in SITUACAO_OK) and not any(p in situacao for p in SITUACAO_PENDENTE):
                pagina.wait_for_timeout(2000)
                return
            pagina.wait_for_timeout(1000)
        if situacao is None:
            raise ErroEnvio("A mensagem não apareceu na conversa do WhatsApp")
        raise ErroEnvio("O WhatsApp não confirmou o envio (ficou pendente)")
