import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Aviso } from '../../../components/formulario/FaixaAviso'
import { IconeBusca, IconeMais } from '../../../components/icones/Icones'
import { IlustracaoCupomFiscal } from '../../../components/icones/Ilustracoes'
import { useSessaoExpirada } from '../../../hooks/useSessaoExpirada'
import { listarCupons, mensagemDe, rotuloPagamento, type ListaCupons } from '../../../services/api'
import { formatarMoeda } from '../../../utils/validacao'
import AvisoPagina from '../AvisoPagina'
import CabecalhoModulo from '../CabecalhoModulo'
import FaixaPagina from '../FaixaPagina'
import { useErp } from '../contexto'
import { MODULOS, podeAcessar } from '../modulos'
import SemAcesso from '../SemAcesso'
import { numeroCupom } from './numero'
import './cupons.css'

const MODULO = MODULOS.find((m) => m.id === 'cupom-fiscal')!

const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

// Cupons e recibos emitidos, mais novos primeiro, com busca. Clicar abre o cupom (impressão e cancelamento).
export default function CuponsPage() {
  const { sessao } = useErp()
  const navigate = useNavigate()
  const sessaoExpirada = useSessaoExpirada()
  const [busca, setBusca] = useState('')
  const [buscaAplicada, setBuscaAplicada] = useState('')
  const [pagina, setPagina] = useState(1)
  const [lista, setLista] = useState<ListaCupons | null>(null)
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
    listarCupons(sessao.token, buscaAplicada, pagina)
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
    <div className="pagina tema-cupom">
      <FaixaPagina
        Ilustracao={IlustracaoCupomFiscal}
        titulo={MODULO.rotulo}
        subtitulo={MODULO.descricao}
        acoes={
          <Link to="/app/cupom-fiscal/novo" className="pagina-botao marrom">
            <IconeMais tamanho={20} />
            Emitir cupom
          </Link>
        }
      />

      <div className="lista-ferramentas">
        <div className="lista-busca">
          <label htmlFor="cupons-busca" className="sr-only">
            Buscar cupom
          </label>
          <IconeBusca tamanho={20} />
          <input
            id="cupons-busca"
            type="search"
            placeholder="Nº do cupom, cliente, CPF/CNPJ ou referente a"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        {lista && (
          <p className="lista-contagem" role="status">
            <strong>{total}</strong> {total === 1 ? 'cupom' : 'cupons'}
          </p>
        )}
      </div>

      <div className="lista-corpo">
        {aviso && <AvisoPagina aviso={aviso} />}
        {!lista && !aviso && <p className="erp-carregando">Carregando...</p>}

        {lista && lista.itens.length === 0 && (
          <div className="lista-vazio">
            <IlustracaoCupomFiscal tamanho={96} />
            <div>
              <p className="lista-vazio-titulo">{buscaAplicada ? 'Nada encontrado' : 'Nenhum cupom ainda'}</p>
              <p className="lista-vazio-texto">
                {buscaAplicada ? 'Tente outro termo de busca.' : 'Clique em "Emitir cupom" para fazer o primeiro.'}
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
                    <th scope="col">Itens</th>
                    <th scope="col">Pagamento</th>
                    <th scope="col" className="numero">Total</th>
                    <th scope="col">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.itens.map((c) => (
                    // A linha inteira abre o cupom; o link no Nº é o acesso pelo teclado.
                    <tr key={c.id} onClick={() => navigate(`/app/cupom-fiscal/${c.id}`)}>
                      <td className="lista-id" data-rotulo="Nº">
                        <Link to={`/app/cupom-fiscal/${c.id}`} className="lista-nome">
                          {numeroCupom(c.numero)}
                        </Link>
                      </td>
                      <td data-rotulo="Data">{dataHora(c.emitidoEm)}</td>
                      <td className="lista-principal quebra" data-rotulo="Cliente">
                        {c.clienteNome ?? 'Consumidor'}
                      </td>
                      <td className="quebra" data-rotulo="Itens">
                        {c.itens.length > 0
                          ? `${c.itens.length} ${c.itens.length === 1 ? 'item' : 'itens'}`
                          : (c.referente ?? 'Recibo')}
                      </td>
                      <td data-rotulo="Pagamento">{rotuloPagamento(c.formaPagamento)}</td>
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
