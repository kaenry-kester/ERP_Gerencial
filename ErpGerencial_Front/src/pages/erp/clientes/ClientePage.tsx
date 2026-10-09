import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import type { Aviso } from '../../../components/formulario/FaixaAviso'
import { IconeLapis, IconeLixeira, IconeVoltar } from '../../../components/icones/Icones'
import { IlustracaoClientes } from '../../../components/icones/Ilustracoes'
import { useSessaoExpirada } from '../../../hooks/useSessaoExpirada'
import { excluirCliente, mensagemDe, obterCliente, type Cliente } from '../../../services/api'
import { formatarCep, formatarTelefone } from '../../../utils/validacao'
import AvisoPagina from '../AvisoPagina'
import { useErp } from '../contexto'
import FaixaPagina from '../FaixaPagina'
import { tem } from '../modulos'
import SemAcesso from '../SemAcesso'
import { descreverIntervalo, formatarCadastro, formatarDataHora, situacaoManutencao } from './formatos'
import MensagemPersonalizada from './MensagemPersonalizada'
import './clientes.css'

const CLASSE_SITUACAO = { atrasada: 'lista-etiqueta alerta', proxima: 'lista-etiqueta atencao', 'em-dia': 'lista-etiqueta' }

// Detalhes do cliente: todas as informações. Quem pode editar vê "Editar", "Excluir" e o campo da mensagem personalizada.
export default function ClientePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { sessao } = useErp()
  const sessaoExpirada = useSessaoExpirada()
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [aviso, setAviso] = useState<Aviso>((useLocation().state as { aviso?: Aviso } | null)?.aviso ?? null)
  const [confirmando, setConfirmando] = useState(false)
  const [excluindo, setExcluindo] = useState(false)

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
  const grupos: { titulo: string; itens: [string, string][] }[] = [
    { titulo: 'Contato', itens: [['Celular', formatarTelefone(cliente.celular)]] },
    {
      titulo: 'Endereço',
      itens: [
        ['CEP', cliente.cep ? formatarCep(cliente.cep) : '—'],
        ['Rua', cliente.logradouro ?? '—'],
        ['Número', cliente.numeroEndereco ?? '—'],
        ['Complemento', cliente.complemento ?? '—'],
        ['Bairro', cliente.bairro ?? '—'],
        ['Cidade', [cliente.cidade, cliente.uf].filter(Boolean).join('/') || '—'],
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

        {podeEditar && <MensagemPersonalizada key={cliente.id} cliente={cliente} onSalvo={setCliente} />}

        <p className="erp-nota">Atualizado em {formatarCadastro(cliente.atualizadoEm)}</p>
      </div>
    </div>
  )
}
