import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import type { Aviso } from '../../../components/formulario/FaixaAviso'
import { IconeLapis, IconeLixeira, IconeMensagem, IconeVoltar } from '../../../components/icones/Icones'
import { IlustracaoClientes } from '../../../components/icones/Ilustracoes'
import { useSessaoExpirada } from '../../../hooks/useSessaoExpirada'
import {
  cancelarEnviosCliente,
  excluirCliente,
  listarEnviosCliente,
  mensagemDe,
  obterCliente,
  obterWhatsapp,
  urlFotoCliente,
  urlImagemMensagem,
  type Cliente,
  type ConfiguracaoWhatsapp,
  type EnvioWhatsapp,
} from '../../../services/api'
import { formatarCep, formatarDocumento, formatarTelefone } from '../../../utils/validacao'
import AvisoPagina from '../AvisoPagina'
import { useErp } from '../contexto'
import FaixaPagina from '../FaixaPagina'
import { tem } from '../modulos'
import SemAcesso from '../SemAcesso'
import BalaoMensagem from './BalaoMensagem'
import { descreverIntervalo, formatarCadastro, formatarDataHora, proximosEnvios, situacaoManutencao } from './formatos'
import JanelaEnvios from './JanelaEnvios'
import { avisarSalvo } from '../../../components/aviso-salvo/avisarSalvo'
import './clientes.css'

const CLASSE_SITUACAO = { atrasada: 'lista-etiqueta alerta', proxima: 'lista-etiqueta atencao', 'em-dia': 'lista-etiqueta' }

type Grupo = { titulo: string; itens: [string, string][] }

/**
 * Detalhes do cliente: à esquerda a ficha (foto, contato, dados pessoais e endereço); à direita o WhatsApp automático
 * (próximos envios e a mensagem como o cliente recebe, só para ver). Mudar dados, calendário ou mensagem: botão Editar.
 */
export default function ClientePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { sessao } = useErp()
  const sessaoExpirada = useSessaoExpirada()
  const [cliente, setCliente] = useState<Cliente | null>(null)
  // Mensagem padrão da empresa (vale quando o cliente não tem mensagem própria)
  const [padrao, setPadrao] = useState<ConfiguracaoWhatsapp | null>(null)
  const [aviso, setAviso] = useState<Aviso>((useLocation().state as { aviso?: Aviso } | null)?.aviso ?? null)
  const [confirmando, setConfirmando] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  // Histórico de envios da mensagem automática: carregado de novo a cada vez que a janela abre
  const [historicoAberto, setHistoricoAberto] = useState(false)
  const [envios, setEnvios] = useState<EnvioWhatsapp[] | null>(null)
  const [erroEnvios, setErroEnvios] = useState<string>()

  const podeVer = tem(sessao.usuario, 'clientes')
  const podeEditar = tem(sessao.usuario, 'clientes-editar')

  useEffect(() => {
    if (!podeVer) return
    let ativo = true
    obterCliente(sessao.token, id!)
      .then((c) => ativo && setCliente(c))
      .catch((e) => ativo && !sessaoExpirada(e) && setAviso({ tipo: 'erro', texto: mensagemDe(e) }))
    // A mensagem padrão só abre para quem pode editar clientes; os outros veem "Mensagem padrão da empresa"
    if (podeEditar) obterWhatsapp(sessao.token).then((c) => ativo && setPadrao(c)).catch(() => {})
    return () => {
      ativo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, sessao.token, podeVer])

  if (!podeVer) return <div className="erp-pagina"><SemAcesso /></div>

  const excluir = async () => {
    setExcluindo(true)
    try {
      await excluirCliente(sessao.token, id!)
      navigate('/app/clientes', { replace: true, state: { aviso: { tipo: 'ok', texto: 'Cliente excluído.' } } })
    } catch (erro) {
      if (sessaoExpirada(erro)) return
      setAviso({ tipo: 'erro', texto: mensagemDe(erro) })
      setExcluindo(false)
    }
  }

  if (!cliente) {
    return (
      <div className="erp-pagina">
        <Link to="/app/clientes" className="erp-voltar">
          <IconeVoltar tamanho={18} />
          Clientes
        </Link>
        {aviso ? <AvisoPagina aviso={aviso} /> : <p className="erp-carregando">Carregando...</p>}
      </div>
    )
  }

  const situacao = cliente.proximaManutencao ? situacaoManutencao(cliente.proximaManutencao) : null
  // Os envios seguintes, já agendados (com o horário quando o intervalo é de minutos ou horas)
  const curto = cliente.intervaloUnidade === 'minutos' || cliente.intervaloUnidade === 'horas'
  const seguintes =
    cliente.envioEm && cliente.tipoIntervalo === 'meses' && cliente.intervaloQuantidade
      ? proximosEnvios(new Date(cliente.envioEm), { quantidade: cliente.intervaloQuantidade, unidade: cliente.intervaloUnidade }, 4)
          .slice(1)
          .map((d) =>
            curto
              ? `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
              : d.toLocaleDateString('pt-BR'),
          )
      : []

  // A mensagem que sai (igual ao envio automático): a própria do cliente ou a padrão; a imagem do cliente ou,
  // sem texto próprio, a da mensagem padrão.
  const personalizada = !!cliente.mensagemWhatsapp
  const texto = cliente.mensagemWhatsapp ?? padrao?.mensagem ?? ''
  const imagemId = cliente.mensagemImagemId ?? (personalizada ? null : (padrao?.imagemId ?? null))

  const cancelarEnvios = async () => {
    setCancelando(true)
    try {
      setCliente(await cancelarEnviosCliente(sessao.token, cliente.id))
      avisarSalvo('Alterações feitas com sucesso', 'Envios automáticos cancelados')
    } catch (erro) {
      if (!sessaoExpirada(erro)) setAviso({ tipo: 'erro', texto: mensagemDe(erro) })
    } finally {
      setCancelando(false)
    }
  }

  const telefone = (t: string | null) => (t ? formatarTelefone(t) : '—')
  // "1980-05-20" → "20/05/1980"
  const dia = (d: string | null) => (d ? d.split('-').reverse().join('/') : '—')
  const contato: Grupo = {
    titulo: 'Contato',
    itens: [
      ['Celular (WhatsApp)', formatarTelefone(cliente.celular)],
      ['Celular 2', telefone(cliente.celular2)],
      ['Fone residencial', telefone(cliente.telefoneResidencial)],
      ['Fone comercial', telefone(cliente.telefoneComercial)],
    ],
  }
  const pessoais: Grupo = {
    titulo: 'Dados pessoais',
    itens: [
      ['CPF / CNPJ', cliente.documento ? formatarDocumento(cliente.documento) : '—'],
      ['Data de nascimento', dia(cliente.dataNascimento)],
      ['Cônjuge', cliente.conjuge ?? '—'],
      ['Data da compra', dia(cliente.dataCompra)],
    ],
  }
  const endereco: Grupo = {
    titulo: 'Endereço',
    itens: [
      ['Rua', [cliente.logradouro, cliente.numeroEndereco].filter(Boolean).join(', ') || '—'],
      ['Complemento', cliente.complemento ?? '—'],
      ['Bairro', cliente.bairro ?? '—'],
      ['Cidade', [cliente.cidade, cliente.uf].filter(Boolean).join(' / ') || '—'],
      ['CEP', cliente.cep ? formatarCep(cliente.cep) : '—'],
      ['Ponto de referência', cliente.pontoReferencia ?? '—'],
    ],
  }

  const grupo = (g: Grupo) => (
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
  )

  const abrirHistorico = () => {
    setEnvios(null)
    setErroEnvios(undefined)
    setHistoricoAberto(true)
    listarEnviosCliente(sessao.token, cliente.id)
      .then(setEnvios)
      .catch((erro) => !sessaoExpirada(erro) && setErroEnvios(mensagemDe(erro)))
  }

  const acoes = podeEditar && (
    <>
      <Link to={`/app/clientes/${cliente.id}/editar`} className="pagina-botao claro">
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
    <div className="pagina tema-clientes">
      <FaixaPagina
        Ilustracao={IlustracaoClientes}
        titulo={cliente.nome}
        subtitulo={`ID ${cliente.numero} · cliente desde ${formatarCadastro(cliente.criadoEm)}`}
        voltar={{ para: '/app/clientes', rotulo: 'Clientes' }}
        acoes={acoes || undefined}
      />

      <JanelaEnvios
        aberto={historicoAberto}
        titulo="Histórico de envios"
        dica={`Todas as mensagens automáticas para ${cliente.nome}, das mais novas para as mais antigas.`}
        envios={envios}
        erro={erroEnvios}
        mostrarMensagem
        onFechar={() => setHistoricoAberto(false)}
      />

      <div className="pagina-corpo">
        {aviso && <AvisoPagina aviso={aviso} />}

        <div className="cliente-detalhe">
          {/* Ficha: foto ao lado do contato e dos dados pessoais (como no registro em papel); endereço embaixo */}
          <div className="cliente-detalhe-ficha">
            <div className="detalhe-com-foto">
              <div className="detalhe-foto">
                {cliente.fotoId ? (
                  <img src={urlFotoCliente(cliente.fotoId)} alt={`Foto de ${cliente.nome}`} />
                ) : (
                  <span>Sem foto</span>
                )}
              </div>
              <div className="detalhe-grupos">
                {grupo(contato)}
                {grupo(pessoais)}
              </div>
            </div>
            {grupo(endereco)}
            <p className="erp-nota">Atualizado em {formatarCadastro(cliente.atualizadoEm)}</p>
          </div>

          {/* WhatsApp automático: quando sai e como o cliente recebe (para mudar: Editar) */}
          <aside className="cliente-whatsapp" aria-labelledby="cliente-whatsapp-titulo">
            <header className="cliente-whatsapp-topo">
              <h2 id="cliente-whatsapp-titulo">WhatsApp automático</h2>
              {cliente.envioEm ? (
                <span className="cliente-whatsapp-situacao ativo">Ligado</span>
              ) : (
                <span className="cliente-whatsapp-situacao">Desligado</span>
              )}
            </header>

            <dl className="cliente-whatsapp-dados">
              <div>
                <dt>Repete</dt>
                <dd>{descreverIntervalo(cliente)}</dd>
              </div>
              <div>
                <dt>Próximo envio</dt>
                <dd>
                  {cliente.envioEm ? formatarDataHora(cliente.envioEm) : '—'}{' '}
                  {situacao && cliente.envioEm && <span className={CLASSE_SITUACAO[situacao.tipo]}>{situacao.texto}</span>}
                </dd>
              </div>
              {seguintes.length > 0 && (
                <div>
                  <dt>Depois</dt>
                  <dd>
                    <ul className="cliente-whatsapp-seguintes">
                      {seguintes.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </dd>
                </div>
              )}
            </dl>

            <div className="cliente-whatsapp-mensagem">
              <span className="cliente-whatsapp-rotulo">
                {personalizada || cliente.mensagemImagemId ? 'Mensagem deste cliente' : 'Mensagem padrão da empresa'}
              </span>
              {podeEditar || personalizada ? (
                <BalaoMensagem
                  texto={texto}
                  imagemUrl={imagemId ? urlImagemMensagem(imagemId) : null}
                  nome={cliente.nome}
                  empresa={sessao.empresa.nome}
                  envio={cliente.envioEm ? new Date(cliente.envioEm) : null}
                />
              ) : (
                <p className="erp-nota">Este cliente recebe a mensagem padrão da empresa.</p>
              )}
              {podeEditar && (
                <p className="cliente-whatsapp-dica">
                  Para mudar a mensagem, a imagem ou o calendário, clique em <strong>Editar</strong>.
                </p>
              )}
            </div>

            <div className="cliente-whatsapp-acoes">
              <button type="button" className="pagina-botao neutro" onClick={abrirHistorico}>
                <IconeMensagem tamanho={20} />
                Histórico de envios
              </button>
              {podeEditar && cliente.envioEm && (
                <button type="button" className="pagina-botao perigo" onClick={cancelarEnvios} disabled={cancelando}>
                  {cancelando ? 'Cancelando...' : 'Cancelar envios automáticos'}
                </button>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
