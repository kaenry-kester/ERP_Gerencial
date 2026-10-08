import type { ComponentType, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { IconeVoltar } from '../../components/icones/Icones'
import './pagina.css'

type Props = {
  titulo: string
  subtitulo?: ReactNode
  /** Ilustração do módulo, sobre um quadrado creme. */
  Ilustracao?: ComponentType<{ tamanho?: number }>
  /** Link "←" numa faixa fina acima do título (ex.: voltar para a lista). */
  voltar?: { para: string; rotulo: string }
  /** Botões à direita do título. */
  acoes?: ReactNode
}

// Faixa colorida de ponta a ponta no topo das páginas (a cor vem do tema da página: .pagina.tema-...):
// em cima, uma faixa fina com o "voltar"; embaixo, ilustração, título e ações.
export default function FaixaPagina({ titulo, subtitulo, Ilustracao, voltar, acoes }: Props) {
  return (
    <header className="pagina-faixa">
      {/* Faixa fina só para o "voltar" */}
      {voltar && (
        <nav className="pagina-faixa-voltar-area" aria-label="Voltar">
          <Link to={voltar.para} className="pagina-faixa-voltar">
            <IconeVoltar tamanho={18} />
            {voltar.rotulo}
          </Link>
        </nav>
      )}
      <div className="pagina-faixa-conteudo">
        {Ilustracao && (
          <span className="pagina-faixa-arte" aria-hidden="true">
            <Ilustracao tamanho={34} />
          </span>
        )}
        <div className="pagina-faixa-textos">
          <h1 className="pagina-faixa-titulo">{titulo}</h1>
          {subtitulo && <p className="pagina-faixa-subtitulo">{subtitulo}</p>}
        </div>
        {acoes && <div className="pagina-faixa-acoes">{acoes}</div>}
      </div>
    </header>
  )
}
