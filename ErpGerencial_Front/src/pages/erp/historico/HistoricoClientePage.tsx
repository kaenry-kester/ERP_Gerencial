import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Aviso } from '../../../components/formulario/FaixaAviso'
import { IconeLapis } from '../../../components/icones/Icones'
import { IlustracaoOrdemServico } from '../../../components/icones/Ilustracoes'
import { useSessaoExpirada } from '../../../hooks/useSessaoExpirada'
import { mensagemDe, obterHistoricoCliente, type EventoHistorico, type HistoricoCliente } from '../../../services/api'
import { formatarDocumento, formatarMoeda, formatarQuantidade, formatarTelefone } from '../../../utils/validacao'
import AvisoPagina from '../AvisoPagina'
import FaixaPagina from '../FaixaPagina'
import { useErp } from '../contexto'
import { MODULOS, podeAcessar, tem } from '../modulos'
import SemAcesso from '../SemAcesso'
import './historico.css'

const MODULO = MODULOS.find((m) => m.id === 'ordem-servico')!
const CUPONS = MODULOS.find((m) => m.id === 'cupom-fiscal')!

type Filtro = 'tudo' | 'venda' | 'mensagem' | 'cancelamento'

const FILTROS: { valor: Filtro; rotulo: string; emoji: string }[] = [
  { valor: 'tudo', rotulo: 'Tudo', emoji: '📋' },
  { valor: 'venda', rotulo: 'Vendas', emoji: '🛒' },
  { valor: 'mensagem', rotulo: 'Mensagens', emoji: '💬' },
  { valor: 'cancelamento', rotulo: 'Cancelamentos', emoji: '⛔' },
]

const EMOJI: Record<string, string> = { venda: '🛒', mensagem: '💬', cancelamento: '⛔', cadastro: '👤' }

const dataHora = (texto: string) =>
  new Date(texto).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

const mesAno = (texto: string) => {
  const t = new Date(texto).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function Evento({ evento, podeAbrirCupom }: { evento: EventoHistorico; podeAbrirCupom: boolean }) {
  const classe = [
    'historico-evento',
    evento.tipo,
    evento.status === 'erro' && 'erro',
    evento.status === 'cancelado' && 'riscado',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <li className={classe}>
      <span className="historico-evento-emoji" aria-hidden="true">
        {EMOJI[evento.tipo] ?? '•'}
      </span>
      <div className="historico-evento-corpo">
        <div className="historico-evento-topo">
          <div>
            <time className="historico-evento-data">{dataHora(evento.data)}</time>
            <h3 className="historico-evento-titulo">
              {evento.titulo}
              {evento.status === 'cancelado' && <span className="lista-etiqueta alerta">Cancelada depois</span>}
              {evento.status === 'teste' && <span className="lista-etiqueta atencao">Teste</span>}
              {evento.status === 'erro' && <span className="lista-etiqueta alerta">Não enviada</span>}
            </h3>
          </div>
          {evento.valor !== null && <strong className="historico-evento-valor">{formatarMoeda(evento.valor)}</strong>}
        </div>

        {evento.itens.length > 0 && (
          <table className="historico-itens">
            <thead>
              <tr>
                <th scope="col">Produto</th>
                <th scope="col">Código</th>
                <th scope="col">Cód. barras</th>
                <th scope="col" className="numero">Qtd.</th>
                <th scope="col" className="numero">Unitário</th>
                <th scope="col" className="numero">Total</th>
              </tr>
            </thead>
            <tbody>
              {evento.itens.map((i, n) => (
                <tr key={n}>
                  <td>{i.descricao}</td>
                  <td>{i.codigo ?? '—'}</td>
                  <td>{i.codigoBarras ?? '—'}</td>
                  <td className="numero">{formatarQuantidade(i.quantidade)}</td>
                  <td className="numero">{formatarMoeda(i.valorUnitario)}</td>
                  <td className="numero">{formatarMoeda(i.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {evento.detalhe &&
          (evento.tipo === 'mensagem' ? (
            <p className="historico-balao">{evento.detalhe}</p>
          ) : (
            <p className="historico-evento-detalhe">{evento.detalhe}</p>
          ))}

        {evento.cupomId && evento.tipo === 'venda' && podeAbrirCupom && (
          <Link to={`/app/cupom-fiscal/${evento.cupomId}`} className="historico-link">
            🧾 Ver e imprimir o cupom
          </Link>
        )}
      </div>
    </li>
  )
}

/** Quadro do resumo: desenho e título em cima, o valor grande e uma linha de detalhe. */
function Indicador({
  emoji,
  rotulo,
  valor,
  detalhe,
  alerta,
}: {
  emoji: string
  rotulo: string
  valor: string
  detalhe?: string
  alerta?: string
}) {
  return (
    <div className="historico-indicador">
      <div className="historico-indicador-topo">
        <span className="historico-indicador-emoji" aria-hidden="true">
          {emoji}
        </span>
        <span className="historico-indicador-rotulo">{rotulo}</span>
      </div>
      <strong className="historico-indicador-valor" title={valor}>
        {valor}
      </strong>
      {alerta && <span className="historico-indicador-alerta">{alerta}</span>}
      {detalhe && <span className="historico-indicador-detalhe">{detalhe}</span>}
    </div>
  )
}

// Histórico completo de um cliente: o que foi vendido, as mensagens enviadas, os cancelamentos e o cadastro.
export default function HistoricoClientePage() {
  const { id } = useParams()
  const { sessao } = useErp()
  const sessaoExpirada = useSessaoExpirada()
  const [historico, setHistorico] = useState<HistoricoCliente | null>(null)
  const [aviso, setAviso] = useState<Aviso>(null)
  const [filtro, setFiltro] = useState<Filtro>('tudo')
  const podeVer = podeAcessar(sessao.usuario, MODULO)
  const podeVender = podeAcessar(sessao.usuario, CUPONS)

  useEffect(() => {
    if (!podeVer) return
    let ativo = true
    obterHistoricoCliente(sessao.token, id!)
      .then((h) => ativo && setHistorico(h))
      .catch((e) => ativo && !sessaoExpirada(e) && setAviso({ tipo: 'erro', texto: mensagemDe(e) }))
    return () => {
      ativo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, sessao.token, podeVer])

  if (!podeVer) return <div className="erp-pagina"><SemAcesso /></div>

  const voltar = { para: '/app/ordem-servico', rotulo: MODULO.rotulo }

  if (!historico) {
    return (
      <div className="pagina tema-historico">
        <FaixaPagina Ilustracao={IlustracaoOrdemServico} titulo="Histórico do cliente" voltar={voltar} />
        <div className="pagina-corpo">
          {aviso ? <AvisoPagina aviso={aviso} /> : <p className="erp-carregando">Carregando...</p>}
        </div>
      </div>
    )
  }

  const r = historico.resumo
  const eventos = historico.eventos.filter((e) => filtro === 'tudo' || e.tipo === filtro)
  const contagem = (f: Filtro) => (f === 'tudo' ? historico.eventos.length : historico.eventos.filter((e) => e.tipo === f).length)

  // Agrupa por mês ("Outubro de 2026")
  const grupos: { mes: string; eventos: EventoHistorico[] }[] = []
  for (const e of eventos) {
    const mes = mesAno(e.data)
    if (grupos[grupos.length - 1]?.mes !== mes) grupos.push({ mes, eventos: [] })
    grupos[grupos.length - 1].eventos.push(e)
  }

  const acoes = (
    <>
      {podeVender && (
        <Link to={`/app/cupom-fiscal/novo?cliente=${historico.id}`} className="pagina-botao marrom">
          🛒 Nova venda
        </Link>
      )}
      {tem(sessao.usuario, 'clientes-editar') && (
        <Link to={`/app/clientes/${historico.id}`} className="pagina-botao claro">
          <IconeLapis tamanho={20} />
          Ficha do cliente
        </Link>
      )}
    </>
  )

  return (
    <div className="pagina tema-historico">
      <FaixaPagina
        Ilustracao={IlustracaoOrdemServico}
        titulo={historico.nome}
        subtitulo={[
          `ID ${historico.numero}`,
          formatarTelefone(historico.celular),
          historico.documento && formatarDocumento(historico.documento),
        ]
          .filter(Boolean)
          .join(' · ')}
        voltar={voltar}
        acoes={acoes}
      />

      <div className="pagina-corpo historico-corpo">
        {aviso && <AvisoPagina aviso={aviso} />}

        <div className="historico-resumo">
          <Indicador
            emoji="🛒"
            rotulo="Compras"
            valor={formatarQuantidade(r.compras)}
            detalhe={r.ultimaCompra ? `Última em ${new Date(r.ultimaCompra).toLocaleDateString('pt-BR')}` : 'Nenhuma ainda'}
          />
          <Indicador
            emoji="💰"
            rotulo="Total gasto"
            valor={formatarMoeda(r.totalGasto)}
            detalhe={r.primeiraCompra ? `Cliente desde ${new Date(r.primeiraCompra).toLocaleDateString('pt-BR')}` : undefined}
          />
          <Indicador emoji="🎯" rotulo="Ticket médio" valor={formatarMoeda(r.ticketMedio)} detalhe="Por compra" />
          <Indicador
            emoji="📦"
            rotulo="Itens comprados"
            valor={formatarQuantidade(r.itensComprados)}
            detalhe="Em todas as compras"
          />
          <Indicador
            emoji="💬"
            rotulo="Mensagens"
            valor={formatarQuantidade(r.mensagensEnviadas)}
            detalhe={r.mensagensComErro > 0 ? undefined : 'Enviadas pelo WhatsApp'}
            alerta={r.mensagensComErro > 0 ? `${r.mensagensComErro} não ${r.mensagensComErro === 1 ? 'enviada' : 'enviadas'}` : undefined}
          />
          <Indicador
            emoji="📅"
            rotulo="Próximo envio"
            valor={historico.proximoEnvio ? new Date(historico.proximoEnvio).toLocaleDateString('pt-BR') : '—'}
            detalhe={
              historico.proximoEnvio
                ? `às ${new Date(historico.proximoEnvio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                : 'Nenhuma marcada'
            }
          />
        </div>

        {historico.endereco && <p className="historico-endereco">📍 {historico.endereco}</p>}

        <div className="historico-filtros" role="radiogroup" aria-label="Mostrar">
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              type="button"
              role="radio"
              aria-checked={filtro === f.valor}
              className={filtro === f.valor ? 'historico-filtro marcado' : 'historico-filtro'}
              onClick={() => setFiltro(f.valor)}
            >
              <span aria-hidden="true">{f.emoji}</span>
              {f.rotulo}
              <span className="historico-filtro-numero">{contagem(f.valor)}</span>
            </button>
          ))}
        </div>

        {grupos.length === 0 && <p className="historico-vazio">Nada por aqui ainda.</p>}
        {grupos.map((g) => (
          <section key={g.mes} className="historico-mes" aria-label={g.mes}>
            <h2 className="historico-mes-titulo">{g.mes}</h2>
            <ol className="historico-linha">
              {g.eventos.map((e, i) => (
                <Evento key={`${e.tipo}-${e.data}-${i}`} evento={e} podeAbrirCupom={podeVender} />
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  )
}
