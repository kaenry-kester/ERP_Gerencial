import { Link } from 'react-router-dom'
import { IconeVoltar } from '../../components/icones/Icones'
import { IlustracaoConstrucao } from '../../components/icones/Ilustracoes'
import { useErp } from './contexto'
import { caminhoDo, MODULOS, tem } from './modulos'
import SemAcesso from './SemAcesso'

type Props = { modulo: 'clientes' }

const TITULOS = { clientes: 'Cadastrar cliente' }

// Cadastro de cliente (/app/clientes/novo).
// Os campos entram aqui assim que forem definidos.
export default function NovoCadastroPage({ modulo: id }: Props) {
  const { sessao } = useErp()
  const modulo = MODULOS.find((m) => m.id === id)!
  const permitido = tem(sessao.usuario, 'clientes-cadastrar')
  const { Ilustracao } = modulo

  return (
    <div className="erp-pagina erp-pagina-estreita">
      <Link to={caminhoDo(modulo)} className="erp-voltar">
        <IconeVoltar tamanho={18} />
        {modulo.rotulo}
      </Link>
      <header className={`erp-pagina-cabecalho com-icone tema-${id}`}>
        {Ilustracao && (
          <span className="erp-pagina-ilustracao" aria-hidden="true">
            <Ilustracao tamanho={64} />
          </span>
        )}
        <div className="erp-pagina-cabecalho-textos">
          <h1 className="erp-pagina-titulo">{TITULOS[id]}</h1>
        </div>
      </header>

      {permitido ? (
        <div className="erp-em-breve">
          <IlustracaoConstrucao tamanho={120} />
          <div className="erp-em-breve-textos">
            <p className="erp-em-breve-titulo">Campos em definição</p>
            <p className="erp-em-breve-texto">O formulário será liberado em breve.</p>
          </div>
        </div>
      ) : (
        <SemAcesso />
      )}
    </div>
  )
}
