import { Link, Navigate, useParams } from 'react-router-dom'
import { IconeVoltar } from '../../components/icones/Icones'
import { IlustracaoConstrucao } from '../../components/icones/Ilustracoes'
import CabecalhoModulo from './CabecalhoModulo'
import { useErp } from './contexto'
import SemAcesso from './SemAcesso'
import { MODULOS, podeAcessar } from './modulos'

// Página de um módulo do menu que ainda está em construção.
export default function ModuloPage() {
  const { modulo: id } = useParams()
  const { sessao } = useErp()
  const modulo = MODULOS.find((m) => m.id === id)

  if (!modulo) return <Navigate to="/app" replace />

  return (
    <div className="erp-pagina">
      <CabecalhoModulo modulo={modulo} />
      {podeAcessar(sessao.usuario, modulo) ? (
        <div className="erp-em-breve">
          <IlustracaoConstrucao tamanho={120} />
          <div className="erp-em-breve-textos">
            <p className="erp-em-breve-titulo">Em construção</p>
            <p className="erp-em-breve-texto">Este módulo chega nas próximas etapas.</p>
            <Link to="/app" className="ghost-button erp-em-breve-botao">
              <IconeVoltar tamanho={20} />
              Voltar ao início
            </Link>
          </div>
        </div>
      ) : (
        <SemAcesso />
      )}
    </div>
  )
}
