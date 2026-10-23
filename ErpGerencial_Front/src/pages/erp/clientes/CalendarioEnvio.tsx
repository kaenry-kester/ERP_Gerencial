import { useState } from 'react'

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]
const SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const SEMANA_NOME = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

const dois = (n: number) => String(n).padStart(2, '0')
const paraDia = (ano: number, mes: number, dia: number) => `${ano}-${dois(mes + 1)}-${dois(dia)}`

type Props = {
  id: string
  /** Dia escolhido ("2026-12-14") ou vazio. */
  dia: string
  /** Envios já agendados (o escolhido e os seguintes): ficam marcados no calendário. */
  agendados: string[]
  onEscolher: (dia: string) => void
  /** Até quantos meses à frente dá para navegar. */
  mesesMaximo: number
  erro?: string
}

/**
 * Calendário do mês: clicar num dia marca o próximo envio. Os envios seguintes (a cada N meses) aparecem marcados
 * em azul-claro ao navegar pelos meses. Dias que já passaram ficam desligados (hoje pode, num horário futuro).
 */
export default function CalendarioEnvio({ id, dia, agendados, onEscolher, mesesMaximo, erro }: Props) {
  const agora = new Date()
  const hoje = paraDia(agora.getFullYear(), agora.getMonth(), agora.getDate())
  // Mês mostrado: o do dia escolhido ou o atual
  const [visto, setVisto] = useState(() => {
    const [a, m] = (dia || hoje).split('-').map(Number)
    return { ano: a!, mes: m! - 1 }
  })

  const indice = (visto.ano - agora.getFullYear()) * 12 + visto.mes - agora.getMonth()
  const mudarMes = (passo: number) =>
    setVisto(({ ano, mes }) => {
      const d = new Date(ano, mes + passo, 1)
      return { ano: d.getFullYear(), mes: d.getMonth() }
    })

  const primeiroDia = new Date(visto.ano, visto.mes, 1).getDay()
  const diasNoMes = new Date(visto.ano, visto.mes + 1, 0).getDate()
  const celulas: (number | null)[] = [
    ...Array<null>(primeiroDia).fill(null),
    ...Array.from({ length: diasNoMes }, (_, i) => i + 1),
  ]
  const marcados = new Set(agendados)

  return (
    <div id={id} className={erro ? 'calendario com-erro' : 'calendario'} tabIndex={-1} aria-describedby={erro ? `${id}-erro` : undefined}>
      <div className="calendario-topo">
        <button type="button" onClick={() => mudarMes(-1)} disabled={indice <= 0} aria-label="Mês anterior">
          ‹
        </button>
        <strong aria-live="polite">
          {MESES[visto.mes]} {visto.ano}
        </strong>
        <button type="button" onClick={() => mudarMes(1)} disabled={indice >= mesesMaximo} aria-label="Próximo mês">
          ›
        </button>
      </div>

      <div className="calendario-grade" role="grid" aria-label={`${MESES[visto.mes]} de ${visto.ano}`}>
        {SEMANA.map((s, i) => (
          <span key={i} className="calendario-semana" title={SEMANA_NOME[i]} aria-hidden="true">
            {s}
          </span>
        ))}
        {celulas.map((n, i) => {
          if (n === null) return <span key={`v${i}`} />
          const d = paraDia(visto.ano, visto.mes, n)
          const classe = [
            'calendario-dia',
            d === dia && 'escolhido',
            d !== dia && marcados.has(d) && 'agendado',
            d === hoje && 'hoje',
          ]
            .filter(Boolean)
            .join(' ')
          return (
            <button
              key={d}
              type="button"
              className={classe}
              disabled={d < hoje}
              aria-pressed={d === dia}
              aria-label={`${n} de ${MESES[visto.mes]}${marcados.has(d) ? ', envio agendado' : ''}`}
              onClick={() => onEscolher(d)}
            >
              {n}
            </button>
          )
        })}
      </div>
      {erro && (
        <span id={`${id}-erro`} className="ficha-erro">
          {erro}
        </span>
      )}
    </div>
  )
}
