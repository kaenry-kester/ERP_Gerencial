import { Link, Navigate, useParams } from 'react-router-dom'
import { IconeVoltar } from '../../components/icones/Icones'
import { formatarCnpj, formatarTelefone } from '../../utils/validacao'
import { useLoja } from './contexto'
import { MODULOS } from './modulos'

const formatarData = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

// Página de um módulo do menu. "Dados da loja" já funciona; os outros ainda estão em construção.
export default function LojaModuloPage() {
  const { modulo: id } = useParams()
  const { loja } = useLoja()
  const modulo = MODULOS.find((m) => m.id === id)

  if (!modulo) return <Navigate to="/loja" replace />
  const { Icone } = modulo

  const cabecalho = (
    <header className="erp-pagina-cabecalho com-icone">
      <span className="erp-pagina-icone" aria-hidden="true">
        <Icone tamanho={26} />
      </span>
      <div>
        <h1 className="erp-pagina-titulo">{modulo.rotulo}</h1>
        <p className="erp-pagina-subtitulo">{modulo.descricao}</p>
      </div>
    </header>
  )

  if (modulo.id === 'dados-da-loja') {
    // [rótulo, valor, classe] — "largo" ocupa a linha toda
    const dados: [string, string, string?][] = [
      ['Nome da companhia', loja.razaoSocial, 'largo'],
      ['Nome fantasia', loja.nomeFantasia],
      ['CNPJ', formatarCnpj(loja.cnpj)],
      ['Dono', loja.nomeDono],
      ['Celular', formatarTelefone(loja.celular)],
      ['E-mail', loja.email, 'largo-celular'],
      ['Cadastrada em', formatarData(loja.criadoEm)],
    ]
    return (
      <div className="erp-pagina">
        {cabecalho}
        <dl className="erp-dados">
          {dados.map(([rotulo, valor, classe]) => (
            <div key={rotulo} className={classe ? `erp-dado ${classe}` : 'erp-dado'}>
              <dt>{rotulo}</dt>
              <dd>{valor}</dd>
            </div>
          ))}
        </dl>
      </div>
    )
  }

  return (
    <div className="erp-pagina">
      {cabecalho}
      <div className="erp-em-breve">
        <p className="erp-em-breve-titulo">Este módulo está em construção</p>
        <p className="erp-em-breve-texto">
          Ele chega nas próximas etapas do sistema. Enquanto isso, acompanhe os primeiros passos no
          painel.
        </p>
        <Link to="/loja" className="ghost-button erp-em-breve-botao">
          <IconeVoltar tamanho={20} />
          Voltar ao painel
        </Link>
      </div>
    </div>
  )
}
