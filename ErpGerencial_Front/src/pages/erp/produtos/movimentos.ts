/** Nome e desenho de cada tipo de movimentação de estoque. */
export const TIPOS_MOVIMENTO: Record<string, { rotulo: string; emoji: string }> = {
  inicial: { rotulo: 'Estoque inicial', emoji: '🆕' },
  ajuste: { rotulo: 'Ajuste', emoji: '✏️' },
  venda: { rotulo: 'Venda', emoji: '🛒' },
  cancelamento: { rotulo: 'Venda cancelada', emoji: '↩️' },
}
