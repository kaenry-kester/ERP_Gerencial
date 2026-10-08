import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import type { Aviso } from '../../../components/formulario/FaixaAviso'
import { IconeLapis, IconeLixeira, IconeVoltar } from '../../../components/icones/Icones'
import { IlustracaoProdutos } from '../../../components/icones/Ilustracoes'
import { useSessaoExpirada } from '../../../hooks/useSessaoExpirada'
import { excluirProduto, mensagemDe, obterProduto, type Produto } from '../../../services/api'
import { formatarMoeda, formatarQuantidade } from '../../../utils/validacao'
import AvisoPagina from '../AvisoPagina'
import { useErp } from '../contexto'
import { tem } from '../modulos'
import SemAcesso from '../SemAcesso'
import FaixaPagina from '../FaixaPagina'

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

  const podeVer = tem(sessao.usuario, 'produtos')
  const podeEditar = tem(sessao.usuario, 'produtos-editar')

  useEffect(() => {
    if (!podeVer) return
    let ativo = true
    obterProduto(sessao.token, id!)
      .then((p) => ativo && setProduto(p))
      .catch((e) => ativo && !sessaoExpirada(e) && setAviso({ tipo: 'erro', texto: mensagemDe(e) }))
    return () => {
      ativo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, sessao.token, podeVer])

  if (!podeVer) return <div className="erp-pagina"><SemAcesso /></div>

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
      titulo: 'Preços',
      itens: [
        ['Custo', formatarMoeda(produto.precoCusto)],
        ['Venda pessoa física', formatarMoeda(produto.precoVendaPf)],
        ['Venda pessoa jurídica', formatarMoeda(produto.precoVendaPj)],
      ],
    },
    { titulo: 'Estoque', itens: [['Quantidade', formatarQuantidade(produto.quantidade)]] },
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
