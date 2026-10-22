import { useEffect, useState } from 'react'
import { EVENTO_AVISO_SALVO, type AvisoSalvoDados } from './avisarSalvo'
import './aviso-salvo.css'

const DURACAO_MS = 4000

/** Pop-up de confirmação de salvamento; fica no App, então continua visível ao trocar de página. */
export default function AvisoSalvo() {
  const [aviso, setAviso] = useState<(AvisoSalvoDados & { chave: number }) | null>(null)

  useEffect(() => {
    const ouvir = (e: Event) => setAviso({ ...(e as CustomEvent<AvisoSalvoDados>).detail, chave: Date.now() })
    window.addEventListener(EVENTO_AVISO_SALVO, ouvir)
    return () => window.removeEventListener(EVENTO_AVISO_SALVO, ouvir)
  }, [])

  useEffect(() => {
    if (!aviso) return
    const timer = setTimeout(() => setAviso(null), DURACAO_MS)
    return () => clearTimeout(timer)
  }, [aviso])

  return (
    <div className="aviso-salvo-area" role="status" aria-live="polite">
      {aviso && (
        // A chave reinicia as animações quando um aviso substitui outro
        <button key={aviso.chave} type="button" className="aviso-salvo" onClick={() => setAviso(null)} title="Fechar">
          <span className="aviso-salvo-emoji" aria-hidden="true">
            ✅
          </span>
          <span className="aviso-salvo-textos">
            <strong className="aviso-salvo-titulo">{aviso.titulo}</strong>
            {aviso.detalhe && <span className="aviso-salvo-detalhe">{aviso.detalhe}</span>}
          </span>
          {/* Barra que esvazia mostrando quanto tempo falta para o aviso sumir */}
          <span className="aviso-salvo-tempo" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
