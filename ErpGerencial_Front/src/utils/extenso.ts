// Valores e datas por extenso, para o recibo ("a quantia de cento e cinquenta reais").

const UNIDADES = [
  '', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez',
  'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove',
]
const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
const CENTENAS = [
  '', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos',
]
/** [singular, plural] de cada grupo de três dígitos (unidades, mil, milhão, bilhão). */
const ESCALAS: [string, string][] = [['', ''], ['mil', 'mil'], ['milhão', 'milhões'], ['bilhão', 'bilhões']]

/** 0–999 → "cento e vinte e três" ("" para zero). */
function ate999(n: number): string {
  if (n === 100) return 'cem'
  const partes: string[] = []
  const c = Math.floor(n / 100)
  const r = n % 100
  if (c) partes.push(CENTENAS[c])
  if (r >= 20) partes.push(r % 10 ? `${DEZENAS[Math.floor(r / 10)]} e ${UNIDADES[r % 10]}` : DEZENAS[Math.floor(r / 10)])
  else if (r) partes.push(UNIDADES[r])
  return partes.join(' e ')
}

/** Inteiro por extenso: 1530 → "mil quinhentos e trinta"; 2000000 → "dois milhões". */
export function inteiroPorExtenso(valor: number): string {
  let n = Math.floor(Math.abs(valor))
  if (n === 0) return 'zero'
  const grupos: number[] = []
  while (n > 0 && grupos.length < ESCALAS.length) {
    grupos.push(n % 1000)
    n = Math.floor(n / 1000)
  }
  const partes: { texto: string; grupo: number }[] = []
  for (let i = grupos.length - 1; i >= 0; i--) {
    const g = grupos[i]
    if (!g) continue
    const texto = i === 0 ? ate999(g) : i === 1 && g === 1 ? 'mil' : `${ate999(g)} ${ESCALAS[i][g === 1 ? 0 : 1]}`
    partes.push({ texto, grupo: g })
  }
  // "mil e quinhentos", "dois mil e vinte"; mas "mil duzentos e trinta" (o "e" só antes do último grupo redondo ou < 100)
  return partes
    .map((p, k) => {
      if (k === 0) return p.texto
      const ultimo = k === partes.length - 1
      return `${ultimo && (p.grupo < 100 || p.grupo % 100 === 0) ? 'e ' : ''}${p.texto}`
    })
    .join(' ')
}

/** Dinheiro por extenso: 1530.5 → "mil quinhentos e trinta reais e cinquenta centavos". */
export function valorPorExtenso(valor: number): string {
  const centavosTotais = Math.round(Math.abs(valor) * 100)
  const reais = Math.floor(centavosTotais / 100)
  const centavos = centavosTotais % 100
  const partes: string[] = []
  if (reais > 0) {
    // "um milhão de reais", "dois bilhões de reais" (sem nada nos grupos menores)
    const de = reais >= 1_000_000 && reais % 1_000_000 === 0 ? 'de ' : ''
    partes.push(`${inteiroPorExtenso(reais)} ${de}${reais === 1 ? 'real' : 'reais'}`)
  }
  if (centavos > 0) partes.push(`${inteiroPorExtenso(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`)
  return partes.length ? partes.join(' e ') : 'zero real'
}

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

/** "21 de outubro de 2026" */
export function dataPorExtenso(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`
}
