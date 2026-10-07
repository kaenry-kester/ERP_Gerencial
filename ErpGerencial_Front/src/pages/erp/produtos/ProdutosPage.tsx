import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { Aviso } from '../../../components/formulario/FaixaAviso'
import { IconeMais, IconeSeta } from '../../../components/icones/Icones'
import { IlustracaoProdutos } from '../../../components/icones/Ilustracoes'
import { useSessaoExpirada } from '../../../hooks/useSessaoExpirada'
import { listarProdutos, mensagemDe, type ListaProdutos } from '../../../services/api'
import { formatarMoeda, formatarQuantidade } from '../../../utils/validacao'
import AvisoPagina from '../AvisoPagina'
import CabecalhoModulo from '../CabecalhoModulo'
import { useErp } from '../contexto'
import { MODULOS, podeAcessar, tem } from '../modulos'
import SemAcesso from '../SemAcesso'
import '../../../styles/acesso.css'
import './produtos.css'

const MODULO = MODULOS.find((m) => m.id === 'produtos')!

// Aba Produtos: lista de todos os produtos da empresa, com busca. Clicar abre os detalhes.
export default function ProdutosPage() {
  const { sessao } = useErp()
  const navigate = useNavigate()
  const sessaoExpirada = useSessaoExpirada()
  const [busca, setBusca] = useState('')
  const [buscaAplicada, setBuscaAplicada] = useState('')
  const [pagina, setPagina] = useState(1)
  const [lista, setLista] = useState<ListaProdutos | null>(null)
  const [aviso, setAviso] = useState<Aviso>((useLocation().state as { aviso?: Aviso } | null)?.aviso ?? null)
  const podeVer = podeAcessar(sessao.usuario, MODULO)

  // Busca enquanto digita, esperando a pessoa parar por um instante
  useEffect(() => {
    const id = window.setTimeout(() => {
      setBuscaAplicada(busca)
      setPagina(1)
    }, 350)
    return () => window.clearTimeout(id)
  }, [busca])

  useEffect(() => {
    if (!podeVer) return
    let ativo = true
    listarProdutos(sessao.token, buscaAplicada, pagina)
      .then((l) => ativo && setLista(l))
      .catch((e) => ativo && !sessaoExpirada(e) && setAviso({ tipo: 'erro', texto: mensagemDe(e) }))
    return () => {
      ativo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessao.token, buscaAplicada, pagina, podeVer])

  if (!podeVer) {
    return (
      <div className="erp-pagina">
        <CabecalhoModulo modulo={MODULO} />
        <SemAcesso />
      </div>
    )
  }

  const cadastrar = tem(sessao.usuario, 'produtos-cadastrar') && (
    <Link to="/app/produtos/novo" className="erp-cadastro-acao erp-cabecalho-acao tema-produtos">
      <IconeMais tamanho={20} />
      Cadastrar produto
    </Link>
  )

  const total = lista?.total ?? 0
  const inicio = lista && total > 0 ? (lista.pagina - 1) * lista.tamanhoPagina + 1 : 0
  const fim = lista ? inicio + lista.itens.length - 1 : 0
  const paginas = lista ? Math.max(1, Math.ceil(total / lista.tamanhoPagina)) : 1

  return (
    <div className="erp-pagina erp-pagina-larga">
      <CabecalhoModulo modulo={MODULO} acao={cadastrar || undefined} />

      <div className="produtos-barra">
        <div className="campo produtos-busca">
          <label htmlFor="produtos-busca" className="campo-rotulo">
            Buscar
          </label>
          <input
            id="produtos-busca"
            type="search"
            placeholder="Nome, código, marca ou modelo"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        {lista && (
          <p className="produtos-contagem" role="status">
            {total === 0 ? 'Nenhum produto' : `${total} ${total === 1 ? 'produto' : 'produtos'}`}
          </p>
        )}
      </div>

      {aviso && <AvisoPagina aviso={aviso} />}
      {!lista && !aviso && <p className="erp-carregando">Carregando...</p>}

      {lista && lista.itens.length === 0 && (
        <div className="erp-em-breve">
          <IlustracaoProdutos tamanho={120} />
          <div className="erp-em-breve-textos">
            <p className="erp-em-breve-titulo">{buscaAplicada ? 'Nada encontrado' : 'Nenhum produto ainda'}</p>
            <p className="erp-em-breve-texto">
              {buscaAplicada ? 'Tente outro termo de busca.' : 'Os produtos cadastrados aparecem aqui.'}
            </p>
          </div>
        </div>
      )}

      {lista && lista.itens.length > 0 && (
        <>
          <table className="produtos-tabela">
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Produto</th>
                <th scope="col" className="col-codigo">Código</th>
                <th scope="col" className="col-marca">Marca · Modelo</th>
                <th scope="col" className="numero">Venda PF</th>
                <th scope="col" className="numero col-pj">Venda PJ</th>
                <th scope="col" className="numero">Qtd.</th>
                <th scope="col">
                  <span className="sr-only">Abrir</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {lista.itens.map((p) => (
                // A linha inteira abre o produto; o link no nome é o acesso pelo teclado.
                <tr key={p.id} onClick={() => navigate(`/app/produtos/${p.id}`)}>
                  <td className="produtos-id">{p.numero}</td>
                  <td>
                    <Link to={`/app/produtos/${p.id}`} className="produtos-nome">
                      {p.nome}
                    </Link>
                  </td>
                  <td className="col-codigo">{p.codigo ?? '—'}</td>
                  <td className="col-marca">{[p.marca, p.modelo].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="numero">{formatarMoeda(p.precoVendaPf)}</td>
                  <td className="numero col-pj">{formatarMoeda(p.precoVendaPj)}</td>
                  <td className="numero">{formatarQuantidade(p.quantidade)}</td>
                  <td className="produtos-seta" aria-hidden="true">
                    <IconeSeta tamanho={18} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {paginas > 1 && (
            <nav className="produtos-paginas" aria-label="Páginas">
              <button
                type="button"
                className="ghost-button erp-botao"
                disabled={pagina <= 1}
                onClick={() => setPagina((n) => n - 1)}
              >
                Anterior
              </button>
              <span>
                {inicio}–{fim} de {total}
              </span>
              <button
                type="button"
                className="ghost-button erp-botao"
                disabled={pagina >= paginas}
                onClick={() => setPagina((n) => n + 1)}
              >
                Próxima
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  )
}
