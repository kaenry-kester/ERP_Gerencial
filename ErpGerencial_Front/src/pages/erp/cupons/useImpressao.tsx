import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Cupom } from '../../../services/api'
import { CupomTermico } from './ImpressaoCupom'

/**
 * Impressão do cupom: `imprimir()` abre a janela de impressão já no tamanho 80 mm (impressora térmica).
 * Só o cupom sai no papel (o resto da página fica escondido). Coloque `elemento` em qualquer lugar da página.
 */
export function useImpressao(cupom: Cupom | null, logoUrl?: string | null) {
  const [imprimindo, setImprimindo] = useState(false)

  useEffect(() => {
    if (!imprimindo) return
    // A bobina de 80 mm não tem altura fixa: o papel fica do tamanho do cupom (medido já montado, fora da tela)
    const altura = document.querySelector<HTMLElement>('.impressao .ct')?.offsetHeight ?? 0
    const alturaMm = Math.ceil((altura * 25.4) / 96) + 6
    const pagina = document.createElement('style')
    pagina.textContent = `@page { size: 80mm ${Math.max(alturaMm, 60)}mm; margin: 0; }`
    document.head.appendChild(pagina)
    document.body.classList.add('imprimindo')
    const terminar = () => setImprimindo(false)
    window.addEventListener('afterprint', terminar)
    // Espera o cupom aparecer na página antes de abrir a janela de impressão
    const timer = window.setTimeout(() => window.print(), 50)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('afterprint', terminar)
      pagina.remove()
      document.body.classList.remove('imprimindo')
    }
  }, [imprimindo])

  const elemento =
    cupom && imprimindo
      ? createPortal(
          <div className="impressao impressao-cupom">
            <CupomTermico cupom={cupom} logoUrl={logoUrl} />
          </div>,
          document.body,
        )
      : null

  return { imprimir: () => setImprimindo(true), imprimindo, elemento }
}
