import type { ReactNode } from 'react'
import type { Modulo } from './modulos'

type Props = {
  modulo: Modulo
  /** Ação principal da página (ex.: "Novo usuário"), à direita do título. */
  acao?: ReactNode
}

// Título das páginas: a ilustração no fundo da cor do módulo, o nome e a descrição.
export default function CabecalhoModulo({ modulo, acao }: Props) {
  const { Icone, Ilustracao } = modulo
  return (
    <>
      <header className={`erp-pagina-cabecalho com-icone tema-${modulo.id}`}>
        <span className="erp-pagina-ilustracao" aria-hidden="true">
          {Ilustracao ? <Ilustracao tamanho={60} /> : <Icone tamanho={30} />}
        </span>
        <div className="erp-pagina-cabecalho-textos">
          <h1 className="erp-pagina-titulo">{modulo.rotulo}</h1>
          <p className="erp-pagina-subtitulo">{modulo.descricao}</p>
        </div>
        {acao}
      </header>
    </>
  )
}
