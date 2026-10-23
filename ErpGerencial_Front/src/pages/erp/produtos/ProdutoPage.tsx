import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import type { Aviso } from '../../../components/formulario/FaixaAviso'
import { IconeLapis, IconeLixeira, IconeVoltar } from '../../../components/icones/Icones'
import { IlustracaoProdutos } from '../../../components/icones/Ilustracoes'
import { useSessaoExpirada } from '../../../hooks/useSessaoExpirada'
import { avisarSalvo } from '../../../components/aviso-salvo/avisarSalvo'
import CampoTexto from '../../../components/formulario/CampoTexto'
import {
  ajustarEstoque,
  excluirProduto,
  listarMovimentos,
  mensagemDe,
  obterProduto,
  urlImagemProduto,
  type MovimentoEstoque,
  type Produto,
} from '../../../services/api'
import { formatarMoeda, formatarQuantidade, mascaraQuantidadeComSinal, quantidadeParaNumero } from '../../../utils/validacao'
import AvisoPagina from '../AvisoPagina'
import { useErp } from '../contexto'
import { tem } from '../modulos'
import SemAcesso from '../SemAcesso'
import FaixaPagina from '../FaixaPagina'
import TabelaMovimentos from './TabelaMovimentos'
import './estoque.css'
import './imagens.css'
import '../../../styles/acesso.css'

const data = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

// Detalhes do produto: todas as informações. Quem pode editar vê "Editar" e "Excluir".
export default function ProdutoPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { sessao } = useErp()
  const sessaoExpirada = useSessaoExpirada()
  const [produto, setProduto] = useState<Produto | null>(null)
  const [aviso, setAviso] = useState<Aviso>((useLocation().state as { aviso?: Aviso } | null)?.aviso ?? null)
  const [confirmando, setConfirmando] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [movimentos, setMovimentos] = useState<MovimentoEstoque[] | null>(null)
  const [ajustando, setAjustando] = useState(false)
  const [novaQuantidade, setNovaQuantidade] = useState('')
  const [motivo, setMotivo] = useState('')
  const [erroAjuste, setErroAjuste] = useState<string>()

  const podeVer = tem(sessao.usuario, 'produtos')
  const podeEditar = tem(sessao.usuario, 'produtos-editar')

  useEffect(() => {
    if (!podeVer) return
    let ativo = true
    obterProduto(sessao.token, id!)
      .then((p) => ativo && setProduto(p))
      .catch((e) => ativo && !sessaoExpirada(e) && setAviso({ tipo: 'erro', texto: mensagemDe(e) }))
    listarMovimentos(sessao.token, { produtoId: id })
      .then((l) => ativo && setMovimentos(l.itens.slice(0, 20)))
      .catch(() => ativo && setMovimentos([]))
    return () => {
      ativo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, sessao.token, podeVer])

  if (!podeVer) return <div className="erp-pagina"><SemAcesso /></div>

  const confirmarAjuste = async () => {
    const quantidade = quantidadeParaNumero(novaQuantidade)
    if (quantidade === null) return setErroAjuste('Digite a quantidade contada')
    if (!motivo.trim()) return setErroAjuste('Diga o motivo (inventário, avaria, perda...)')
    try {
      await ajustarEstoque(sessao.token, id!, quantidade, motivo.trim())
      avisarSalvo('Estoque ajustado com sucesso', `Agora: ${formatarQuantidade(quantidade)}`)
      setAjustando(false)
      setNovaQuantidade('')
      setMotivo('')
      setErroAjuste(undefined)
      const [p, l] = await Promise.all([obterProduto(sessao.token, id!), listarMovimentos(sessao.token, { produtoId: id })])
      setProduto(p)
      setMovimentos(l.itens.slice(0, 20))
    } catch (e) {
      if (!sessaoExpirada(e)) setErroAjuste(mensagemDe(e))
    }
  }

  const excluir = async () => {
    setExcluindo(true)
    try {
      await excluirProduto(sessao.token, id!)
      navigate('/app/produtos', { replace: true, state: { aviso: { tipo: 'ok', texto: 'Produto excluído.' } } })
    } catch (erro) {
      if (sessaoExpirada(erro)) return
      setAviso({ tipo: 'erro', texto: mensagemDe(erro) })
      setExcluindo(false)
    }
  }

  const voltar = (
    <Link to="/app/produtos" className="erp-voltar">
      <IconeVoltar tamanho={18} />
      Produtos
    </Link>
  )

  if (!produto) {
    return (
      <div className="erp-pagina">
        {voltar}
        {aviso ? <AvisoPagina aviso={aviso} /> : <p className="erp-carregando">Carregando...</p>}
      </div>
    )
  }

  const grupos: { titulo: string; itens: [string, string][] }[] = [
    {
      titulo: 'Identificação',
      itens: [
        ['Código do produto', produto.codigo ?? '—'],
        ['Código de barras', produto.codigoBarras ?? '—'],
      ],
    },
    {
      titulo: 'Preços',
      itens: [
        ['Custo', formatarMoeda(produto.precoCusto)],
        ['Venda pessoa física', formatarMoeda(produto.precoVendaPf)],
        ['Venda pessoa jurídica', formatarMoeda(produto.precoVendaPj)],
      ],
    },
    {
      titulo: 'Estoque',
      itens: [
        ['Quantidade', `${formatarQuantidade(produto.quantidade)} ${produto.unidade}${produto.estoqueBaixo ? ' ⚠️ baixo' : ''}`],
      ],
    },
    {
      titulo: 'Características',
      itens: [
        ['Marca', produto.marca ?? '—'],
        ['Modelo', produto.modelo ?? '—'],
        ['Cor', produto.cor ?? '—'],
        ['Voltagem', produto.voltagem ?? '—'],
      ],
    },
  ]

  const acoes = podeEditar && (
    <>
      <Link to={`/app/produtos/${produto.id}/editar`} className="pagina-botao claro">
        <IconeLapis tamanho={20} />
        Editar
      </Link>
      {!confirmando ? (
        <button type="button" className="pagina-botao escuro" onClick={() => setConfirmando(true)}>
          <IconeLixeira tamanho={20} />
          Excluir
        </button>
      ) : (
        <>
          <button type="button" className="pagina-botao perigo" onClick={excluir} disabled={excluindo}>
            <IconeLixeira tamanho={20} />
            {excluindo ? 'Excluindo...' : 'Confirmar exclusão'}
          </button>
          <button type="button" className="pagina-botao escuro" onClick={() => setConfirmando(false)}>
            Cancelar
          </button>
        </>
      )}
    </>
  )

  return (
    <div className="pagina tema-produtos">
      <FaixaPagina
        Ilustracao={IlustracaoProdutos}
        titulo={produto.nome}
        subtitulo={`ID ${produto.numero}${produto.codigo ? ` · Código ${produto.codigo}` : ''}`}
        voltar={{ para: '/app/produtos', rotulo: 'Produtos' }}
        acoes={acoes || undefined}
      />

      <div className="pagina-corpo">
        {aviso && <AvisoPagina aviso={aviso} />}

        {produto.imagens.length > 0 && (
          <section className="detalhe-grupo" aria-label="Imagens">
            <h2 className="detalhe-titulo">Imagens</h2>
            <ul className="imagens-grade leitura">
              {produto.imagens.map((idImagem, i) => (
                <li key={idImagem} className={i === 0 ? 'imagens-item capa' : 'imagens-item'}>
                  <img src={urlImagemProduto(idImagem)} alt={i === 0 ? 'Capa do produto' : `Imagem ${i + 1}`} />
                  {i === 0 && <span className="imagens-capa">Capa</span>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {grupos.map((g) => (
          <section key={g.titulo} className="detalhe-grupo" aria-label={g.titulo}>
            <h2 className="detalhe-titulo">{g.titulo}</h2>
            <dl className="detalhe-dados">
              {g.itens.map(([rotulo, valor]) => (
                <div key={rotulo} className="detalhe-dado">
                  <dt>{rotulo}</dt>
                  <dd title={valor}>{valor}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}

        {/* Estoque: entrada, ajuste e o histórico deste produto */}
        <section className="detalhe-grupo" aria-label="Movimentações do estoque">
          <h2 className="detalhe-titulo">Movimentações do estoque</h2>
          {podeEditar && (
            <div className="estoque-linha-acoes">
              <button type="button" className="pagina-botao marinho" onClick={() => setAjustando((v) => !v)}>
                ✏️ Ajustar estoque
              </button>
            </div>
          )}
          {ajustando && (
            <div className="estoque-cartao" style={{ background: 'var(--pg-zebra)' }}>
              <p className="estoque-dica">
                Digite a quantidade que você contou. A diferença para o estoque de agora ({formatarQuantidade(produto.quantidade)}) fica registrada.
              </p>
              <div className="erp-form">
                <CampoTexto
                  id="ajuste-quantidade"
                  rotulo="Quantidade contada"
                  valor={novaQuantidade}
                  onChange={(v) => {
                    setNovaQuantidade(mascaraQuantidadeComSinal(v))
                    setErroAjuste(undefined)
                  }}
                />
                <CampoTexto
                  id="ajuste-motivo"
                  rotulo="Motivo (inventário, avaria, perda...)"
                  valor={motivo}
                  maxLength={300}
                  onChange={(v) => {
                    setMotivo(v)
                    setErroAjuste(undefined)
                  }}
                />
              </div>
              {erroAjuste && <p className="erp-aviso erro">{erroAjuste}</p>}
              <div className="estoque-linha-acoes">
                <button type="button" className="pagina-botao marinho" onClick={() => void confirmarAjuste()}>
                  Confirmar ajuste
                </button>
                <button type="button" className="pagina-botao neutro" onClick={() => setAjustando(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
          {movimentos === null && <p className="erp-carregando">Carregando...</p>}
          {movimentos?.length === 0 && <p className="detalhe-texto">Nenhuma movimentação ainda.</p>}
          {movimentos && movimentos.length > 0 && <TabelaMovimentos itens={movimentos} mostrarProduto={false} />}
        </section>

        <section className="detalhe-grupo" aria-label="Observação">
          <h2 className="detalhe-titulo">Observação</h2>
          <p className="detalhe-texto">{produto.observacao ?? '—'}</p>
        </section>

        <p className="erp-nota">
          Cadastrado em {data(produto.criadoEm)} · Atualizado em {data(produto.atualizadoEm)}
        </p>
      </div>
    </div>
  )
}
