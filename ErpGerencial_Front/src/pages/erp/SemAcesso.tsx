import { IlustracaoConta } from '../../components/icones/Ilustracoes'

/** Para quem abriu (pelo endereço) um módulo que não foi liberado para ele. */
export default function SemAcesso() {
  return (
    <div className="erp-em-breve">
      <IlustracaoConta tamanho={120} />
      <div className="erp-em-breve-textos">
        <p className="erp-em-breve-titulo">Sem acesso</p>
        <p className="erp-em-breve-texto">Peça ao administrador para liberar este módulo.</p>
      </div>
    </div>
  )
}
