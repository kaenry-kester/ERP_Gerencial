export type AvisoSalvoDados = { titulo: string; detalhe?: string }

/** Evento do navegador que o componente AvisoSalvo (montado no App) escuta. */
export const EVENTO_AVISO_SALVO = 'orion:aviso-salvo'

/**
 * Mostra o pop-up "salvo com sucesso" no canto inferior esquerdo (some sozinho). Pode ser chamado antes de mudar de página.
 * @param titulo a frase principal, em destaque (ex.: "Cliente cadastrado com sucesso")
 * @param detalhe o que foi salvo, em letra menor (ex.: "Produto", "ID 12")
 */
export function avisarSalvo(titulo: string, detalhe?: string) {
  window.dispatchEvent(new CustomEvent<AvisoSalvoDados>(EVENTO_AVISO_SALVO, { detail: { titulo, detalhe } }))
}
