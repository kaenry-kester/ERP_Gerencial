import type { TipoNota } from '../../../services/api'

/**
 * Emissor Nacional (NFS-e) do governo, direto na tela de emissão da nota (DPS → dados das pessoas).
 * Sem login, o gov.br pede a conta e depois volta sozinho para esta tela.
 */
export const EMISSOR_GOV = 'https://www.nfse.gov.br/EmissorNacional/DPS/Pessoas'

export const NOME_NOTA: Record<TipoNota, string> = { cupom: 'Cupom fiscal', nota: 'Nota fiscal' }
