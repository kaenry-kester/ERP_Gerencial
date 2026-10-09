import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { Aviso } from '../../../components/formulario/FaixaAviso'
import { IconeBusca, IconeMais, IconeMensagem } from '../../../components/icones/Icones'
import { IlustracaoClientes } from '../../../components/icones/Ilustracoes'
import { useSessaoExpirada } from '../../../hooks/useSessaoExpirada'
import {
  listarClientes,
  mensagemDe,
  obterWhatsapp,
  salvarWhatsapp,
  type ConfiguracaoWhatsapp,
  type ListaClientes,
} from '../../../services/api'
import { formatarDocumento, formatarTelefone } from '../../../utils/validacao'
import AvisoPagina from '../AvisoPagina'
import CabecalhoModulo from '../CabecalhoModulo'
import { useErp } from '../contexto'
import FaixaPagina from '../FaixaPagina'
import { MODULOS, podeAcessar, tem } from '../modulos'
import SemAcesso from '../SemAcesso'
import { descreverIntervalo, formatarCadastro, formatarDataHora, resumoEndereco, situacaoManutencao } from './formatos'
import MensagemDialogo from './MensagemDialogo'
import './clientes.css'

const MODULO = MODULOS.find((m) => m.id === 'clientes')!

const CLASSE_SITUACAO = { atrasada: 'lista-etiqueta alerta', proxima: 'lista-etiqueta atencao', 'em-dia': 'lista-etiqueta' }

// Aba Clientes: lista de todos os clientes da empresa, com busca e a próxima manutenção. Clicar abre os detalhes.
export default function ClientesPage() {
  const { sessao } = useErp()
  const navigate = useNavigate()
  const sessaoExpirada = useSessaoExpirada()
  const [busca, setBusca] = useState('')
  const [buscaAplicada, setBuscaAplicada] = useState('')
  const [pagina, setPagina] = useState(1)
  const [lista, setLista] = useState<ListaClientes | null>(null)
  const [aviso, setAviso] = useState<Aviso>((useLocation().state as { aviso?: Aviso } | null)?.aviso ?? null)
  const podeVer = podeAcessar(sessao.usuario, MODULO)
  const podeEditar = tem(sessao.usuario, 'clientes-editar')
  // Mensagem padrão (a mesma para todos os clientes), editada aqui numa caixa grande
  const [whatsapp, setWhatsapp] = useState<ConfiguracaoWhatsapp | null>(null)
  const [mensagemAberta, setMensagemAberta] = useState(false)
  const [salvandoMensagem, setSalvandoMensagem] = useState(false)

  useEffect(() => {
    if (!podeEditar) return
    let ativo = true
    obterWhatsapp(sessao.token)
      .then((c) => ativo && setWhatsapp(c))
      .catch((e) => ativo && !sessaoExpirada(e) && setAviso({ tipo: 'erro', texto: mensagemDe(e) }))
    return () => {
      ativo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessao.token, podeEditar])

  const salvarMensagemPadrao = async (mensagem: string) => {
    if (!whatsapp) return
    setSalvandoMensagem(true)
    try {
      setWhatsapp(await salvarWhatsapp(sessao.token, { remetente: whatsapp.remetente ?? '', mensagem }))
      setMensagemAberta(false)
      setAviso(null)
    } catch (erro) {
      if (!sessaoExpirada(erro)) setAviso({ tipo: 'erro', texto: mensagemDe(erro) })
    } finally {
      setSalvandoMensagem(false)
    }
  }

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
    listarClientes(sessao.token, buscaAplicada, pagina)
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

  const acoes = (
    <>
      {tem(sessao.usuario, 'clientes-editar') && (
        <Link to="/app/clientes/mensagem" className="pagina-botao marrom">
          <IconeMensagem tamanho={20} />
          Inserir mensagem automática
        </Link>
      )}
      {tem(sessao.usuario, 'clientes-cadastrar') && (
        <Link to="/app/clientes/novo" className="pagina-botao marrom">
          <IconeMais tamanho={20} />
          Cadastrar cliente
        </Link>
      )}
    </>
  )
  const temAcoes = tem(sessao.usuario, 'clientes-editar') || tem(sessao.usuario, 'clientes-cadastrar')

  const total = lista?.total ?? 0
  const inicio = lista && total > 0 ? (lista.pagina - 1) * lista.tamanhoPagina + 1 : 0
  const fim = lista ? inicio + lista.itens.length - 1 : 0
  const paginas = lista ? Math.max(1, Math.ceil(total / lista.tamanhoPagina)) : 1

  return (
    <div className="pagina tema-clientes">
      <FaixaPagina
        Ilustracao={IlustracaoClientes}
        titulo="Clientes"
        subtitulo={MODULO.descricao}
        acoes={temAcoes ? acoes : undefined}
      />

      <div className="lista-ferramentas">
        <div className="lista-busca">
          <label htmlFor="clientes-busca" className="sr-only">
            Buscar cliente
          </label>
          <IconeBusca tamanho={20} />
          <input
            id="clientes-busca"
            type="search"
            placeholder="Nome, CPF/CNPJ, celular ou endereço"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        {whatsapp && (
          <button
            type="button"
            id="clientes-mensagem-padrao"
            className={whatsapp.mensagem ? 'campo-botao preenchido' : 'campo-botao'}
            onClick={() => setMensagemAberta(true)}
          >
            <span className="campo-botao-textos">
              <span className="campo-botao-rotulo">Mensagem padrão (para todos)</span>
              <span className="campo-botao-valor">{whatsapp.mensagem || 'Clique para digitar'}</span>
            </span>
            <IconeMensagem tamanho={20} />
          </button>
        )}
        {lista && (
          <p className="lista-contagem" role="status">
            <strong>{total}</strong> {total === 1 ? 'cliente' : 'clientes'}
          </p>
        )}
      </div>

      {whatsapp && (
        <MensagemDialogo
          aberto={mensagemAberta}
          titulo="Mensagem padrão"
          dica="Enviada pelo WhatsApp a cada cliente na data e horário do envio (menos quem tem mensagem personalizada)."
          valor={whatsapp.mensagem ?? ''}
          salvando={salvandoMensagem}
          onFechar={() => setMensagemAberta(false)}
          onSalvar={salvarMensagemPadrao}
        />
      )}

      <div className="lista-corpo">
        {aviso && <AvisoPagina aviso={aviso} />}
        {!lista && !aviso && <p className="erp-carregando">Carregando...</p>}

        {lista && lista.itens.length === 0 && (
          <div className="lista-vazio">
            <IlustracaoClientes tamanho={96} />
            <div>
              <p className="lista-vazio-titulo">{buscaAplicada ? 'Nada encontrado' : 'Nenhum cliente ainda'}</p>
              <p className="lista-vazio-texto">
                {buscaAplicada ? 'Tente outro termo de busca.' : 'Os clientes cadastrados aparecem aqui.'}
              </p>
            </div>
          </div>
        )}

        {lista && lista.itens.length > 0 && (
          <>
            {/* Complemento e CEP aparecem só nos detalhes; em telas estreitas cada linha vira um cartão */}
            <div className="lista-tabela-area">
              <table className="lista-tabela">
                <thead>
                  <tr>
                    <th scope="col" className="lista-id">ID</th>
                    <th scope="col">Cliente</th>
                    <th scope="col">Próxima manutenção</th>
                    <th scope="col">Celular</th>
                    <th scope="col">CPF/CNPJ</th>
                    <th scope="col">Intervalo</th>
                    <th scope="col">Cadastro</th>
                    <th scope="col">Endereço</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.itens.map((c) => {
                    const situacao = c.proximaManutencao ? situacaoManutencao(c.proximaManutencao) : null
                    return (
                      // A linha inteira abre o cliente; o link no nome é o acesso pelo teclado.
                      <tr key={c.id} onClick={() => navigate(`/app/clientes/${c.id}`)}>
                        <td className="lista-id" data-rotulo="ID">{c.numero}</td>
                        <td className="lista-principal quebra">
                          <Link to={`/app/clientes/${c.id}`} className="lista-nome">
                            {c.nome}
                          </Link>
                        </td>
                        {/* Próxima manutenção = quando a mensagem de WhatsApp sai */}
                        <td className="clientes-proxima-celula" data-rotulo="Próxima manutenção">
                          {c.envioEm && situacao ? (
                            <span className="clientes-proxima">
                              {formatarDataHora(c.envioEm)}
                              <span className={CLASSE_SITUACAO[situacao.tipo]}>{situacao.texto}</span>
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="lista-destaque" data-rotulo="Celular">{formatarTelefone(c.celular)}</td>
                        <td data-rotulo="CPF/CNPJ">{c.documento ? formatarDocumento(c.documento) : '—'}</td>
                        <td className="quebra" data-rotulo="Intervalo">{descreverIntervalo(c)}</td>
                        <td data-rotulo="Cadastro">{formatarCadastro(c.criadoEm)}</td>
                        <td className="clientes-endereco quebra" data-rotulo="Endereço">
                          {resumoEndereco(c) || '—'}
                        </td>
                      </tr>
                    )
                  })}
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
