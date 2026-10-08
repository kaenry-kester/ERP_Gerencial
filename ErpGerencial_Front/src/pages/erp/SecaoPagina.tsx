import type { ReactNode } from 'react'
import './pagina.css'

type Props = {
  /** Usado no id do título (acessibilidade). */
  id: string
  numero: number
  titulo: string
  /** Seção de ação perigosa (ex.: excluir conta): em vermelho. */
  perigo?: boolean
  /** Texto curto embaixo do título, na coluna colorida (ex.: aviso da busca do CEP). */
  extra?: ReactNode
  children: ReactNode
}

// Seção de ponta a ponta: número e título na coluna colorida, conteúdo na área branca.
export default function SecaoPagina({ id, numero, titulo, perigo, extra, children }: Props) {
  return (
    <section className={perigo ? 'pagina-secao perigo' : 'pagina-secao'} aria-labelledby={`secao-${id}`}>
      <div className="pagina-secao-lado">
        <span className="pagina-secao-numero" aria-hidden="true">
          {numero}
        </span>
        <div className="pagina-secao-textos">
          <h2 id={`secao-${id}`} className="pagina-secao-titulo">
            {titulo}
          </h2>
          {extra}
        </div>
      </div>
      <div className="pagina-secao-campos">{children}</div>
    </section>
  )
}
