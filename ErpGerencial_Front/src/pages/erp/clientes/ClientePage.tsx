import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import type { Aviso } from '../../../components/formulario/FaixaAviso'
import { IconeLapis, IconeLixeira, IconeMensagem, IconeVoltar } from '../../../components/icones/Icones'
import { IlustracaoClientes } from '../../../components/icones/Ilustracoes'
import { useSessaoExpirada } from '../../../hooks/useSessaoExpirada'
import { excluirCliente, listarEnviosCliente, mensagemDe, obterCliente, type Cliente, type EnvioWhatsapp } from '../../../services/api'
import { formatarCep, formatarDocumento, formatarTelefone } from '../../../utils/validacao'
import AvisoPagina from '../AvisoPagina'
import { useErp } from '../contexto'
import FaixaPagina from '../FaixaPagina'
import { tem } from '../modulos'
import SemAcesso from '../SemAcesso'
import { descreverIntervalo, formatarCadastro, formatarDataHora, situacaoManutencao } from './formatos'
import JanelaEnvios from './JanelaEnvios'
import MensagemPersonalizada from './MensagemPersonalizada'
import './clientes.css'

const CLASSE_SITUACAO = { atrasada: 'lista-etiqueta alerta', proxima: 'lista-etiqueta atencao', 'em-dia': 'lista-etiqueta' }

// Detalhes do cliente: todas as informações e o histórico de envios. Quem pode editar vê "Editar", "Excluir" e o campo da mensagem personalizada.
export default function ClientePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { sessao } = useErp()
  const sessaoExpirada = useSessaoExpirada()
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [aviso, setAviso] = useState<Aviso>((useLocation().state as { aviso?: Aviso } | null)?.aviso ?? null)
  const [confirmando, setConfirmando] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
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
  const telefone = (t: string | null) => (t ? formatarTelefone(t) : '—')
  // "1980-05-20" → "20/05/1980"
  const dia = (d: string | null) => (d ? d.split('-').reverse().join('/') : '—')
  const grupos: { titulo: string; itens: [string, string][] }[] = [
    {
      titulo: 'Contato',
      itens: [
        ['Celular (WhatsApp)', formatarTelefone(cliente.celular)],
        ['Celular 2', telefone(cliente.celular2)],
        ['Fone residencial', telefone(cliente.telefoneResidencial)],
        ['Fone comercial', telefone(cliente.telefoneComercial)],
      ],
    },
    {
      titulo: 'Dados pessoais',
      itens: [
        ['CPF/CNPJ', cliente.documento ? formatarDocumento(cliente.documento) : '—'],
        ['Data de nascimento', dia(cliente.dataNascimento)],
        ['Cônjuge', cliente.conjuge ?? '—'],
      ],
    },
    { titulo: 'Compra', itens: [['Data da compra', dia(cliente.dataCompra)]] },
    {
      titulo: 'Endereço',
      itens: [
        ['CEP', cliente.cep ? formatarCep(cliente.cep) : '—'],
        ['Rua', cliente.logradouro ?? '—'],
        ['Número', cliente.numeroEndereco ?? '—'],
        ['Complemento', cliente.complemento ?? '—'],
        ['Bairro', cliente.bairro ?? '—'],
        ['Cidade', [cliente.cidade, cliente.uf].filter(Boolean).join('/') || '—'],
        ['Ponto de referência', cliente.pontoReferencia ?? '—'],
      ],
    },
    {
      titulo: 'Manutenção',
      itens: [
        ['Cadastrado em', formatarCadastro(cliente.criadoEm)],
        ['Intervalo', descreverIntervalo(cliente)],
        // Próxima manutenção = quando a mensagem de WhatsApp sai
        ['Próxima manutenção', cliente.envioEm ? formatarDataHora(cliente.envioEm) : '—'],
        // Quem pode editar escreve a mensagem no campo logo abaixo; os outros só veem qual vale
        ...(podeEditar
          ? []
          : [['Mensagem', cliente.mensagemWhatsapp ? `Personalizada: ${cliente.mensagemWhatsapp}` : 'Mensagem padrão'] as [string, string]]),
      ],
    },
  ]

  const abrirHistorico = () => {
    setEnvios(null)
    setErroEnvios(undefined)
    setHistoricoAberto(true)
    listarEnviosCliente(sessao.token, cliente.id)
      .then(setEnvios)
      .catch((erro) => !sessaoExpirada(erro) && setErroEnvios(mensagemDe(erro)))
  }

  const acoes = (
    <>
      <button type="button" className={podeEditar ? 'pagina-botao escuro' : 'pagina-botao claro'} onClick={abrirHistorico}>
        <IconeMensagem tamanho={20} />
        Histórico de envios
      </button>
      {podeEditar && (
        <Link to={`/app/clientes/${cliente.id}/editar`} className="pagina-botao claro">
          <IconeLapis tamanho={20} />
          Editar
        </Link>
      )}
      {podeEditar &&
        (!confirmando ? (
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
        ))}
    </>
  )

  return (
    <div className="pagina tema-clientes">
      <FaixaPagina
        Ilustracao={IlustracaoClientes}
        titulo={cliente.nome}
        subtitulo={
          cliente.envioEm && situacao ? (
            <>
              ID {cliente.numero} · Próxima manutenção {formatarDataHora(cliente.envioEm)}{' '}
              <span className={CLASSE_SITUACAO[situacao.tipo]}>{situacao.texto}</span>
            </>
          ) : (
            `ID ${cliente.numero}`
          )
        }
        voltar={{ para: '/app/clientes', rotulo: 'Clientes' }}
        acoes={acoes}
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

        {podeEditar && <MensagemPersonalizada key={cliente.id} cliente={cliente} onSalvo={setCliente} />}

        <p className="erp-nota">Atualizado em {formatarCadastro(cliente.atualizadoEm)}</p>
      </div>
    </div>
  )
}
