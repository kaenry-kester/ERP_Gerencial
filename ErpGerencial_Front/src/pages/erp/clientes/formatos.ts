import type { Cliente, UnidadeIntervalo } from '../../../services/api'

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

export type Intervalo = { quantidade: number; unidade: UnidadeIntervalo }

const NOMES: Record<UnidadeIntervalo, [string, string]> = {
  minutos: ['minuto', 'minutos'],
  horas: ['hora', 'horas'],
  dias: ['dia', 'dias'],
  semanas: ['semana', 'semanas'],
  meses: ['mês', 'meses'],
}

/** "30 minutos", "1 hora", "2 meses"; minutos acima de uma hora viram "17h30". */
export function formatarIntervalo({ quantidade, unidade }: Intervalo) {
  if (unidade === 'minutos' && quantidade > 60) return `${Math.floor(quantidade / 60)}h${String(quantidade % 60).padStart(2, '0')}`
  return `${quantidade} ${NOMES[unidade][quantidade === 1 ? 0 : 1]}`
}

/** "A cada 30 minutos", "Data específica" (cadastros antigos) ou "Sem envios automáticos". */
export const descreverIntervalo = (c: Pick<Cliente, 'tipoIntervalo' | 'intervaloQuantidade' | 'intervaloUnidade' | 'envioEm'>) =>
  !c.envioEm
    ? 'Sem envios automáticos'
    : c.tipoIntervalo === 'data' || !c.intervaloQuantidade
      ? 'Data específica'
      : `A cada ${formatarIntervalo({ quantidade: c.intervaloQuantidade, unidade: c.intervaloUnidade })}`

/** Horário sugerido para o envio, ao escolher a data no calendário. */
export const HORA_DO_ENVIO = '09:00'

/** Até quantos meses à frente dá para marcar o próximo envio (10 anos, igual ao servidor). */
export const INTERVALO_MAXIMO = 120

/**
 * Intervalo = a diferença entre agora e o envio (igual ao servidor, ClienteEndpoints.CalcularIntervalo):
 * menos de 24 horas → minutos (ou horas, se for hora cheia): agora 16h30, envio 17h → 30 minutos;
 * mesmo dia do mês → meses: 14/10 → 14/12 = 2 meses; múltiplo de 7 dias → semanas; senão → dias.
 */
export function calcularIntervalo(envio: Date, agora = new Date()): Intervalo {
  const aoMinuto = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes())
  const a = aoMinuto(agora)
  const e = aoMinuto(envio)
  const minutos = Math.round((e.getTime() - a.getTime()) / 60_000)
  if (minutos < 24 * 60) {
    return minutos > 0 && minutos % 60 === 0
      ? { quantidade: minutos / 60, unidade: 'horas' }
      : { quantidade: Math.max(1, minutos), unidade: 'minutos' }
  }
  const meses = (e.getFullYear() - a.getFullYear()) * 12 + e.getMonth() - a.getMonth()
  if (e.getDate() === a.getDate() && meses >= 1) return { quantidade: meses, unidade: 'meses' }
  const dias = Math.round((new Date(e.getFullYear(), e.getMonth(), e.getDate()).getTime() -
    new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime()) / 86_400_000)
  return dias % 7 === 0 ? { quantidade: dias / 7, unidade: 'semanas' } : { quantidade: dias, unidade: 'dias' }
}

/** O envio seguinte: + o intervalo (meses pelo calendário: 31/01 + 1 mês = último dia de fevereiro), como o robô marca. */
export function somarIntervalo(d: Date, { quantidade, unidade }: Intervalo) {
  if (unidade === 'meses') {
    const [ano, mes, dia] = somarMeses(d, quantidade).split('-').map(Number)
    return new Date(ano!, mes! - 1, dia!, d.getHours(), d.getMinutes())
  }
  const minutos = { minutos: 1, horas: 60, dias: 1440, semanas: 10080 }[unidade] * quantidade
  // Dias e semanas pelo calendário (mesmo horário), minutos e horas pelo relógio
  if (unidade === 'dias' || unidade === 'semanas')
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + minutos / 1440, d.getHours(), d.getMinutes())
  return new Date(d.getTime() + minutos * 60_000)
}

/** Os próximos envios a partir do primeiro (ele incluído), cada um + o intervalo depois do anterior. */
export function proximosEnvios(primeiro: Date, intervalo: Intervalo, quantos: number) {
  const datas = [primeiro]
  while (datas.length < quantos) datas.push(somarIntervalo(datas.at(-1)!, intervalo))
  return datas
}

/** "2026-12-14" (dia local, para comparar com o calendário). */
export const diaDe = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

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
