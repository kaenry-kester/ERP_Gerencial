import { useEffect, useRef } from 'react'

/** Um leitor manda os caracteres a poucos milissegundos um do outro; uma pessoa digita bem mais devagar. */
const INTERVALO_MAXIMO_MS = 50
/** Leituras mais curtas que isso são tratadas como digitação (o menor código comum, EAN-8, tem 8). */
const TAMANHO_MINIMO = 6
/** Leitor configurado sem Enter no fim: a leitura acaba quando os caracteres param de chegar. */
const FIM_SEM_ENTER_MS = 100

export type Leitura = {
  codigo: string
  /** Id do campo que estava com o cursor quando a leitura começou (os caracteres foram parar nele). */
  idAlvo: string | null
  /** Valor desse campo antes da leitura, para desfazer o que o leitor digitou nele. */
  valorAntes: string | null
}

/**
 * Leitor de código de barras USB/Bluetooth: o computador o enxerga como um teclado que "digita" o código
 * muito rápido e, quase sempre, aperta Enter no fim. Este hook reconhece essa digitação rápida em qualquer
 * lugar da página e chama `aoLer` com o código, mesmo que o cursor esteja em outro campo. O Enter da leitura
 * não envia o formulário, e no campo `idCampo` o Enter nunca envia (leitores mais lentos que o limite).
 */
export function useLeitorCodigoBarras(idCampo: string, aoLer: (leitura: Leitura) => void) {
  const aoLerAtual = useRef(aoLer)
  useEffect(() => {
    aoLerAtual.current = aoLer
  })

  useEffect(() => {
    let codigo = ''
    let ultimaTecla = 0
    let inicio: Omit<Leitura, 'codigo'> = { idAlvo: null, valorAntes: null }
    let timer: ReturnType<typeof setTimeout> | undefined

    const concluir = () => {
      clearTimeout(timer)
      if (codigo.length >= TAMANHO_MINIMO) aoLerAtual.current({ codigo, ...inicio })
      codigo = ''
    }

    const aoTeclar = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return
      const agora = performance.now()
      const rapido = agora - ultimaTecla < INTERVALO_MAXIMO_MS

      if (e.key === 'Enter' || e.key === 'Tab') {
        if (rapido && codigo.length >= TAMANHO_MINIMO) {
          e.preventDefault()
          concluir()
        } else {
          codigo = ''
          if (e.key === 'Enter' && (e.target as HTMLElement | null)?.id === idCampo) e.preventDefault()
        }
        return
      }
      if (e.key.length !== 1) {
        codigo = ''
        return
      }

      // Tecla devagar: pode ser o começo de uma leitura. Guarda onde ela caiu e o que o campo tinha antes.
      if (!rapido) {
        codigo = ''
        const alvo = e.target as HTMLInputElement | HTMLTextAreaElement | null
        inicio = { idAlvo: alvo?.id || null, valorAntes: typeof alvo?.value === 'string' ? alvo.value : null }
      }
      codigo += e.key
      ultimaTecla = agora
      clearTimeout(timer)
      timer = setTimeout(concluir, FIM_SEM_ENTER_MS)
    }

    // Na fase de captura: pega a tecla antes do formulário (assim o Enter da leitura não salva nada).
    document.addEventListener('keydown', aoTeclar, true)
    return () => {
      document.removeEventListener('keydown', aoTeclar, true)
      clearTimeout(timer)
    }
  }, [idCampo])
}
