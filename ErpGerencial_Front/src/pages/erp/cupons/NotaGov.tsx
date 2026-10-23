import type { Cupom } from '../../../services/api'
import { EMISSOR_GOV, NOME_NOTA } from './dadosNotaGov'

/**
 * Nota fiscal no site do governo: um botão que abre o Emissor Nacional (gov.br) numa aba nova,
 * direto na tela de emissão. Se a venda já tem uma nota anotada (de antes), mostra o número.
 */
export default function NotaGov({ cupom }: { cupom: Cupom }) {
  const anotada = cupom.notaTipo && cupom.notaNumero

  return (
    <div className={anotada ? 'cupom-gov anotada' : 'cupom-gov'}>
      <p className="cupom-gov-titulo">
        <span aria-hidden="true">{anotada ? '✅' : '🏛️'}</span>
        {anotada
          ? `${NOME_NOTA[cupom.notaTipo!]} Nº ${cupom.notaNumero} emitid${cupom.notaTipo === 'nota' ? 'a' : 'o'}`
          : 'Nota fiscal no gov.br'}
      </p>
      {!cupom.canceladoEm && (
        <a href={EMISSOR_GOV} target="_blank" rel="noreferrer" className="cupom-formato">
          <span className="cupom-formato-emoji" aria-hidden="true">
            🏢
          </span>
          <span className="cupom-formato-textos">
            <strong>Emitir nota fiscal</strong>
            <span>Abre o site do governo (gov.br)</span>
          </span>
        </a>
      )}
    </div>
  )
}
