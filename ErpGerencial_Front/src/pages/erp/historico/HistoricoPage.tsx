import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Aviso } from '../../../components/formulario/FaixaAviso'
import { IconeBusca } from '../../../components/icones/Icones'
import { IlustracaoOrdemServico } from '../../../components/icones/Ilustracoes'
import { useSessaoExpirada } from '../../../hooks/useSessaoExpirada'
import { listarHistoricoClientes, mensagemDe, type ListaClientesHistorico } from '../../../services/api'
import { formatarDocumento, formatarMoeda, formatarTelefone } from '../../../utils/validacao'
import AvisoPagina from '../AvisoPagina'
import CabecalhoModulo from '../CabecalhoModulo'
import FaixaPagina from '../FaixaPagina'
import { useErp } from '../contexto'
import { MODULOS, podeAcessar } from '../modulos'
import SemAcesso from '../SemAcesso'
import { quando } from './quando'
import './historico.css'

const MODULO = MODULOS.find((m) => m.id === 'ordem-servico')!

// Histórico dos clientes: todos os clientes, quem teve atividade mais recente primeiro. Clicar abre o histórico completo.
export default function HistoricoPage() {
  const { sessao } = useErp()
  const navigate = useNavigate()
  const sessaoExpirada = useSessaoExpirada()
  const [busca, setBusca] = useState('')
  const [buscaAplicada, setBuscaAplicada] = useState('')
  const [pagina, setPagina] = useState(1)
  const [lista, setLista] = useState<ListaClientesHistorico | null>(null)
  const [aviso, setAviso] = useState<Aviso>(null)
  const podeVer = podeAcessar(sessao.usuario, MODULO)

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
    listarHistoricoClientes(sessao.token, buscaAplicada, pagina)
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
  const paginas = lista ? Math.max(1, Math.ceil(total / lista.tamanhoPagina)) : 1

  return (
    <div className="pagina tema-historico">
      <FaixaPagina
        Ilustracao={IlustracaoOrdemServico}
        titulo={MODULO.rotulo}
        subtitulo="O histórico completo de cada cliente: vendas, mensagens enviadas e cancelamentos."
      />

      <div className="lista-ferramentas">
        <div className="lista-busca">
          <label htmlFor="historico-busca" className="sr-only">
            Buscar cliente
          </label>
          <IconeBusca tamanho={20} />
          <input
            id="historico-busca"
            type="search"
            placeholder="Nome, celular ou CPF/CNPJ do cliente"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        {lista && (
          <p className="lista-contagem" role="status">
            <strong>{total}</strong> {total === 1 ? 'cliente' : 'clientes'}
          </p>
        )}
      </div>

      <div className="lista-corpo">
        {aviso && <AvisoPagina aviso={aviso} />}
        {!lista && !aviso && <p className="erp-carregando">Carregando...</p>}

        {lista && lista.itens.length === 0 && (
          <div className="lista-vazio">
            <IlustracaoOrdemServico tamanho={96} />
            <div>
              <p className="lista-vazio-titulo">{buscaAplicada ? 'Nada encontrado' : 'Nenhum cliente ainda'}</p>
              <p className="lista-vazio-texto">
                {buscaAplicada ? 'Tente outro termo de busca.' : 'Os clientes cadastrados aparecem aqui, com o histórico de cada um.'}
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
                    <th scope="col" className="lista-id">ID</th>
                    <th scope="col">Cliente</th>
                    <th scope="col">Celular</th>
                    <th scope="col" className="numero">Compras</th>
                    <th scope="col" className="numero">Total gasto</th>
                    <th scope="col" className="numero">Mensagens</th>
                    <th scope="col">Última atividade</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.itens.map((c) => (
                    <tr key={c.id} onClick={() => navigate(`/app/ordem-servico/${c.id}`)}>
                      <td className="lista-id" data-rotulo="ID">{c.numero}</td>
                      <td className="lista-principal quebra">
                        <Link to={`/app/ordem-servico/${c.id}`} className="lista-nome">
                          {c.nome}
                        </Link>
                        {c.documento && <span className="historico-doc">{formatarDocumento(c.documento)}</span>}
                      </td>
                      <td data-rotulo="Celular">{formatarTelefone(c.celular)}</td>
                      <td className="numero" data-rotulo="Compras">
                        <span className={c.compras > 0 ? 'lista-etiqueta' : 'lista-etiqueta vazia'}>{c.compras}</span>
                      </td>
                      <td className="numero lista-destaque" data-rotulo="Total gasto">{formatarMoeda(c.totalGasto)}</td>
                      <td className="numero" data-rotulo="Mensagens">{c.mensagens}</td>
                      <td data-rotulo="Última atividade">{quando(c.ultimaAtividade)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {paginas > 1 && (
              <nav className="lista-paginas" aria-label="Páginas">
                <span>
                  Página {pagina} de {paginas}
                </span>
                <button type="button" className="pagina-botao neutro" disabled={pagina <= 1} onClick={() => setPagina((n) => n - 1)}>
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
