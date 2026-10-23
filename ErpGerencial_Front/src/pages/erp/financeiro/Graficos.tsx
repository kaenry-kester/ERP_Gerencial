import { useEffect, useRef, useState, type ReactNode } from 'react'

const compacto = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 })

/** R$ 1,2 mil — para os eixos. */
const moedaCompacta = (valor: number) => compacto.format(valor)

/** Um teto "redondo" para o eixo (ex.: 873 → 1.000) e os valores das linhas de grade. */
function escala(maximo: number, linhas = 4) {
  if (maximo <= 0) return { teto: 1, marcas: [0] }
  const passoBruto = maximo / linhas
  const potencia = 10 ** Math.floor(Math.log10(passoBruto))
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * potencia).find((p) => p >= passoBruto)!
  const teto = passo * Math.ceil(maximo / passo)
  return { teto, marcas: Array.from({ length: Math.round(teto / passo) + 1 }, (_, i) => i * passo) }
}

type PropsColunas = {
  /** Texto embaixo de cada coluna. */
  rotulos: string[]
  valores: number[]
  /** Conteúdo do tooltip de cada coluna. */
  dica: (indice: number) => ReactNode
  /** Clique numa coluna (ex.: filtrar o dia). */
  aoClicar?: (indice: number) => void
  altura?: number
  /** Nome do gráfico para leitores de tela. */
  titulo: string
}

/**
 * Colunas de uma série só (uma cor), com linhas de grade discretas, tooltip ao passar o mouse
 * e área de clique maior que a coluna. Os rótulos de baixo pulam quando não cabem (todos aparecem no tooltip).
 */
export function GraficoColunas({ rotulos, valores, dica, aoClicar, altura = 220, titulo }: PropsColunas) {
  const [ativo, setAtivo] = useState<number | null>(null)
  // Desenha na largura real (em pixels), para os textos não ficarem esticados
  const caixa = useRef<HTMLDivElement>(null)
  const [largura, setLargura] = useState(800)
  useEffect(() => {
    const elemento = caixa.current
    if (!elemento) return
    const observador = new ResizeObserver(([e]) => setLargura(Math.max(260, Math.round(e.contentRect.width))))
    observador.observe(elemento)
    return () => observador.disconnect()
  }, [])
  const margemBaixo = 26
  const areaAltura = altura - margemBaixo - 8
  const { teto, marcas } = escala(Math.max(...valores, 0))
  // Espaço dos números do eixo: o do maior rótulo (~6,5px por letra no tamanho 11)
  const margemEsquerda = 16 + Math.max(...marcas.map((m) => moedaCompacta(m).length)) * 6.5
  const coluna = (largura - margemEsquerda) / Math.max(valores.length, 1)
  const espaco = Math.min(2 + coluna * 0.18, 10)
  const cadaRotulo = Math.max(1, Math.ceil(valores.length / Math.max(2, Math.floor((largura - margemEsquerda) / 64))))
  const y = (v: number) => 8 + areaAltura - (v / teto) * areaAltura

  return (
    <div className="grafico" ref={caixa} onMouseLeave={() => setAtivo(null)}>
      <svg width={largura} height={altura} viewBox={`0 0 ${largura} ${altura}`} role="img" aria-label={titulo}>
        {marcas.map((m) => (
          <g key={m}>
            <line x1={margemEsquerda} x2={largura} y1={y(m)} y2={y(m)} className="grafico-grade" />
            <text x={margemEsquerda - 8} y={y(m) + 4} className="grafico-eixo" textAnchor="end">
              {moedaCompacta(m)}
            </text>
          </g>
        ))}
        {valores.map((v, i) => {
          const x = margemEsquerda + i * coluna + espaco / 2
          const w = Math.max(coluna - espaco, 1)
          const topo = y(v)
          const h = 8 + areaAltura - topo
          const raio = Math.min(4, w / 2, h)
          return (
            <g key={i}>
              {v > 0 && (
                // Só o topo arredondado (a base fica reta, apoiada no eixo)
                <path
                  className={ativo === i ? 'grafico-barra ativa' : 'grafico-barra'}
                  d={`M${x},${topo + h} V${topo + raio} Q${x},${topo} ${x + raio},${topo} H${x + w - raio} Q${x + w},${topo} ${x + w},${topo + raio} V${topo + h} Z`}
                />
              )}
              {i % cadaRotulo === 0 && (
                <text x={x + w / 2} y={altura - 6} className="grafico-eixo" textAnchor="middle">
                  {rotulos[i]}
                </text>
              )}
              {/* Área de mouse/clique: a coluna inteira, de cima a baixo */}
              <rect
                x={margemEsquerda + i * coluna}
                y={0}
                width={coluna}
                height={altura - margemBaixo}
                fill="transparent"
                className={aoClicar ? 'grafico-alvo clicavel' : 'grafico-alvo'}
                onMouseEnter={() => setAtivo(i)}
                onClick={() => aoClicar?.(i)}
              />
            </g>
          )
        })}
        <line x1={margemEsquerda} x2={largura} y1={y(0)} y2={y(0)} className="grafico-base" />
      </svg>
      {ativo !== null && (
        <div
          className="grafico-dica"
          role="status"
          style={{
            left: `${((margemEsquerda + (ativo + 0.5) * coluna) / largura) * 100}%`,
            transform: `translateX(${ativo > valores.length * 0.7 ? '-100%' : ativo < valores.length * 0.3 ? '0' : '-50%'})`,
          }}
        >
          {dica(ativo)}
        </div>
      )}
    </div>
  )
}

export type LinhaRanking = { chave: string; nome: string; valor: number; extra?: string }

/** Ranking em barras horizontais (uma cor), com o nome e o valor em texto. */
export function BarrasRanking({
  linhas,
  formatar,
  vazio = 'Nenhuma venda no período.',
}: {
  linhas: LinhaRanking[]
  formatar: (valor: number) => string
  vazio?: string
}) {
  if (linhas.length === 0) return <p className="grafico-vazio">{vazio}</p>
  const maximo = Math.max(...linhas.map((l) => l.valor), 0) || 1
  return (
    <ol className="ranking">
      {linhas.map((l) => (
        <li key={l.chave}>
          <div className="ranking-textos">
            <span className="ranking-nome" title={l.nome}>
              {l.nome}
            </span>
            <span className="ranking-valor">{formatar(l.valor)}</span>
          </div>
          <div className="ranking-trilho" aria-hidden="true">
            <span className="ranking-barra" style={{ width: `${Math.max((l.valor / maximo) * 100, 1)}%` }} />
          </div>
          {l.extra && <span className="ranking-extra">{l.extra}</span>}
        </li>
      ))}
    </ol>
  )
}
