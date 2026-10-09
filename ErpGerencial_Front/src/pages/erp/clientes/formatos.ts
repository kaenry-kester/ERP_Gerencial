import type { Cliente } from '../../../services/api'

// Formatação dos dados de clientes (datas, intervalo, endereço) e situação da manutenção.

/** "2027-04-08" → data local (sem fuso), para não mudar de dia. */
const paraData = (iso: string) => {
  const [ano, mes, dia] = iso.slice(0, 10).split('-').map(Number)
  return new Date(ano!, mes! - 1, dia!)
}

/** "2027-04-08" → "08/04/2027" */
export const formatarDia = (iso: string) => paraData(iso).toLocaleDateString('pt-BR')

/** Data e hora (ISO) → "08/10/2026 às 14:30". */
export const formatarDataHora = (iso: string) => {
  const d = new Date(iso)
  return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
}

/** Data e hora de um registro (criado/atualizado em) → "08/10/2026". */
export const formatarCadastro = (iso: string) => new Date(iso).toLocaleDateString('pt-BR')

export const formatarIntervalo = (meses: number) => (meses === 1 ? '1 mês' : `${meses} meses`)

/** "A cada 2 meses" ou "Data específica". */
export const descreverIntervalo = (c: Pick<Cliente, 'tipoIntervalo' | 'intervaloManutencaoMeses'>) =>
  c.tipoIntervalo === 'data' || !c.intervaloManutencaoMeses
    ? 'Data específica'
    : `A cada ${formatarIntervalo(c.intervaloManutencaoMeses)}`

/** Hora em que sai a mensagem no intervalo mensal. */
export const HORA_DO_ENVIO = '06:00'

/** Envio mensal a partir de hoje: mesmo dia, N meses à frente, às 6h ("08/12/2026 às 06:00"). */
export const envioMensalAPartirDeHoje = (meses: number) => `${formatarDia(somarMeses(new Date(), meses))} às ${HORA_DO_ENVIO}`

/** Quantos meses dá para escolher no intervalo de manutenção. */
export const INTERVALO_MAXIMO = 120

export type Situacao = { tipo: 'atrasada' | 'proxima' | 'em-dia'; texto: string }

/** Atrasada (vermelho), nos próximos 30 dias (creme) ou em dia (azul). */
export function situacaoManutencao(proxima: string): Situacao {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const dias = Math.round((paraData(proxima).getTime() - hoje.getTime()) / 86_400_000)
  if (dias < 0) return { tipo: 'atrasada', texto: dias === -1 ? 'Atrasada há 1 dia' : `Atrasada há ${-dias} dias` }
  if (dias === 0) return { tipo: 'proxima', texto: 'Hoje' }
  if (dias <= 30) return { tipo: 'proxima', texto: dias === 1 ? 'Amanhã' : `Em ${dias} dias` }
  return { tipo: 'em-dia', texto: 'Em dia' }
}

/** Próxima manutenção a partir de uma data (cadastro) + meses, no formato "2027-04-08". */
export function somarMeses(base: Date, meses: number) {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate())
  const dia = d.getDate()
  d.setMonth(d.getMonth() + meses)
  // 31/01 + 1 mês → último dia de fevereiro (igual ao servidor)
  if (d.getDate() !== dia) d.setDate(0)
  const dois = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`
}

/** "Rua das Flores, 120 — Centro, Campinas/SP" (só o que estiver preenchido). */
export function resumoEndereco(c: Cliente) {
  const rua = [c.logradouro, c.numeroEndereco].filter(Boolean).join(', ')
  const cidade = [c.cidade, c.uf].filter(Boolean).join('/')
  return [rua, [c.bairro, cidade].filter(Boolean).join(', ')].filter(Boolean).join(' — ')
}

/** Tamanho máximo das mensagens de WhatsApp (igual ao do servidor). */
export const MENSAGEM_MAXIMO = 1000

/** Trechos que o robô troca pelos dados de cada cliente. */
export const TRECHOS_MENSAGEM = [
  { trecho: '{nome}', rotulo: 'Nome do cliente' },
  { trecho: '{data}', rotulo: 'Data do envio' },
  { trecho: '{empresa}', rotulo: 'Nome da empresa' },
]
