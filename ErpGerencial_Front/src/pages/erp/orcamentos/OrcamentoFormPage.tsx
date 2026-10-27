import { useEffect, useState, type KeyboardEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { avisarSalvo } from '../../../components/aviso-salvo/avisarSalvo'
import type { Aviso } from '../../../components/formulario/FaixaAviso'
import { IconeCheck, IconeLixeira, IconeMais } from '../../../components/icones/Icones'
import { IlustracaoOrcamento } from '../../../components/icones/Ilustracoes'
import { useSessaoExpirada } from '../../../hooks/useSessaoExpirada'
import {
  criarOrcamento,
  editarOrcamento,
  excluirOrcamento,
  finalizarOrcamento,
  FORMAS_PAGAMENTO,
  listarClientes,
  mensagemDe,
  obterOrcamento,
  type Cliente,
  type DadosOrcamento,
  type FormaPagamento,
  type Orcamento,
} from '../../../services/api'
import {
  formatarMoeda,
  formatarQuantidade,
  formatarTelefone,
  mascaraMoeda,
  mascaraQuantidade,
  moedaParaNumero,
  quantidadeParaNumero,
} from '../../../utils/validacao'
import AvisoPagina from '../AvisoPagina'
import FaixaPagina from '../FaixaPagina'
import { useErp } from '../contexto'
import { MODULOS, podeAcessar, tem } from '../modulos'
import SemAcesso from '../SemAcesso'
import { numeroCupom } from '../cupons/numero'
import './orcamento.css'

const MODULO = MODULOS.find((m) => m.id === 'orcamento')!

/** Uma linha da planilha, com os valores como estão nos campos (texto). */
type Linha = {
  chave: number
  servico: string
  observacao: string
  preco: string
  quantidade: string
  data: string
}

type Coluna = 'servico' | 'observacao' | 'preco' | 'quantidade' | 'data'
const COLUNAS: Coluna[] = ['servico', 'observacao', 'preco', 'quantidade', 'data']

let proximaChave = 1

const dois = (n: number) => String(n).padStart(2, '0')
const hoje = () => {
  const d = new Date()
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`
}

const linhaVazia = (): Linha => ({
  chave: proximaChave++,
  servico: '',
  observacao: '',
  preco: '',
  quantidade: '1',
  data: hoje(),
})

const totalDa = (l: Linha) =>
  Math.round((quantidadeParaNumero(l.quantidade) ?? 0) * (moedaParaNumero(l.preco) ?? 0) * 100) / 100

/** Linha sem nada digitado (fica de fora ao salvar). */
const vazia = (l: Linha) => !l.servico.trim() && !l.observacao.trim() && !moedaParaNumero(l.preco)

const dataBr = (d: string | null) => (d ? d.split('-').reverse().join('/') : '—')

/**
 * Orçamento (/app/orcamento/novo ou /app/orcamento/:id): uma planilha com serviço, observação, preço, quantidade e
 * data em cada linha, e o total ao vivo. "Salvar" guarda para continuar depois; "Finalizar e gerar cupom" cria o
 * cupom com todas as linhas (e o orçamento não muda mais). Enter passa para a linha de baixo (criando uma nova no fim).
 */
export default function OrcamentoFormPage() {
  const { id } = useParams()
  const novo = !id
  const navigate = useNavigate()
  const { sessao } = useErp()
  const sessaoExpirada = useSessaoExpirada()
  const podeVer = podeAcessar(sessao.usuario, MODULO)
  const podeVerClientes = tem(sessao.usuario, 'clientes')

  const [original, setOriginal] = useState<Orcamento | null>(null)
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [clienteNome, setClienteNome] = useState('')
  const [sugestoes, setSugestoes] = useState<Cliente[]>([])
  const [observacao, setObservacao] = useState('')
  const [linhas, setLinhas] = useState<Linha[]>(() => [linhaVazia()])
  const [forma, setForma] = useState<FormaPagamento>('dinheiro')
  const [aviso, setAviso] = useState<Aviso>(null)
  const [salvando, setSalvando] = useState(false)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)

  // Edição: carrega o orçamento salvo
  useEffect(() => {
    if (novo || !podeVer) return
    let ativo = true
    obterOrcamento(sessao.token, id!)
      .then((o) => {
        if (!ativo) return
        setOriginal(o)
        setClienteNome(o.clienteNome ?? '')
        setObservacao(o.observacao ?? '')
        setLinhas(
          o.itens.length
            ? o.itens.map((i) => ({
                chave: proximaChave++,
                servico: i.servico,
                observacao: i.observacao ?? '',
                preco: formatarMoeda(i.preco),
                quantidade: mascaraQuantidade(formatarQuantidade(i.quantidade)),
                data: i.data ?? '',
              }))
            : [linhaVazia()],
        )
      })
      .catch((e) => ativo && !sessaoExpirada(e) && setAviso({ tipo: 'erro', texto: mensagemDe(e) }))
    return () => {
      ativo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, sessao.token, podeVer])

  // Sugestões de clientes do cadastro enquanto digita o nome
  useEffect(() => {
    const termo = clienteNome.trim()
    const jaEscolhido = cliente || (original?.clienteId && termo === original.clienteNome)
    if (jaEscolhido || termo.length < 2 || !podeVerClientes) {
      setSugestoes([])
      return
    }
    let ativo = true
    const espera = window.setTimeout(() => {
      listarClientes(sessao.token, termo, 1)
        .then((l) => ativo && setSugestoes(l.itens.slice(0, 6)))
        .catch((e) => ativo && sessaoExpirada(e))
    }, 300)
    return () => {
      ativo = false
      window.clearTimeout(espera)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteNome, cliente, sessao.token])

  if (!podeVer) return <div className="erp-pagina"><SemAcesso /></div>

  if (!novo && !original) {
    return (
      <div className="pagina tema-orcamento">
        <FaixaPagina Ilustracao={IlustracaoOrcamento} titulo="Orçamento" voltar={{ para: '/app/orcamento', rotulo: MODULO.rotulo }} />
        <div className="pagina-corpo">
          {aviso ? <AvisoPagina aviso={aviso} /> : <p className="erp-carregando">Carregando...</p>}
        </div>
      </div>
    )
  }

  const finalizado = original?.situacao === 'finalizado'
  const total = Math.round(linhas.reduce((soma, l) => soma + totalDa(l), 0) * 100) / 100

  const mudar = (chave: number, coluna: Coluna, valor: string) => {
    const mascara = coluna === 'preco' ? mascaraMoeda : coluna === 'quantidade' ? mascaraQuantidade : (v: string) => v
    setLinhas((atual) => atual.map((l) => (l.chave === chave ? { ...l, [coluna]: mascara(valor) } : l)))
    setAviso(null)
  }

  const adicionarLinha = (focar: Coluna = 'servico') => {
    const nova = linhaVazia()
    setLinhas((atual) => [...atual, nova])
    window.setTimeout(() => document.getElementById(`orc-${nova.chave}-${focar}`)?.focus(), 0)
  }

  const tirarLinha = (chave: number) => {
    setLinhas((atual) => (atual.length === 1 ? [linhaVazia()] : atual.filter((l) => l.chave !== chave)))
  }

  // Enter: vai para a mesma coluna na linha de baixo (no fim da planilha, cria uma linha nova)
  const tecla = (e: KeyboardEvent<HTMLInputElement>, indice: number, coluna: Coluna) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const abaixo = linhas[indice + 1]
    if (abaixo) document.getElementById(`orc-${abaixo.chave}-${coluna}`)?.focus()
    else adicionarLinha(coluna)
  }

  const conferir = (): string | null => {
    const preenchidas = linhas.filter((l) => !vazia(l))
    if (preenchidas.length === 0) return 'Preencha pelo menos um serviço.'
    for (const [i, l] of linhas.entries()) {
      if (vazia(l)) continue
      if (!l.servico.trim()) return `Linha ${i + 1}: digite o serviço.`
      if (!(quantidadeParaNumero(l.quantidade) ?? 0)) return `Linha ${i + 1}: digite a quantidade.`
    }
    return null
  }

  const dados = (): DadosOrcamento => ({
    clienteId: cliente?.id ?? (original?.clienteId && clienteNome.trim() === original.clienteNome ? original.clienteId : null),
    clienteNome: clienteNome.trim() || null,
    observacao: observacao.trim() || null,
    itens: linhas
      .filter((l) => !vazia(l))
      .map((l) => ({
        servico: l.servico.trim(),
        observacao: l.observacao.trim() || null,
        preco: moedaParaNumero(l.preco) ?? 0,
        quantidade: quantidadeParaNumero(l.quantidade) ?? 0,
        data: l.data || null,
      })),
  })

  /** Salva (cria ou altera) e devolve o orçamento salvo. */
  const gravar = async () => {
    const problema = conferir()
    if (problema) {
      setAviso({ tipo: 'erro', texto: problema })
      return null
    }
    return novo && !original
      ? criarOrcamento(sessao.token, dados())
      : editarOrcamento(sessao.token, original!.id, dados())
  }

  const salvar = async () => {
    if (salvando) return
    setSalvando(true)
    setAviso(null)
    try {
      const salvo = await gravar()
      if (!salvo) return
      setOriginal(salvo)
      avisarSalvo('Orçamento salvo com sucesso', `Nº ${numeroCupom(salvo.numero)}`)
      if (novo) navigate(`/app/orcamento/${salvo.id}`, { replace: true })
    } catch (e) {
      if (!sessaoExpirada(e)) setAviso({ tipo: 'erro', texto: mensagemDe(e) })
    } finally {
      setSalvando(false)
    }
  }

  const finalizar = async () => {
    if (salvando) return
    setSalvando(true)
    setAviso(null)
    try {
      const salvo = await gravar()
      if (!salvo) return
      setOriginal(salvo)
      const pronto = await finalizarOrcamento(sessao.token, salvo.id, forma)
      avisarSalvo('Cupom gerado com sucesso', `Orçamento Nº ${numeroCupom(pronto.numero)} finalizado`)
      navigate(`/app/cupom-fiscal/${pronto.cupomId}`)
    } catch (e) {
      if (!sessaoExpirada(e)) setAviso({ tipo: 'erro', texto: mensagemDe(e) })
    } finally {
      setSalvando(false)
    }
  }

  const excluir = async () => {
    setSalvando(true)
    try {
      await excluirOrcamento(sessao.token, original!.id)
      avisarSalvo('Orçamento excluído', `Nº ${numeroCupom(original!.numero)}`)
      navigate('/app/orcamento', { replace: true })
    } catch (e) {
      if (!sessaoExpirada(e)) setAviso({ tipo: 'erro', texto: mensagemDe(e) })
      setSalvando(false)
    }
  }

  const acoes =
    original && !finalizado ? (
      !confirmandoExclusao ? (
        <button type="button" className="pagina-botao escuro" onClick={() => setConfirmandoExclusao(true)}>
          <IconeLixeira tamanho={20} />
          Excluir
        </button>
      ) : (
        <>
          <button type="button" className="pagina-botao perigo" onClick={() => void excluir()} disabled={salvando}>
            <IconeLixeira tamanho={20} />
            Confirmar exclusão
          </button>
          <button type="button" className="pagina-botao escuro" onClick={() => setConfirmandoExclusao(false)}>
            Cancelar
          </button>
        </>
      )
    ) : undefined

  return (
    <div className="pagina tema-orcamento">
      <FaixaPagina
        Ilustracao={IlustracaoOrcamento}
        titulo={original ? `Orçamento Nº ${numeroCupom(original.numero)}` : 'Novo orçamento'}
        subtitulo={
          original
            ? `Feito por ${original.criadoPor} em ${new Date(original.criadoEm).toLocaleDateString('pt-BR')}`
            : 'Preencha a tabela: cada linha é um serviço.'
        }
        voltar={{ para: '/app/orcamento', rotulo: MODULO.rotulo }}
        acoes={acoes}
      />

      <div className="pagina-corpo orc">
        {finalizado && (
          <p className="orc-finalizado" role="status">
            <span aria-hidden="true">✅</span>
            Finalizado em {new Date(original!.finalizadoEm!).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.
            {original!.cupomId && (
              <Link to={`/app/cupom-fiscal/${original!.cupomId}`} className="orc-link-cupom">
                Ver cupom Nº {numeroCupom(original!.cupomNumero ?? 0)}
              </Link>
            )}
          </p>
        )}

        {/* Cliente e observação geral */}
        <div className="orc-dados">
          <div className="orc-campo orc-cliente">
            <label htmlFor="orc-cliente">Cliente</label>
            {finalizado ? (
              <p className="orc-valor">{original!.clienteNome ?? '—'}</p>
            ) : (
              <>
                <input
                  id="orc-cliente"
                  value={clienteNome}
                  autoComplete="off"
                  maxLength={200}
                  placeholder={podeVerClientes ? 'Nome do cliente (digite para buscar no cadastro)' : 'Nome do cliente'}
                  onChange={(e) => {
                    setClienteNome(e.target.value)
                    if (cliente) setCliente(null)
                  }}
                />
                {sugestoes.length > 0 && (
                  <ul className="orc-sugestoes" aria-label="Clientes encontrados">
                    {sugestoes.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setCliente(c)
                            setClienteNome(c.nome)
                            setSugestoes([])
                          }}
                        >
                          <strong>{c.nome}</strong>
                          <span>{formatarTelefone(c.celular)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
          <div className="orc-campo orc-observacao">
            <label htmlFor="orc-observacao">Observação do orçamento</label>
            {finalizado ? (
              <p className="orc-valor">{original!.observacao ?? '—'}</p>
            ) : (
              <input
                id="orc-observacao"
                value={observacao}
                maxLength={1000}
                placeholder="Sai no cupom (ex.: validade do orçamento, garantia...)"
                onChange={(e) => setObservacao(e.target.value)}
              />
            )}
          </div>
        </div>

        {/* A planilha: linhas e colunas */}
        <div className="orc-planilha-area">
          <table className="orc-planilha">
            <thead>
              <tr>
                <th scope="col" className="orc-n">#</th>
                <th scope="col" className="orc-col-servico">Serviço</th>
                <th scope="col" className="orc-col-observacao">Observação</th>
                <th scope="col" className="orc-col-preco numero">Preço</th>
                <th scope="col" className="orc-col-qtd numero">Quantidade</th>
                <th scope="col" className="orc-col-data">Data</th>
                <th scope="col" className="orc-col-total numero">Total</th>
                {!finalizado && (
                  <th scope="col" className="orc-col-tirar">
                    <span className="sr-only">Tirar</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {finalizado
                ? original!.itens.map((i, indice) => (
                    <tr key={i.id}>
                      <td className="orc-n">{indice + 1}</td>
                      <td className="orc-texto">{i.servico}</td>
                      <td className="orc-texto">{i.observacao ?? '—'}</td>
                      <td className="numero orc-texto">{formatarMoeda(i.preco)}</td>
                      <td className="numero orc-texto">{formatarQuantidade(i.quantidade)}</td>
                      <td className="orc-texto">{dataBr(i.data)}</td>
                      <td className="numero orc-total">{formatarMoeda(i.total)}</td>
                    </tr>
                  ))
                : linhas.map((l, indice) => (
                    <tr key={l.chave}>
                      <td className="orc-n">{indice + 1}</td>
                      {COLUNAS.map((coluna) => (
                        <td key={coluna} className={coluna === 'preco' || coluna === 'quantidade' ? 'numero' : undefined}>
                          <input
                            id={`orc-${l.chave}-${coluna}`}
                            aria-label={`${ROTULOS[coluna]} da linha ${indice + 1}`}
                            type={coluna === 'data' ? 'date' : 'text'}
                            inputMode={coluna === 'preco' ? 'numeric' : coluna === 'quantidade' ? 'decimal' : undefined}
                            placeholder={PLACEHOLDERS[coluna]}
                            maxLength={coluna === 'servico' ? 200 : coluna === 'observacao' ? 500 : undefined}
                            autoComplete="off"
                            value={l[coluna]}
                            onChange={(e) => mudar(l.chave, coluna, e.target.value)}
                            onKeyDown={(e) => tecla(e, indice, coluna)}
                          />
                        </td>
                      ))}
                      <td className="numero orc-total">{formatarMoeda(totalDa(l))}</td>
                      <td className="orc-col-tirar">
                        <button
                          type="button"
                          className="orc-tirar"
                          title="Tirar esta linha"
                          aria-label={`Tirar a linha ${indice + 1}`}
                          onClick={() => tirarLinha(l.chave)}
                        >
                          <IconeLixeira tamanho={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        <div className="orc-rodape">
          {!finalizado ? (
            <button type="button" className="orc-adicionar" onClick={() => adicionarLinha()}>
              <IconeMais tamanho={18} />
              Adicionar linha
            </button>
          ) : (
            <span />
          )}
          <p className="orc-total-geral">
            <span>Total do orçamento</span>
            <strong>{formatarMoeda(finalizado ? original!.total : total)}</strong>
          </p>
        </div>

        {aviso && <AvisoPagina aviso={aviso} />}
      </div>

      {!finalizado && (
        <div className="pagina-barra">
          <button type="button" className="pagina-botao" onClick={() => void salvar()} disabled={salvando}>
            <IconeCheck tamanho={20} />
            {salvando ? 'Salvando...' : 'Salvar orçamento'}
          </button>
          {/* Finalizar: pergunta a forma de pagamento e gera o cupom com todas as linhas */}
          <div className="orc-finalizar">
            <label htmlFor="orc-forma">Pagamento</label>
            <select id="orc-forma" value={forma} onChange={(e) => setForma(e.target.value as FormaPagamento)}>
              {FORMAS_PAGAMENTO.map((f) => (
                <option key={f.valor} value={f.valor}>
                  {f.rotulo}
                </option>
              ))}
            </select>
            <button type="button" className="pagina-botao marinho" onClick={() => void finalizar()} disabled={salvando}>
              <span aria-hidden="true">🧾</span>
              Finalizar e gerar cupom
            </button>
          </div>
          <Link to="/app/orcamento" className="pagina-botao neutro">
            Cancelar
          </Link>
        </div>
      )}
    </div>
  )
}

const ROTULOS: Record<Coluna, string> = {
  servico: 'Serviço',
  observacao: 'Observação',
  preco: 'Preço',
  quantidade: 'Quantidade',
  data: 'Data',
}

const PLACEHOLDERS: Record<Coluna, string | undefined> = {
  servico: 'Ex.: Troca de refil',
  observacao: 'Detalhes do serviço',
  preco: 'R$ 0,00',
  quantidade: '1',
  data: undefined,
}
