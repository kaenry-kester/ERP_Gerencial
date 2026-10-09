import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { Aviso } from '../../../components/formulario/FaixaAviso'
import { IconeBusca, IconeMais } from '../../../components/icones/Icones'
import { IlustracaoProdutos } from '../../../components/icones/Ilustracoes'
import { useSessaoExpirada } from '../../../hooks/useSessaoExpirada'
import { listarProdutos, mensagemDe, type ListaProdutos } from '../../../services/api'
import { formatarMoeda, formatarQuantidade } from '../../../utils/validacao'
import AvisoPagina from '../AvisoPagina'
import CabecalhoModulo from '../CabecalhoModulo'
import FaixaPagina from '../FaixaPagina'
import { useErp } from '../contexto'
import { MODULOS, podeAcessar, tem } from '../modulos'
import SemAcesso from '../SemAcesso'

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
    <Link to="/app/produtos/novo" className="pagina-botao azul">
      <IconeMais tamanho={20} />
      Cadastrar produto
    </Link>
  )

  const total = lista?.total ?? 0
  const inicio = lista && total > 0 ? (lista.pagina - 1) * lista.tamanhoPagina + 1 : 0
  const fim = lista ? inicio + lista.itens.length - 1 : 0
  const paginas = lista ? Math.max(1, Math.ceil(total / lista.tamanhoPagina)) : 1

  return (
    <div className="pagina tema-produtos">
      <FaixaPagina
        Ilustracao={IlustracaoProdutos}
        titulo="Produtos"
        subtitulo={MODULO.descricao}
        acoes={cadastrar || undefined}
      />

      <div className="lista-ferramentas">
        <div className="lista-busca">
          <label htmlFor="produtos-busca" className="sr-only">
            Buscar produto
          </label>
          <IconeBusca tamanho={20} />
          <input
            id="produtos-busca"
            type="search"
            placeholder="Nome, código, marca ou modelo"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        {lista && (
          <p className="lista-contagem" role="status">
            <strong>{total}</strong> {total === 1 ? 'produto' : 'produtos'}
          </p>
        )}
      </div>

      <div className="lista-corpo">
        {aviso && <AvisoPagina aviso={aviso} />}
        {!lista && !aviso && <p className="erp-carregando">Carregando...</p>}

        {lista && lista.itens.length === 0 && (
          <div className="lista-vazio">
            <IlustracaoProdutos tamanho={96} />
            <div>
              <p className="lista-vazio-titulo">{buscaAplicada ? 'Nada encontrado' : 'Nenhum produto ainda'}</p>
              <p className="lista-vazio-texto">
                {buscaAplicada ? 'Tente outro termo de busca.' : 'Os produtos cadastrados aparecem aqui.'}
              </p>
            </div>
          </div>
        )}

        {lista && lista.itens.length > 0 && (
          <>
            {/* Cor, voltagem e observação aparecem só nos detalhes; em telas estreitas cada linha vira um cartão */}
            <div className="lista-tabela-area">
              <table className="lista-tabela">
                <thead>
                  <tr>
                    <th scope="col" className="lista-id">ID</th>
                    <th scope="col">Produto</th>
                    <th scope="col">Código</th>
                    <th scope="col" className="numero">Custo</th>
                    <th scope="col" className="numero">Venda PF</th>
                    <th scope="col" className="numero">Venda PJ</th>
                    <th scope="col" className="numero">Qtd.</th>
                    <th scope="col">Marca</th>
                    <th scope="col">Modelo</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.itens.map((p) => (
                    // A linha inteira abre o produto; o link no nome é o acesso pelo teclado.
                    <tr key={p.id} onClick={() => navigate(`/app/produtos/${p.id}`)}>
                      <td className="lista-id" data-rotulo="ID">{p.numero}</td>
                      <td className="lista-principal quebra">
                        <Link to={`/app/produtos/${p.id}`} className="lista-nome">
                          {p.nome}
                        </Link>
                      </td>
                      <td data-rotulo="Código">{p.codigo ?? '—'}</td>
                      <td className="numero" data-rotulo="Custo">{formatarMoeda(p.precoCusto)}</td>
                      <td className="numero lista-destaque" data-rotulo="Venda PF">{formatarMoeda(p.precoVendaPf)}</td>
                      <td className="numero lista-destaque" data-rotulo="Venda PJ">{formatarMoeda(p.precoVendaPj)}</td>
                      <td className="numero" data-rotulo="Qtd.">
                        <span
                          className={p.quantidade > 0 ? 'lista-etiqueta' : 'lista-etiqueta alerta'}
                          title={p.quantidade > 0 ? undefined : 'Sem estoque'}
                        >
                          {formatarQuantidade(p.quantidade)}
                        </span>
                      </td>
                      <td className="quebra" data-rotulo="Marca">{p.marca ?? '—'}</td>
                      <td className="quebra" data-rotulo="Modelo">{p.modelo ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {paginas > 1 && (
              <nav className="lista-paginas" aria-label="Páginas">
                <span>
                  {inicio}–{fim} de {total}
                </span>
                <button
                  type="button"
                  className="pagina-botao neutro"
                  disabled={pagina <= 1}
                  onClick={() => setPagina((n) => n - 1)}
                >
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
          </>
        )}
      </div>
    </div>
  )
}
