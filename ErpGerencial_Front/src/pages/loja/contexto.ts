import { useOutletContext } from 'react-router-dom'
import type { LojaDetalhe } from '../../services/api'

export type ContextoLoja = { loja: LojaDetalhe }

/** Dados da loja aberta, para as páginas dentro do LojaLayout. */
export const useLoja = () => useOutletContext<ContextoLoja>()
