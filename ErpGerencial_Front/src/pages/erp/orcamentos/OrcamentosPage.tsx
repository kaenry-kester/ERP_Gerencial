import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Aviso } from '../../../components/formulario/FaixaAviso'
import { IconeBusca, IconeMais } from '../../../components/icones/Icones'
import { IlustracaoOrcamento } from '../../../components/icones/Ilustracoes'
import { useSessaoExpirada } from '../../../hooks/useSessaoExpirada'
import { listarOrcamentos, mensagemDe, type ListaOrcamentos } from '../../../services/api'
import { formatarMoeda } from '../../../utils/validacao'
import AvisoPagina from '../AvisoPagina'
import CabecalhoModulo from '../CabecalhoModulo'
import FaixaPagina from '../FaixaPagina'
import { useErp } from '../contexto'
import { MODULOS, podeAcessar } from '../modulos'
import SemAcesso from '../SemAcesso'
import { numeroCupom } from '../cupons/numero'

const MODULO = MODULOS.find((m) => m.id === 'orcamento')!

const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

// Orçamentos, mais novos primeiro, com busca. Clicar abre o orçamento (editar, finalizar ou ver o cupom gerado).
export default function OrcamentosPage() {
  const { sessao } = useErp()
  const navigate = useNavigate()
  const sessaoExpirada = useSessaoExpirada()
  const [busca, setBusca] = useState('')
  const [buscaAplicada, setBuscaAplicada] = useState('')
  const [pagina, setPagina] = useState(1)
  const [lista, setLista] = useState<ListaOrcamentos | null>(null)
  const [aviso, setAviso] = useState<Aviso>(null)
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
    listarOrcamentos(sessao.token, buscaAplicada, pagina)
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

  const total = lista?.total ?? 0
  const inicio = lista && total > 0 ? (lista.pagina - 1) * lista.tamanhoPagina + 1 : 0
  const fim = lista ? inicio + lista.itens.length - 1 : 0
  const paginas = lista ? Math.max(1, Math.ceil(total / lista.tamanhoPagina)) : 1

  return (
    <div className="pagina tema-orcamento">
      <FaixaPagina
        Ilustracao={IlustracaoOrcamento}
        titulo={MODULO.rotulo}
        subtitulo={MODULO.descricao}
        acoes={
          <Link to="/app/orcamento/novo" className="pagina-botao marinho">
            <IconeMais tamanho={20} />
            Novo orçamento
          </Link>
        }
      />

      <div className="lista-ferramentas">
        <div className="lista-busca">
          <label htmlFor="orcamentos-busca" className="sr-only">
            Buscar orçamento
          </label>
          <IconeBusca tamanho={20} />
          <input
            id="orcamentos-busca"
            type="search"
            placeholder="Nº do orçamento, cliente ou serviço"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        {lista && (
          <p className="lista-contagem" role="status">
            <strong>{total}</strong> {total === 1 ? 'orçamento' : 'orçamentos'}
          </p>
        )}
      </div>

      <div className="lista-corpo">
        {aviso && <AvisoPagina aviso={aviso} />}
        {!lista && !aviso && <p className="erp-carregando">Carregando...</p>}

        {lista && lista.itens.length === 0 && (
          <div className="lista-vazio">
            <IlustracaoOrcamento tamanho={96} />
            <div>
              <p className="lista-vazio-titulo">{buscaAplicada ? 'Nada encontrado' : 'Nenhum orçamento ainda'}</p>
              <p className="lista-vazio-texto">
                {buscaAplicada ? 'Tente outro termo de busca.' : 'Clique em "Novo orçamento" para fazer o primeiro.'}
              </p>
            </div>
          </div>
        )}

        {lista && lista.itens.length > 0 && (
          <>
            <div className="lista-tabela-area">
              <table className="lista-tabela">
                <thead>
                  <tr>
                    <th scope="col" className="lista-id">Nº</th>
                    <th scope="col">Data</th>
                    <th scope="col">Cliente</th>
                    <th scope="col">Serviços</th>
                    <th scope="col" className="numero">Total</th>
                    <th scope="col">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.itens.map((o) => (
                    // A linha inteira abre o orçamento; o link no Nº é o acesso pelo teclado.
                    <tr key={o.id} onClick={() => navigate(`/app/orcamento/${o.id}`)}>
                      <td className="lista-id" data-rotulo="Nº">
                        <Link to={`/app/orcamento/${o.id}`} className="lista-nome">
                          {numeroCupom(o.numero)}
                        </Link>
                      </td>
                      <td data-rotulo="Data">{dataHora(o.criadoEm)}</td>
                      <td className="lista-principal quebra" data-rotulo="Cliente">
                        {o.clienteNome ?? '—'}
                      </td>
                      <td className="quebra" data-rotulo="Serviços">
                        {o.itens.length === 0
                          ? '—'
                          : o.itens.length === 1
                            ? o.itens[0].servico
                            : `${o.itens[0].servico} e mais ${o.itens.length - 1}`}
                      </td>
                      <td className="numero lista-destaque" data-rotulo="Total">{formatarMoeda(o.total)}</td>
                      <td data-rotulo="Situação">
                        <span className={o.situacao === 'finalizado' ? 'lista-etiqueta' : 'lista-etiqueta atencao'}>
                          {o.situacao === 'finalizado' ? `Cupom Nº ${numeroCupom(o.cupomNumero ?? 0)}` : 'Em aberto'}
                        </span>
                      </td>
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
