// Google Identity Services (biblioteca oficial do Google para login).
// Usa o fluxo de "código" em janela popup: o botão continua com o visual do sistema
// e a API troca o código pelos dados da conta direto com o Google.

export type RespostaCodigo = { code?: string; error?: string }
export type ErroPopup = { type: 'popup_failed_to_open' | 'popup_closed' | 'unknown' }

export type ClienteCodigo = { requestCode: () => void }

type ConfigCodigo = {
  client_id: string
  scope: string
  ux_mode: 'popup'
  callback: (resposta: RespostaCodigo) => void
  error_callback?: (erro: ErroPopup) => void
}

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: { initCodeClient: (config: ConfigCodigo) => ClienteCodigo } } }
  }
}

const SCRIPT_GOOGLE = 'https://accounts.google.com/gsi/client'
let carregando: Promise<void> | null = null

/** Carrega o script do Google uma vez só (as telas de login e cadastro reaproveitam). */
export function carregarGoogle(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  carregando ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_GOOGLE
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      carregando = null
      script.remove()
      reject(new Error('Não foi possível carregar o Google'))
    }
    document.head.appendChild(script)
  })
  return carregando
}

export function criarClienteGoogle(
  clientId: string,
  aoReceber: (resposta: RespostaCodigo) => void,
  aoFalhar: (erro: ErroPopup) => void,
): ClienteCodigo {
  const oauth2 = window.google?.accounts?.oauth2
  if (!oauth2) throw new Error('Google não carregado')
  return oauth2.initCodeClient({
    client_id: clientId,
    scope: 'openid email profile',
    ux_mode: 'popup',
    callback: aoReceber,
    error_callback: aoFalhar,
  })
}
