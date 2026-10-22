import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Cupom } from '../../../services/api'
import { CupomTermico, ReciboA4 } from './ImpressaoCupom'

export type FormatoImpressao = 'cupom' | 'recibo'

/**
 * Impressão do cupom: `imprimir('cupom')` abre a janela de impressão já no tamanho 80 mm;
 * `imprimir('recibo')`, em A4. Só o documento sai no papel (o resto da página fica escondido).
 * Coloque `elemento` em qualquer lugar da página.
 */
export function useImpressao(cupom: Cupom | null) {
  const [formato, setFormato] = useState<FormatoImpressao | null>(null)

  useEffect(() => {
    if (!formato) return
    // A bobina de 80 mm não tem altura fixa: o papel fica do tamanho do cupom (medido já montado, fora da tela)
    const altura = document.querySelector<HTMLElement>('.impressao .ct')?.offsetHeight ?? 0
    const alturaMm = Math.ceil((altura * 25.4) / 96) + 6
    const pagina = document.createElement('style')
    pagina.textContent =
      formato === 'cupom'
        ? `@page { size: 80mm ${Math.max(alturaMm, 60)}mm; margin: 0; }`
        : '@page { size: A4 portrait; margin: 10mm; }'
    document.head.appendChild(pagina)
    document.body.classList.add('imprimindo')
    const terminar = () => setFormato(null)
    window.addEventListener('afterprint', terminar)
    // Espera o documento aparecer na página antes de abrir a janela de impressão
    const timer = window.setTimeout(() => window.print(), 50)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('afterprint', terminar)
      pagina.remove()
      document.body.classList.remove('imprimindo')
    }
  }, [formato])

  const elemento =
    cupom && formato
      ? createPortal(
          <div className={`impressao impressao-${formato}`}>
            {formato === 'cupom' ? <CupomTermico cupom={cupom} /> : <ReciboA4 cupom={cupom} />}
          </div>,
          document.body,
        )
      : null

  return { imprimir: setFormato, imprimindo: formato !== null, elemento }
}
