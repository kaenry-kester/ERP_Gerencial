import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Aviso } from '../../../components/formulario/FaixaAviso'
import { IlustracaoFinanceiro } from '../../../components/icones/Ilustracoes'
import { useSessaoExpirada } from '../../../hooks/useSessaoExpirada'
import {
  FORMAS_PAGAMENTO,
  listarCupons,
  mensagemDe,
  obterResumoFinanceiro,
  rotuloPagamento,
  type FiltrosVendas,
  type ListaCupons,
  type ResumoFinanceiro,
  type TotaisVendas,
} from '../../../services/api'
import { formatarMoeda, formatarQuantidade } from '../../../utils/validacao'
import AvisoPagina from '../AvisoPagina'
import CabecalhoModulo from '../CabecalhoModulo'
import FaixaPagina from '../FaixaPagina'
import { useErp } from '../contexto'
import { MODULOS, podeAcessar } from '../modulos'
import SemAcesso from '../SemAcesso'
import { numeroCupom } from '../cupons/numero'
import { BarrasRanking, GraficoColunas } from './Graficos'
import './financeiro.css'

const MODULO = MODULOS.find((m) => m.id === 'financeiro')!

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

type Atalho = 'hoje' | '7dias' | '30dias' | 'mes' | 'mes-passado' | 'ano' | 'outro'

const ATALHOS: { valor: Exclude<Atalho, 'outro'>; rotulo: string }[] = [
  { valor: 'hoje', rotulo: 'Hoje' },
  { valor: '7dias', rotulo: '7 dias' },
  { valor: '30dias', rotulo: '30 dias' },
  { valor: 'mes', rotulo: 'Este mês' },
  { valor: 'mes-passado', rotulo: 'Mês passado' },
  { valor: 'ano', rotulo: 'Este ano' },
]

/** Data local → "2026-10-21". */
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const dataDe = (texto: string) => {
  const [a, m, d] = texto.split('-').map(Number)
  return new Date(a, m - 1, d || 1)
}

const periodoDoAtalho = (atalho: Exclude<Atalho, 'outro'>): { de: string; ate: string } => {
  const hoje = new Date()
  const dias = (n: number) => new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - n)
  switch (atalho) {
    case 'hoje':
      return { de: iso(hoje), ate: iso(hoje) }
    case '7dias':
      return { de: iso(dias(6)), ate: iso(hoje) }
    case '30dias':
      return { de: iso(dias(29)), ate: iso(hoje) }
    case 'mes':
      return { de: iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), ate: iso(hoje) }
    case 'mes-passado':
      return {
        de: iso(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)),
        ate: iso(new Date(hoje.getFullYear(), hoje.getMonth(), 0)),
      }
    case 'ano':
      return { de: iso(new Date(hoje.getFullYear(), 0, 1)), ate: iso(hoje) }
  }
}

const dataCurta = (texto: string) => dataDe(texto).toLocaleDateString('pt-BR')
const dataHora = (texto: string) => new Date(texto).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

/** Variação em relação ao período anterior: "▲ 12%" / "▼ 5%" / null (sem base para comparar). */
function variacao(atual: number, anterior: number) {
  if (!anterior) return null
  const pct = ((atual - anterior) / anterior) * 100
  if (Math.abs(pct) < 0.5) return { texto: '= igual ao anterior', classe: '' }
  return {
    texto: `${pct > 0 ? '▲' : '▼'} ${Math.abs(pct).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}% vs anterior`,
    classe: pct > 0 ? 'sobe' : 'desce',
  }
}

function Indicador({
  emoji,
  rotulo,
  valor,
  extra,
  comparar,
}: {
  emoji: string
  rotulo: string
  valor: string
  extra?: string
  comparar?: { atual: number; anterior: number }
}) {
  const v = comparar ? variacao(comparar.atual, comparar.anterior) : null
  return (
    <div className="fin-indicador">
      <div className="fin-indicador-topo">
        <span className="fin-indicador-emoji" aria-hidden="true">
          {emoji}
        </span>
        <span className="fin-indicador-rotulo">{rotulo}</span>
      </div>
      <strong className="fin-indicador-valor" title={valor}>
        {valor}
      </strong>
      {v && <span className={`fin-indicador-variacao ${v.classe}`}>{v.texto}</span>}
      {extra && <span className="fin-indicador-extra">{extra}</span>}
    </div>
  )
}

const margem = (t: TotaisVendas) =>
  t.faturamento > 0 ? `Margem de ${((t.lucroBruto / t.faturamento) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%` : undefined

/** Planilha (CSV, separada por ponto e vírgula, abre no Excel) com todas as vendas do filtro. */
async function baixarPlanilha(token: string, filtros: FiltrosVendas, situacao: string) {
  const linhas = [['Nº', 'Data', 'Cliente', 'CPF/CNPJ', 'Itens', 'Pagamento', 'Vendedor', 'Desconto', 'Total', 'Situação']]
  for (let pagina = 1; ; pagina++) {
    const l = await listarCupons(token, '', pagina, { ...filtros, situacao })
    for (const c of l.itens)
      linhas.push([
        numeroCupom(c.numero),
        dataHora(c.emitidoEm),
        c.clienteNome ?? 'Consumidor',
        c.clienteDocumento ?? '',
        c.itens.map((i) => `${formatarQuantidade(i.quantidade)} x ${i.descricao}`).join(' | ') || (c.referente ?? ''),
        rotuloPagamento(c.formaPagamento) + (c.formaPagamento2 ? ` + ${rotuloPagamento(c.formaPagamento2)}` : ''),
        c.vendedorNome ?? c.emitidoPor,
        c.desconto.toFixed(2).replace('.', ','),
        c.total.toFixed(2).replace('.', ','),
        c.canceladoEm ? 'Cancelado' : 'Emitido',
      ])
    if (pagina * l.tamanhoPagina >= l.total) break
  }
  const csv = linhas.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `vendas-${filtros.de}-a-${filtros.ate}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

// Financeiro: todas as vendas (cupons emitidos), com painel de resumo e o registro completo, nos mesmos filtros.
export default function FinanceiroPage() {
  const { sessao } = useErp()
  const navigate = useNavigate()
  const sessaoExpirada = useSessaoExpirada()
  const podeVer = podeAcessar(sessao.usuario, MODULO)

  const inicial = periodoDoAtalho('mes')
  const [atalho, setAtalho] = useState<Atalho>('mes')
  const [de, setDe] = useState(inicial.de)
  const [ate, setAte] = useState(inicial.ate)
  const [forma, setForma] = useState('')
  const [vendedorId, setVendedorId] = useState('')
  const [situacao, setSituacao] = useState('todas')
  const [pagina, setPagina] = useState(1)

  const [resumo, setResumo] = useState<ResumoFinanceiro | null>(null)
  const [lista, setLista] = useState<ListaCupons | null>(null)
  const [aviso, setAviso] = useState<Aviso>(null)
  const [baixando, setBaixando] = useState(false)

  const filtros: FiltrosVendas = { de, ate, forma: forma || undefined, vendedorId: vendedorId || undefined }

  useEffect(() => {
    if (!podeVer) return
    let ativo = true
    obterResumoFinanceiro(sessao.token, filtros)
      .then((r) => ativo && setResumo(r))
      .catch((e) => ativo && !sessaoExpirada(e) && setAviso({ tipo: 'erro', texto: mensagemDe(e) }))
    return () => {
      ativo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessao.token, podeVer, de, ate, forma, vendedorId])

  useEffect(() => {
    if (!podeVer) return
    let ativo = true
    listarCupons(sessao.token, '', pagina, { ...filtros, situacao })
      .then((l) => ativo && setLista(l))
      .catch((e) => ativo && !sessaoExpirada(e) && setAviso({ tipo: 'erro', texto: mensagemDe(e) }))
    return () => {
      ativo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessao.token, podeVer, de, ate, forma, vendedorId, situacao, pagina])

  if (!podeVer) {
    return (
      <div className="erp-pagina">
        <CabecalhoModulo modulo={MODULO} />
        <SemAcesso />
      </div>
    )
  }

  const definirPeriodo = (novoDe: string, novoAte: string, novoAtalho: Atalho) => {
    setDe(novoDe)
    setAte(novoAte)
    setAtalho(novoAtalho)
    setPagina(1)
  }

  // Mês e ano: o mês escolhido inteiro, ou o ano inteiro ("Todos os meses")
  const anoAtual = dataDe(de).getFullYear()
  const mesUnico = de.slice(0, 7) === ate.slice(0, 7) && de.endsWith('-01') && dataDe(ate).getDate() >= 28
  const mesSelecionado = mesUnico ? String(dataDe(de).getMonth() + 1) : ''
  const escolherMesAno = (mes: string, ano: number) => {
    if (!mes) definirPeriodo(`${ano}-01-01`, `${ano}-12-31`, 'outro')
    else {
      const m = Number(mes)
      definirPeriodo(iso(new Date(ano, m - 1, 1)), iso(new Date(ano, m, 0)), 'outro')
    }
  }

  const t = resumo?.totais
  const anterior = resumo?.anterior
  const porMes = resumo?.agrupamento === 'mes'

  const rotuloTempo = (periodo: string) => {
    if (porMes) {
      const [a, m] = periodo.split('-')
      return `${MESES_CURTOS[Number(m) - 1]}/${a.slice(2)}`
    }
    const [, m, d] = periodo.split('-')
    return `${d}/${m}`
  }

  const total = lista?.total ?? 0
  const paginas = lista ? Math.max(1, Math.ceil(total / lista.tamanhoPagina)) : 1

  return (
    <div className="pagina tema-financeiro">
      <FaixaPagina
        Ilustracao={IlustracaoFinanceiro}
        titulo="Financeiro"
        subtitulo="Todas as vendas registradas pelos cupons, com o resumo do período."
        acoes={
          <Link to="/app/cupom-fiscal/novo" className="pagina-botao azul">
            🛒 Nova venda
          </Link>
        }
      />

      {/* ---------- Filtros (uma linha acima de tudo) ---------- */}
      <div className="fin-filtros" role="group" aria-label="Filtros">
        <div className="fin-atalhos" role="radiogroup" aria-label="Período">
          {ATALHOS.map((a) => (
            <button
              key={a.valor}
              type="button"
              role="radio"
              aria-checked={atalho === a.valor}
              className={atalho === a.valor ? 'fin-atalho marcado' : 'fin-atalho'}
              onClick={() => {
                const p = periodoDoAtalho(a.valor)
                definirPeriodo(p.de, p.ate, a.valor)
              }}
            >
              {a.rotulo}
            </button>
          ))}
        </div>
        <label className="fin-filtro">
          <span>De</span>
          <input type="date" value={de} max={ate} onChange={(e) => e.target.value && definirPeriodo(e.target.value, ate, 'outro')} />
        </label>
        <label className="fin-filtro">
          <span>Até</span>
          <input type="date" value={ate} min={de} onChange={(e) => e.target.value && definirPeriodo(de, e.target.value, 'outro')} />
        </label>
        <label className="fin-filtro">
          <span>Mês</span>
          <select value={mesSelecionado} onChange={(e) => escolherMesAno(e.target.value, anoAtual)}>
            <option value="">Todos os meses</option>
            {MESES.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="fin-filtro">
          <span>Ano</span>
          <select value={anoAtual} onChange={(e) => escolherMesAno(mesSelecionado, Number(e.target.value))}>
            {(resumo?.anos.length ? resumo.anos : [new Date().getFullYear()]).map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="fin-filtro">
          <span>Pagamento</span>
          <select
            value={forma}
            onChange={(e) => {
              setForma(e.target.value)
              setPagina(1)
            }}
          >
            <option value="">Todos</option>
            {FORMAS_PAGAMENTO.map((f) => (
              <option key={f.valor} value={f.valor}>
                {f.rotulo}
              </option>
            ))}
          </select>
        </label>
        <label className="fin-filtro">
          <span>Vendedor</span>
          <select
            value={vendedorId}
            onChange={(e) => {
              setVendedorId(e.target.value)
              setPagina(1)
            }}
          >
            <option value="">Todos</option>
            {resumo?.equipe.map((u) => (
              <option key={u.chave} value={u.chave}>
                {u.nome}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="pagina-corpo fin-corpo">
        {aviso && <AvisoPagina aviso={aviso} />}
        {!resumo && !aviso && <p className="erp-carregando">Carregando...</p>}

        {resumo && t && anterior && (
          <>
            <p className="fin-periodo">
              {de === ate ? dataCurta(de) : `${dataCurta(de)} a ${dataCurta(ate)}`}
              {forma && ` · ${rotuloPagamento(forma)}`}
              {vendedorId && ` · ${resumo.equipe.find((u) => u.chave === vendedorId)?.nome ?? ''}`}
            </p>

            {/* ---------- Indicadores ---------- */}
            <div className="fin-indicadores">
              <Indicador
                emoji="💰"
                rotulo="Faturamento"
                valor={formatarMoeda(t.faturamento)}
                comparar={{ atual: t.faturamento, anterior: anterior.faturamento }}
              />
              <Indicador
                emoji="🧾"
                rotulo="Vendas"
                valor={formatarQuantidade(t.vendas)}
                comparar={{ atual: t.vendas, anterior: anterior.vendas }}
              />
              <Indicador
                emoji="🎯"
                rotulo="Ticket médio"
                valor={formatarMoeda(t.ticketMedio)}
                comparar={{ atual: t.ticketMedio, anterior: anterior.ticketMedio }}
              />
              <Indicador emoji="📈" rotulo="Lucro bruto" valor={formatarMoeda(t.lucroBruto)} extra={margem(t)} />
              <Indicador
                emoji="📦"
                rotulo="Itens vendidos"
                valor={formatarQuantidade(t.itensVendidos)}
                extra={t.descontos > 0 ? `Descontos: ${formatarMoeda(t.descontos)}` : undefined}
              />
              <Indicador
                emoji="⛔"
                rotulo="Cancelados"
                valor={formatarQuantidade(t.cancelados)}
                extra={t.cancelados > 0 ? formatarMoeda(t.valorCancelado) : undefined}
              />
            </div>

            {/* ---------- Faturamento no tempo ---------- */}
            <section className="fin-cartao fin-largo" aria-labelledby="fin-tempo">
              <div className="fin-cartao-topo">
                <h2 id="fin-tempo">Faturamento por {porMes ? 'mês' : 'dia'}</h2>
                <span className="fin-dica">Clique numa coluna para ver só {porMes ? 'aquele mês' : 'aquele dia'}</span>
              </div>
              <GraficoColunas
                titulo={`Faturamento por ${porMes ? 'mês' : 'dia'}`}
                rotulos={resumo.noTempo.map((p) => rotuloTempo(p.periodo))}
                valores={resumo.noTempo.map((p) => p.faturamento)}
                aoClicar={(i) => {
                  const p = resumo.noTempo[i].periodo
                  if (porMes) {
                    const d = dataDe(`${p}-01`)
                    definirPeriodo(iso(d), iso(new Date(d.getFullYear(), d.getMonth() + 1, 0)), 'outro')
                  } else definirPeriodo(p, p, 'outro')
                }}
                dica={(i) => {
                  const p = resumo.noTempo[i]
                  return (
                    <>
                      <strong>
                        {porMes
                          ? `${MESES[Number(p.periodo.slice(5, 7)) - 1]} de ${p.periodo.slice(0, 4)}`
                          : dataDe(p.periodo).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })}
                      </strong>
                      <span>{formatarMoeda(p.faturamento)}</span>
                      <span>
                        {p.vendas} {p.vendas === 1 ? 'venda' : 'vendas'}
                      </span>
                    </>
                  )
                }}
              />
            </section>

            {/* ---------- Rankings ---------- */}
            <div className="fin-grade">
              <section className="fin-cartao" aria-labelledby="fin-formas">
                <h2 id="fin-formas">Formas de pagamento</h2>
                <BarrasRanking
                  formatar={formatarMoeda}
                  linhas={resumo.formasPagamento.map((f) => ({
                    chave: f.chave,
                    nome: rotuloPagamento(f.chave),
                    valor: f.valor,
                    extra: `${f.quantidade} ${f.quantidade === 1 ? 'venda' : 'vendas'}`,
                  }))}
                />
              </section>
              <section className="fin-cartao" aria-labelledby="fin-produtos">
                <h2 id="fin-produtos">Produtos mais vendidos</h2>
                <BarrasRanking
                  formatar={formatarMoeda}
                  linhas={resumo.produtos.map((p) => ({
                    chave: p.chave,
                    nome: p.nome,
                    valor: p.valor,
                    extra: `${formatarQuantidade(p.quantidade)} ${p.quantidade === 1 ? 'unidade' : 'unidades'}`,
                  }))}
                />
              </section>
              <section className="fin-cartao" aria-labelledby="fin-clientes">
                <h2 id="fin-clientes">Melhores clientes</h2>
                <BarrasRanking
                  formatar={formatarMoeda}
                  vazio="Nenhuma venda com cliente identificado."
                  linhas={resumo.clientes.map((c) => ({
                    chave: c.chave,
                    nome: c.nome,
                    valor: c.valor,
                    extra: `${c.quantidade} ${c.quantidade === 1 ? 'compra' : 'compras'}`,
                  }))}
                />
              </section>
              <section className="fin-cartao" aria-labelledby="fin-vendedores">
                <h2 id="fin-vendedores">Vendas por vendedor</h2>
                <BarrasRanking
                  formatar={formatarMoeda}
                  linhas={resumo.vendedores.map((v) => ({
                    chave: v.chave,
                    nome: v.nome,
                    valor: v.valor,
                    extra: `${v.quantidade} ${v.quantidade === 1 ? 'venda' : 'vendas'}`,
                  }))}
                />
              </section>
              <section className="fin-cartao" aria-labelledby="fin-semana">
                <h2 id="fin-semana">Por dia da semana</h2>
                <GraficoColunas
                  titulo="Faturamento por dia da semana"
                  altura={180}
                  rotulos={DIAS_SEMANA.map((d) => d.slice(0, 3))}
                  valores={resumo.diasSemana}
                  dica={(i) => (
                    <>
                      <strong>{DIAS_SEMANA[i]}</strong>
                      <span>{formatarMoeda(resumo.diasSemana[i])}</span>
                    </>
                  )}
                />
              </section>
              <section className="fin-cartao" aria-labelledby="fin-horas">
                <h2 id="fin-horas">Por horário</h2>
                <GraficoColunas
                  titulo="Faturamento por hora do dia"
                  altura={180}
                  rotulos={resumo.horas.map((_, h) => `${h}h`)}
                  valores={resumo.horas}
                  dica={(i) => (
                    <>
                      <strong>
                        {i}h às {i + 1}h
                      </strong>
                      <span>{formatarMoeda(resumo.horas[i])}</span>
                    </>
                  )}
                />
              </section>
            </div>
          </>
        )}

        {/* ---------- Registro das vendas ---------- */}
        <section className="fin-cartao fin-largo fin-registro" aria-labelledby="fin-registro">
          <div className="fin-cartao-topo">
            <h2 id="fin-registro">Registro de vendas</h2>
            <div className="fin-registro-acoes">
              <select
                aria-label="Situação"
                value={situacao}
                onChange={(e) => {
                  setSituacao(e.target.value)
                  setPagina(1)
                }}
              >
                <option value="todas">Todas</option>
                <option value="emitidos">Só emitidas</option>
                <option value="cancelados">Só canceladas</option>
              </select>
              <button
                type="button"
                className="pagina-botao neutro"
                disabled={baixando || !total}
                onClick={async () => {
                  setBaixando(true)
                  try {
                    await baixarPlanilha(sessao.token, filtros, situacao)
                  } catch (e) {
                    if (!sessaoExpirada(e)) setAviso({ tipo: 'erro', texto: mensagemDe(e) })
                  } finally {
                    setBaixando(false)
                  }
                }}
              >
                📥 {baixando ? 'Gerando...' : 'Baixar planilha'}
              </button>
            </div>
          </div>

          {lista && lista.itens.length === 0 && <p className="grafico-vazio">Nenhuma venda neste filtro.</p>}
          {lista && lista.itens.length > 0 && (
            <div className="lista-tabela-area">
              <table className="lista-tabela">
                <thead>
                  <tr>
                    <th scope="col" className="lista-id">Nº</th>
                    <th scope="col">Data</th>
                    <th scope="col">Cliente</th>
                    <th scope="col">Itens</th>
                    <th scope="col">Pagamento</th>
                    <th scope="col">Vendedor</th>
                    <th scope="col" className="numero">Total</th>
                    <th scope="col">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.itens.map((c) => (
                    <tr key={c.id} onClick={() => navigate(`/app/cupom-fiscal/${c.id}`)}>
                      <td className="lista-id" data-rotulo="Nº">
                        <Link to={`/app/cupom-fiscal/${c.id}`} className="lista-nome">
                          {numeroCupom(c.numero)}
                        </Link>
                      </td>
                      <td data-rotulo="Data">{dataHora(c.emitidoEm)}</td>
                      <td className="lista-principal quebra" data-rotulo="Cliente">{c.clienteNome ?? 'Consumidor'}</td>
                      <td className="quebra" data-rotulo="Itens">
                        {c.itens.length > 0
                          ? c.itens.map((i) => `${formatarQuantidade(i.quantidade)}× ${i.descricao}`).join(', ')
                          : (c.referente ?? 'Recibo')}
                      </td>
                      <td data-rotulo="Pagamento">
                        {rotuloPagamento(c.formaPagamento)}
                        {c.formaPagamento2 && ` + ${rotuloPagamento(c.formaPagamento2)}`}
                      </td>
                      <td data-rotulo="Vendedor">{c.vendedorNome ?? c.emitidoPor}</td>
                      <td className="numero lista-destaque" data-rotulo="Total">{formatarMoeda(c.total)}</td>
                      <td data-rotulo="Situação">
                        <span className={c.canceladoEm ? 'lista-etiqueta alerta' : 'lista-etiqueta'}>
                          {c.canceladoEm ? 'Cancelado' : 'Emitido'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {lista && paginas > 1 && (
            <nav className="lista-paginas" aria-label="Páginas">
              <span>
                Página {pagina} de {paginas} · {total} vendas
              </span>
              <button type="button" className="pagina-botao neutro" disabled={pagina <= 1} onClick={() => setPagina((n) => n - 1)}>
                Anterior
              </button>
              <button
                type="button"
                className="pagina-botao neutro"
                disabled={pagina >= paginas}
                onClick={() => setPagina((n) => n + 1)}
              >
                Próxima
              </button>
            </nav>
          )}
        </section>
      </div>
    </div>
  )
}
