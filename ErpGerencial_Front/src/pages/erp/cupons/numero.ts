/** Nº do cupom com 6 dígitos: 12 → "000012". */
export const numeroCupom = (numero: number) => String(numero).padStart(6, '0')
