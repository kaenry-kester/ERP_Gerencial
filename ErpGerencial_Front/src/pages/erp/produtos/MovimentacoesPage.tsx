import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Aviso } from '../../../components/formulario/FaixaAviso'
import { IlustracaoProdutos } from '../../../components/icones/Ilustracoes'
import { useSessaoExpirada } from '../../../hooks/useSessaoExpirada'
import { listarMovimentos, mensagemDe, type ListaMovimentos } from '../../../services/api'
import AvisoPagina from '../AvisoPagina'
import FaixaPagina from '../FaixaPagina'
import { useErp } from '../contexto'
import { tem } from '../modulos'
import SemAcesso from '../SemAcesso'
import { TIPOS_MOVIMENTO } from './movimentos'
import TabelaMovimentos from './TabelaMovimentos'
import './estoque.css'

// Todas as movimentações de estoque da empresa, com filtro por tipo e período.
export default function MovimentacoesPage() {
  const { sessao } = useErp()
  const sessaoExpirada = useSessaoExpirada()
  const [params] = useSearchParams()
  const [tipo, setTipo] = useState(params.get('tipo') ?? '')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [pagina, setPagina] = useState(1)
  const [lista, setLista] = useState<ListaMovimentos | null>(null)
  const [aviso, setAviso] = useState<Aviso>(null)
  const podeVer = tem(sessao.usuario, 'produtos')

  useEffect(() => {
    if (!podeVer) return
    let ativo = true
    listarMovimentos(sessao.token, { tipo: tipo || undefined, de: de || undefined, ate: ate || undefined, pagina })
      .then((l) => ativo && setLista(l))
      .catch((e) => ativo && !sessaoExpirada(e) && setAviso({ tipo: 'erro', texto: mensagemDe(e) }))
    return () => {
      ativo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessao.token, podeVer, tipo, de, ate, pagina])

  if (!podeVer) return <div className="erp-pagina"><SemAcesso /></div>

  const paginas = lista ? Math.max(1, Math.ceil(lista.total / lista.tamanhoPagina)) : 1

  return (
    <div className="pagina tema-produtos">
      <FaixaPagina
        Ilustracao={IlustracaoProdutos}
        titulo="Movimentações de estoque"
        subtitulo="Tudo o que entrou e saiu: vendas, cancelamentos e ajustes."
        voltar={{ para: '/app/produtos', rotulo: 'Produtos' }}
      />
      <div className="estoque-atalhos" role="group" aria-label="Filtros">
        <label className="estoque-filtro">
          <span className="sr-only">Tipo</span>
          <select
            value={tipo}
            onChange={(e) => {
              setTipo(e.target.value)
              setPagina(1)
            }}
          >
            <option value="">Todos os tipos</option>
            {Object.entries(TIPOS_MOVIMENTO).map(([valor, t]) => (
              <option key={valor} value={valor}>
                {t.emoji} {t.rotulo}
              </option>
            ))}
          </select>
        </label>
        <label className="estoque-filtro">
          <span className="sr-only">De</span>
          <input
            type="date"
            value={de}
            onChange={(e) => {
              setDe(e.target.value)
              setPagina(1)
            }}
            style={{ minHeight: 46, border: 'none', borderRadius: 999, padding: '0 0.9rem', font: 'inherit' }}
          />
        </label>
        <label className="estoque-filtro">
          <span className="sr-only">Até</span>
          <input
            type="date"
            value={ate}
            onChange={(e) => {
              setAte(e.target.value)
              setPagina(1)
            }}
            style={{ minHeight: 46, border: 'none', borderRadius: 999, padding: '0 0.9rem', font: 'inherit' }}
          />
        </label>
        {lista && (
          <p className="lista-contagem" style={{ marginLeft: 'auto', alignSelf: 'center' }}>
            <strong>{lista.total}</strong> {lista.total === 1 ? 'movimentação' : 'movimentações'}
          </p>
        )}
      </div>
      <div className="pagina-corpo estoque-corpo">
        {aviso && <AvisoPagina aviso={aviso} />}
        {!lista && !aviso && <p className="erp-carregando">Carregando...</p>}
        {lista?.itens.length === 0 && <p className="estoque-dica">Nenhuma movimentação neste filtro.</p>}
        {lista && lista.itens.length > 0 && (
          <section className="estoque-cartao" aria-label="Movimentações">
            <TabelaMovimentos itens={lista.itens} />
          </section>
        )}
        {lista && paginas > 1 && (
          <nav className="lista-paginas" aria-label="Páginas">
            <span>
              Página {pagina} de {paginas}
            </span>
            <button type="button" className="pagina-botao neutro" disabled={pagina <= 1} onClick={() => setPagina((n) => n - 1)}>
              Anterior
            </button>
            <button type="button" className="pagina-botao neutro" disabled={pagina >= paginas} onClick={() => setPagina((n) => n + 1)}>
              Próxima
            </button>
          </nav>
        )}
      </div>
    </div>
  )
}
