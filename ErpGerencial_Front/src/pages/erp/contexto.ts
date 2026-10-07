import { useOutletContext } from 'react-router-dom'
import type { Sessao } from '../../services/api'

export type ContextoErp = {
  /** Sessão com empresa (o ErpLayout só mostra as páginas quando há empresa). */
  sessao: Sessao & { empresa: NonNullable<Sessao['empresa']> }
  /** Atualiza a sessão depois de mudanças (ex.: nome da empresa editado). */
  atualizarSessao: (sessao: Sessao) => void
}

/** Sessão da pessoa e da empresa, para as páginas dentro do ErpLayout. */
export const useErp = () => useOutletContext<ContextoErp>()
