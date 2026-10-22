import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { avisarSalvo } from '../../../components/aviso-salvo/avisarSalvo'
import { IconeCheck, IconeLixeira, IconeVoltar } from '../../../components/icones/Icones'
import { IlustracaoProdutos } from '../../../components/icones/Ilustracoes'
import { useLeitorCodigoBarras } from '../../../hooks/useLeitorCodigoBarras'
import { useSessaoExpirada } from '../../../hooks/useSessaoExpirada'
import {
  emitirCupom,
  ErroApi,
  FORMAS_PAGAMENTO,
  listarClientes,
  listarCupons,
  listarProdutos,
  listarUsuarios,
  mensagemDe,
  obterCliente,
  urlImagemProduto,
  type Cliente,
  type FormaPagamento,
  type Produto,
  type Usuario,
} from '../../../services/api'
import {
  formatarDocumento,
  formatarMoeda,
  formatarQuantidade,
  formatarTelefone,
  mascaraMoeda,
  mascaraQuantidade,
  moedaParaNumero,
  normalizarCnpj,
  quantidadeParaNumero,
} from '../../../utils/validacao'
import CabecalhoModulo from '../CabecalhoModulo'
import { useErp } from '../contexto'
import { MODULOS, podeAcessar } from '../modulos'
import SemAcesso from '../SemAcesso'
import { numeroCupom } from './numero'
import './pdv.css'

const MODULO = MODULOS.find((m) => m.id === 'cupom-fiscal')!
const CLIENTES = MODULOS.find((m) => m.id === 'clientes')!

type Item = {
  chave: number
  /** Produto do cadastro; null no item avulso (serviço etc.), em que a descrição é digitada. */
  produtoId: string | null
  descricao: string
  /** Marca e modelo, embaixo da descrição. */
  detalhe: string | null
  codigo: string | null
  codigoBarras: string | null
  imagem: string | null
  estoque: number | null
  quantidade: string
  valor: string
}

const totalDoItem = (i: Item) =>
  Math.round((quantidadeParaNumero(i.quantidade) ?? 0) * (moedaParaNumero(i.valor) ?? 0) * 100) / 100

/** "Rua X, 10 - Centro - Cidade/UF" com o que o cadastro do cliente tiver. */
const enderecoDo = (c: Cliente) => {
  const rua = [c.logradouro, c.numeroEndereco, c.complemento].filter(Boolean).join(', ')
  const cidade = [c.cidade, c.uf].filter(Boolean).join('/')
  return [rua, c.bairro, cidade].filter(Boolean).join(' - ')
}

const hora = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

let proximaChave = 1

// Caixa (PDV): lê ou busca o produto, mostra a foto e os dados dele, soma o total ao vivo e gera o cupom
// (que dá baixa no estoque). A Qtd é a do produto selecionado: total do item = Qtd × valor unitário.
// Atalhos: Enter adiciona o produto, F4 gera o cupom.
export default function CupomFormPage() {
  const { sessao } = useErp()
  const navigate = useNavigate()
  const sessaoExpirada = useSessaoExpirada()
  const podeEmitir = podeAcessar(sessao.usuario, MODULO)
  const podeVerClientes = podeAcessar(sessao.usuario, CLIENTES)
  const clienteDaUrl = useSearchParams()[0].get('cliente')

  const [relogio, setRelogio] = useState(hora)
  const [proximoNumero, setProximoNumero] = useState<number | null>(null)
  const [equipe, setEquipe] = useState<Usuario[]>([])
  const [vendedorId, setVendedorId] = useState(sessao.usuario.id)

  // Cliente (opcional)
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [clienteNome, setClienteNome] = useState('')
  const [sugestoesClientes, setSugestoesClientes] = useState<Cliente[]>([])

  // Produto e itens
  const [codigo, setCodigo] = useState('')
  const [resultados, setResultados] = useState<Produto[] | null>(null)
  const [itens, setItens] = useState<Item[]>([])
  const [selecionado, setSelecionado] = useState<number | null>(null)

  // Pagamento
  const [forma1, setForma1] = useState<FormaPagamento>('dinheiro')
  const [valor1, setValor1] = useState('')
  const [forma2, setForma2] = useState<FormaPagamento | ''>('')
  const [valor2, setValor2] = useState('')
  const [observacao, setObservacao] = useState('')

  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const gerarRef = useRef<() => void>(() => {})

  // Relógio do caixa
  useEffect(() => {
    const id = window.setInterval(() => setRelogio(hora()), 15_000)
    return () => window.clearInterval(id)
  }, [])

  // Nº que a venda deve receber (o último + 1) e a equipe (para escolher o vendedor)
  useEffect(() => {
    if (!podeEmitir) return
    let ativo = true
    listarCupons(sessao.token, '', 1)
      .then((l) => ativo && setProximoNumero((l.itens[0]?.numero ?? 0) + 1))
      .catch((e) => ativo && sessaoExpirada(e))
    if (sessao.usuario.administrador)
      listarUsuarios(sessao.token)
        .then((u) => ativo && setEquipe(u.filter((x) => x.ativo)))
        .catch(() => {})
    return () => {
      ativo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessao.token, podeEmitir])

  // Venda aberta pelo histórico do cliente: já começa com ele
  useEffect(() => {
    if (!clienteDaUrl || !podeVerClientes) return
    let ativo = true
    obterCliente(sessao.token, clienteDaUrl)
      .then((c) => {
        if (!ativo) return
        setCliente(c)
        setClienteNome(c.nome)
      })
      .catch((e) => ativo && sessaoExpirada(e))
    return () => {
      ativo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteDaUrl, sessao.token])

  // Sugestões de clientes do cadastro enquanto digita o nome
  useEffect(() => {
    const termo = clienteNome.trim()
    if (cliente || termo.length < 2 || !podeVerClientes) {
      setSugestoesClientes([])
      return
    }
    let ativo = true
    const id = window.setTimeout(() => {
      listarClientes(sessao.token, termo, 1)
        .then((l) => ativo && setSugestoesClientes(l.itens.slice(0, 6)))
        .catch((e) => ativo && sessaoExpirada(e))
    }, 300)
    return () => {
      ativo = false
      window.clearTimeout(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteNome, cliente, sessao.token])

  // Produtos enquanto digita no campo do código (nome, código ou código de barras)
  useEffect(() => {
    const termo = codigo.trim()
    if (!termo) {
      setResultados(null)
      return
    }
    let ativo = true
    const id = window.setTimeout(() => {
      listarProdutos(sessao.token, termo, 1)
        .then((l) => ativo && setResultados(l.itens.slice(0, 8)))
        .catch((e) => ativo && !sessaoExpirada(e) && setErro(mensagemDe(e)))
    }, 250)
    return () => {
      ativo = false
      window.clearTimeout(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigo, sessao.token])

  /** Cliente com CNPJ: os produtos entram com o preço de venda PJ (quando tiver). */
  const pessoaJuridica = (cliente?.documento ?? '').length === 14

  const adicionarProduto = (p: Produto) => {
    const quantidade = 1
    const preco = pessoaJuridica && p.precoVendaPj > 0 ? p.precoVendaPj : p.precoVendaPf
    const existente = itens.find((i) => i.produtoId === p.id)
    if (existente) {
      // O mesmo produto de novo: soma na quantidade
      const nova = (quantidadeParaNumero(existente.quantidade) ?? 0) + quantidade
      setItens((atual) =>
        atual.map((i) => (i === existente ? { ...i, quantidade: mascaraQuantidade(formatarQuantidade(nova)) } : i)),
      )
      setSelecionado(existente.chave)
    } else {
      const chave = proximaChave++
      setItens((atual) => [
        ...atual,
        {
          chave,
          produtoId: p.id,
          descricao: p.nome,
          detalhe: [p.marca, p.modelo].filter(Boolean).join(' · ') || null,
          codigo: p.codigo,
          codigoBarras: p.codigoBarras,
          imagem: p.imagens[0] ?? null,
          estoque: p.quantidade,
          quantidade: mascaraQuantidade(formatarQuantidade(quantidade)),
          valor: preco > 0 ? formatarMoeda(preco) : '',
        },
      ])
      setSelecionado(chave)
    }
    setCodigo('')
    setResultados(null)
    setErro(null)
    document.getElementById('pdv-codigo')?.focus()
  }

  const mudarItem = (chave: number, mudanca: Partial<Item>) => {
    setItens((atual) => atual.map((i) => (i.chave === chave ? { ...i, ...mudanca } : i)))
    setErro(null)
  }

  const tirarItem = (chave: number) => {
    setItens((atual) => atual.filter((i) => i.chave !== chave))
    if (selecionado === chave) setSelecionado(null)
  }

  /** Código lido ou digitado + Enter: o produto com esse código (de barras ou interno) entra na venda. */
  const adicionarPorCodigo = async (texto: string) => {
    const termo = texto.trim()
    if (!termo) return
    try {
      const l = await listarProdutos(sessao.token, termo, 1)
      const exato = l.itens.find((p) => p.codigoBarras === termo || p.codigo?.toLowerCase() === termo.toLowerCase())
      const unico = l.itens.length === 1 ? l.itens[0] : undefined
      if (exato ?? unico) adicionarProduto((exato ?? unico)!)
      else if (l.itens.length === 0) setErro(`Nenhum produto com "${termo}".`)
      else setResultados(l.itens.slice(0, 8))
    } catch (e) {
      if (!sessaoExpirada(e)) setErro(mensagemDe(e))
    }
  }

  // Leitor de código de barras em qualquer lugar da tela
  useLeitorCodigoBarras('pdv-codigo', ({ codigo: lido, idAlvo, valorAntes }) => {
    // Se o cursor estava num campo de item, os números foram digitados nele: volta ao que era antes
    const alvo = idAlvo?.match(/^pdv-item-(\d+)-(quantidade|valor)$/)
    if (alvo && valorAntes !== null) mudarItem(Number(alvo[1]), { [alvo[2]]: valorAntes })
    if (idAlvo === 'pdv-qtd' && valorAntes !== null && atual) mudarItem(atual.chave, { quantidade: valorAntes })
    setCodigo('')
    void adicionarPorCodigo(lido)
  })

  const teclaCodigo = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') setResultados(null)
    if (e.key !== 'Enter') return
    e.preventDefault()
    void adicionarPorCodigo(codigo)
  }

  const escolherCliente = (c: Cliente) => {
    setCliente(c)
    setClienteNome(c.nome)
    setSugestoesClientes([])
  }

  // ---------- Valores ----------
  const totalLiquido = Math.round(itens.reduce((soma, i) => soma + totalDoItem(i), 0) * 100) / 100
  const pago2 = forma2 ? (moedaParaNumero(valor2) ?? 0) : 0
  const pago1 = moedaParaNumero(valor1) ?? Math.max(0, totalLiquido - pago2)
  const totalPago = Math.round((pago1 + pago2) * 100) / 100
  const troco = Math.max(0, Math.round((totalPago - totalLiquido) * 100) / 100)

  const atual = itens.find((i) => i.chave === selecionado) ?? itens[itens.length - 1] ?? null

  const conferir = (): string | null => {
    if (itens.length === 0) return 'Adicione pelo menos um produto.'
    const indice = itens.findIndex((i) => !(quantidadeParaNumero(i.quantidade) ?? 0))
    if (indice >= 0) return `${itens[indice].descricao}: digite a quantidade.`
    if (forma2 && !pago2) return 'Digite o valor da 2ª forma de pagamento.'
    if (totalPago < totalLiquido) return 'O valor pago é menor que o total.'
    if (troco > 0 && forma1 !== 'dinheiro' && forma2 !== 'dinheiro') return 'Troco só em dinheiro: o valor pago passou do total.'
    return null
  }

  const gerarCupom = async () => {
    if (salvando) return
    const problema = conferir()
    if (problema) {
      setErro(problema)
      return
    }
    setSalvando(true)
    setErro(null)
    try {
      const cupom = await emitirCupom(sessao.token, {
        clienteId: cliente?.id ?? null,
        clienteNome: clienteNome.trim() || null,
        clienteDocumento: cliente?.documento ? normalizarCnpj(cliente.documento) : null,
        clienteEndereco: cliente ? enderecoDo(cliente) || null : null,
        itens: itens.map((i) => ({
          produtoId: i.produtoId,
          descricao: null,
          quantidade: quantidadeParaNumero(i.quantidade) ?? 0,
          valorUnitario: moedaParaNumero(i.valor) ?? 0,
        })),
        valor: null,
        desconto: null,
        formaPagamento: forma1,
        valorRecebido: null,
        valorPagamento1: moedaParaNumero(valor1),
        formaPagamento2: forma2 || null,
        valorPagamento2: forma2 ? pago2 : null,
        vendedorId,
        referente: null,
        observacao: observacao.trim() || null,
      })
      avisarSalvo('Cupom gerado com sucesso', `Nº ${numeroCupom(cupom.numero)} · estoque atualizado`)
      navigate(`/app/cupom-fiscal/${cupom.id}`)
    } catch (e) {
      if (sessaoExpirada(e)) return
      setErro(e instanceof ErroApi ? e.message : mensagemDe(e))
      setSalvando(false)
    }
  }
  gerarRef.current = () => void gerarCupom()

  // Atalho do caixa: F4 gera o cupom
  useEffect(() => {
    const tecla = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'F4') {
        e.preventDefault()
        gerarRef.current()
      }
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [])

  if (!podeEmitir) {
    return (
      <div className="erp-pagina">
        <CabecalhoModulo modulo={MODULO} />
        <SemAcesso />
      </div>
    )
  }

  const hoje = new Date().toLocaleDateString('pt-BR')

  return (
    <div className="pdv tema-cupom">
      {/* Barra do caixa: situação, dica e relógio */}
      <header className="pdv-topo">
        <Link to="/app/cupom-fiscal" className="pdv-voltar" aria-label="Voltar para Cupons e recibos">
          <IconeVoltar tamanho={18} />
        </Link>
        <p className="pdv-situacao">
          <strong>{itens.length > 0 ? 'Venda em andamento' : 'Caixa livre'}</strong>
          <span> · Escaneie ou digite o nome do produto · F4 gera o cupom</span>
        </p>
        <time className="pdv-relogio">{relogio}</time>
      </header>

      {/* Dados da venda */}
      <div className="pdv-dados">
        <p className="pdv-dado">
          <span>Nº venda</span>
          <strong>{proximoNumero ? numeroCupom(proximoNumero) : '—'}</strong>
        </p>
        <p className="pdv-dado">
          <span>Data venda</span>
          <strong>{hoje}</strong>
        </p>
        <div className="pdv-dado pdv-cliente">
          <label htmlFor="pdv-cliente">Cliente</label>
          <input
            id="pdv-cliente"
            value={clienteNome}
            placeholder={podeVerClientes ? 'Consumidor (digite para buscar)' : 'Consumidor'}
            autoComplete="off"
            onChange={(e) => {
              setClienteNome(e.target.value)
              if (cliente) setCliente(null)
            }}
          />
          {cliente && (
            <span className="pdv-cliente-info">
              {[cliente.documento && formatarDocumento(cliente.documento), formatarTelefone(cliente.celular)]
                .filter(Boolean)
                .join(' · ')}
              {pessoaJuridica && ' · preço PJ'}
            </span>
          )}
          {sugestoesClientes.length > 0 && (
            <ul className="pdv-sugestoes" aria-label="Clientes encontrados">
              {sugestoesClientes.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => escolherCliente(c)}>
                    <strong>{c.nome}</strong>
                    <span>
                      {[formatarTelefone(c.celular), c.documento && formatarDocumento(c.documento)].filter(Boolean).join(' · ')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="pdv-dado">
          <label htmlFor="pdv-vendedor">Vendedor</label>
          <select id="pdv-vendedor" value={vendedorId} onChange={(e) => setVendedorId(e.target.value)}>
            {(equipe.length ? equipe : [sessao.usuario]).map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="pdv-corpo">
        {/* ---------- Esquerda: produto atual, leitura e pagamento ---------- */}
        <section className="pdv-esquerda" aria-label="Produto e pagamento">
          <div className="pdv-atual">
            <div className="pdv-qtd">
              <label htmlFor="pdv-qtd">Qtd</label>
              <input
                id="pdv-qtd"
                inputMode="decimal"
                title={atual ? `Quantidade de ${atual.descricao}` : 'Adicione um produto'}
                placeholder="1"
                disabled={!atual}
                value={atual?.quantidade ?? ''}
                onChange={(e) => atual && mudarItem(atual.chave, { quantidade: mascaraQuantidade(e.target.value) })}
                onFocus={(e) => e.target.select()}
              />
            </div>
            <div className="pdv-descricao">
              <span>Descrição</span>
              <p>{atual ? atual.descricao : 'Aguardando produto...'}</p>
            </div>
          </div>

          <div className="pdv-campo pdv-codigo">
            <label htmlFor="pdv-codigo">Código de barras</label>
            <input
              id="pdv-codigo"
              type="search"
              value={codigo}
              placeholder="Escaneie ou digite o nome do produto"
              autoComplete="off"
              autoFocus
              onChange={(e) => setCodigo(e.target.value)}
              onKeyDown={teclaCodigo}
            />
            {resultados && (
              <ul className="pdv-sugestoes" aria-label="Produtos encontrados">
                {resultados.length === 0 && <li className="pdv-sugestao-vazia">Nenhum produto encontrado</li>}
                {resultados.map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => adicionarProduto(p)}>
                      {p.imagens[0] ? (
                        <img src={urlImagemProduto(p.imagens[0])} alt="" />
                      ) : (
                        <span className="pdv-sugestao-sem-foto" aria-hidden="true">📦</span>
                      )}
                      <span className="pdv-sugestao-textos">
                        <strong>{p.nome}</strong>
                        <span>
                          {[p.codigo, p.codigoBarras, `Estoque: ${formatarQuantidade(p.quantidade)}`]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </span>
                      <span className="pdv-sugestao-preco">
                        {formatarMoeda(pessoaJuridica && p.precoVendaPj > 0 ? p.precoVendaPj : p.precoVendaPf)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="pdv-leitura">
            <div className="pdv-foto">
              {atual?.imagem ? (
                <img src={urlImagemProduto(atual.imagem)} alt={`Foto de ${atual.descricao}`} />
              ) : (
                <IlustracaoProdutos tamanho={120} />
              )}
            </div>
            <div className="pdv-campos">
              <div className="pdv-campo">
                <span className="pdv-rotulo">Valor unitário</span>
                <p className="pdv-valor-unitario">{atual ? formatarMoeda(moedaParaNumero(atual.valor) ?? 0) : 'R$ 0,00'}</p>
                {/* Qtd × valor unitário do produto selecionado */}
                <p className="pdv-total-item">
                  {atual
                    ? `${atual.quantidade || '0'} × ${formatarMoeda(moedaParaNumero(atual.valor) ?? 0)} = ${formatarMoeda(totalDoItem(atual))}`
                    : 'Qtd × valor unitário = total do item'}
                </p>
              </div>
            </div>
          </div>

          <div className="pdv-pagamentos">
            <label htmlFor="pdv-forma1">Forma pgto (1)</label>
            <select id="pdv-forma1" value={forma1} onChange={(e) => setForma1(e.target.value as FormaPagamento)}>
              {FORMAS_PAGAMENTO.map((f) => (
                <option key={f.valor} value={f.valor}>
                  {f.rotulo}
                </option>
              ))}
            </select>
            <input
              aria-label="Valor da forma de pagamento 1"
              inputMode="numeric"
              placeholder={formatarMoeda(Math.max(0, totalLiquido - pago2))}
              value={valor1}
              onChange={(e) => setValor1(mascaraMoeda(e.target.value))}
            />

            <label htmlFor="pdv-forma2">Forma pgto (2)</label>
            <select
              id="pdv-forma2"
              value={forma2}
              onChange={(e) => {
                setForma2(e.target.value as FormaPagamento | '')
                if (!e.target.value) setValor2('')
              }}
            >
              <option value="">— Nenhuma —</option>
              {FORMAS_PAGAMENTO.map((f) => (
                <option key={f.valor} value={f.valor}>
                  {f.rotulo}
                </option>
              ))}
            </select>
            <input
              aria-label="Valor da forma de pagamento 2"
              inputMode="numeric"
              placeholder="R$ 0,00"
              disabled={!forma2}
              value={valor2}
              onChange={(e) => setValor2(mascaraMoeda(e.target.value))}
            />
          </div>

          <div className="pdv-dado pdv-observacao">
            <label htmlFor="pdv-observacao">Observação (sai no cupom)</label>
            <input
              id="pdv-observacao"
              value={observacao}
              maxLength={1000}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </div>
        </section>

        {/* ---------- Direita: itens da venda e totais ---------- */}
        <section className="pdv-direita" aria-label="Itens da venda">
          <div className="pdv-grade">
            <table className="pdv-itens">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Código</th>
                  <th scope="col">Cód. barras</th>
                  <th scope="col">Descrição</th>
                  <th scope="col" className="numero">Qtde</th>
                  <th scope="col" className="numero">Pr. unitário</th>
                  <th scope="col" className="numero">Total</th>
                  <th scope="col">
                    <span className="sr-only">Tirar</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {itens.map((item, indice) => (
                  <tr
                    key={item.chave}
                    className={item.chave === atual?.chave ? 'selecionado' : undefined}
                    onClick={() => setSelecionado(item.chave)}
                  >
                    <td className="pdv-item-numero">{indice + 1}</td>
                    <td>{item.codigo ?? '—'}</td>
                    <td className="pdv-item-barras">{item.codigoBarras ?? '—'}</td>
                    <td className="pdv-item-descricao">
                      <strong>{item.descricao}</strong>
                      {(item.detalhe || item.estoque !== null) && (
                        <span>
                          {[item.detalhe, item.estoque !== null && `Estoque: ${formatarQuantidade(item.estoque)}`]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      )}
                    </td>
                    <td className="numero">
                      <input
                        id={`pdv-item-${item.chave}-quantidade`}
                        aria-label={`Quantidade do item ${indice + 1}`}
                        className="pdv-item-qtd"
                        inputMode="decimal"
                        value={item.quantidade}
                        onChange={(e) => mudarItem(item.chave, { quantidade: mascaraQuantidade(e.target.value) })}
                      />
                    </td>
                    <td className="numero">
                      <input
                        id={`pdv-item-${item.chave}-valor`}
                        aria-label={`Preço unitário do item ${indice + 1}`}
                        className="pdv-item-valor"
                        inputMode="numeric"
                        placeholder="R$ 0,00"
                        value={item.valor}
                        onChange={(e) => mudarItem(item.chave, { valor: mascaraMoeda(e.target.value) })}
                      />
                    </td>
                    <td className="numero pdv-item-total">{formatarMoeda(totalDoItem(item))}</td>
                    <td>
                      <button
                        type="button"
                        className="pdv-item-tirar"
                        aria-label={`Tirar ${item.descricao || `item ${indice + 1}`}`}
                        title="Tirar da venda"
                        onClick={(e) => {
                          e.stopPropagation()
                          tirarItem(item.chave)
                        }}
                      >
                        <IconeLixeira tamanho={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {itens.length === 0 && (
              <div className="pdv-grade-vazia">
                <span aria-hidden="true">🛒</span>
                <p>Os produtos da venda aparecem aqui.</p>
              </div>
            )}
          </div>

          <div className="pdv-total-liquido">
            <span>Total líquido</span>
            <strong>{formatarMoeda(totalLiquido)}</strong>
          </div>
          <div className="pdv-pago-troco">
            <p>
              <span>Total pago</span>
              <strong>{formatarMoeda(itens.length ? totalPago : 0)}</strong>
            </p>
            <p className={troco > 0 ? 'pdv-troco tem' : 'pdv-troco'}>
              <span>Troco</span>
              <strong>{formatarMoeda(troco)}</strong>
            </p>
          </div>

          {erro && (
            <p className="pdv-erro" role="alert">
              {erro}
            </p>
          )}

          <div className="pdv-botoes">
            <button type="button" className="pdv-botao gerar" onClick={() => void gerarCupom()} disabled={salvando}>
              <IconeCheck tamanho={22} />
              {salvando ? 'Gerando...' : 'Gerar cupom'}
            </button>
            <button
              type="button"
              className="pdv-botao sair"
              onClick={() => {
                if (itens.length === 0 || window.confirm('Sair do caixa? Os itens desta venda serão apagados.'))
                  navigate('/app/cupom-fiscal')
              }}
            >
              Sair
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
