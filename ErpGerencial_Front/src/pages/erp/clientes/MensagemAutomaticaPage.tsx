import { useEffect, useState, type SubmitEvent } from 'react'
import { Link } from 'react-router-dom'
import CampoArea from '../../../components/formulario/CampoArea'
import CampoTexto from '../../../components/formulario/CampoTexto'
import type { Aviso } from '../../../components/formulario/FaixaAviso'
import { IconeCheck } from '../../../components/icones/Icones'
import { IlustracaoClientes } from '../../../components/icones/Ilustracoes'
import { useSessaoExpirada } from '../../../hooks/useSessaoExpirada'
import { ErroApi, mensagemDe, obterWhatsapp, salvarWhatsapp, type ConfiguracaoWhatsapp } from '../../../services/api'
import { formatarTelefone, telefoneValido } from '../../../utils/validacao'
import AvisoPagina from '../AvisoPagina'
import { useErp } from '../contexto'
import FaixaPagina from '../FaixaPagina'
import { tem } from '../modulos'
import SecaoPagina from '../SecaoPagina'
import SemAcesso from '../SemAcesso'
import { formatarDia, MENSAGEM_MAXIMO as MAXIMO, TRECHOS_MENSAGEM as TRECHOS } from './formatos'
import '../../../styles/acesso.css'
import './clientes.css'

/** Sugestão de texto para quem ainda não escreveu nenhuma mensagem. */
const SUGESTAO =
  'Olá, {nome}! Aqui é da {empresa}. Hoje, {data}, é o dia da manutenção do seu filtro. Quer agendar a visita?'

const STATUS = {
  enviado: { texto: 'Enviada', classe: 'lista-etiqueta' },
  teste: { texto: 'Teste', classe: 'lista-etiqueta atencao' },
  erro: { texto: 'Não enviada', classe: 'lista-etiqueta alerta' },
}

type Campo = 'remetente' | 'mensagem'

// Mensagem automática de manutenção: o texto, o celular que envia, ligar/desligar e o histórico.
// Quem envia é o robô em Python (ErpGerencial_Automacao), no dia da manutenção de cada cliente.
export default function MensagemAutomaticaPage() {
  const { sessao } = useErp()
  const sessaoExpirada = useSessaoExpirada()
  const [config, setConfig] = useState<ConfiguracaoWhatsapp | null>(null)
  const [remetente, setRemetente] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erroServidor, setErroServidor] = useState<Partial<Record<Campo, string>>>({})
  const [aviso, setAviso] = useState<Aviso>(null)
  const permitido = tem(sessao.usuario, 'clientes-editar')

  const aplicar = (c: ConfiguracaoWhatsapp) => {
    setConfig(c)
    setRemetente(formatarTelefone(c.remetente ?? ''))
    setMensagem(c.mensagem ?? SUGESTAO)
  }

  useEffect(() => {
    if (!permitido) return
    let ativo = true
    obterWhatsapp(sessao.token)
      .then((c) => ativo && aplicar(c))
      .catch((e) => ativo && !sessaoExpirada(e) && setAviso({ tipo: 'erro', texto: mensagemDe(e) }))
    return () => {
      ativo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessao.token, permitido])

  if (!permitido) return <div className="erp-pagina"><SemAcesso /></div>
  if (!config) {
    return (
      <div className="erp-pagina">
        {aviso ? <AvisoPagina aviso={aviso} /> : <p className="erp-carregando">Carregando...</p>}
      </div>
    )
  }

  const validar = (): Partial<Record<Campo, string>> => ({
    ...(remetente && !telefoneValido(remetente) ? { remetente: 'Incompleto' } : {}),
  })
  const erros = { ...erroServidor, ...(enviado ? validar() : {}) }

  const mudou = () => {
    setErroServidor({})
    setAviso(null)
  }

  const salvar = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (salvando) return
    setEnviado(true)
    const invalido = (['remetente', 'mensagem'] as const).find((c) => validar()[c])
    if (invalido) {
      document.getElementById(`whatsapp-${invalido}`)?.focus()
      return
    }
    setSalvando(true)
    setAviso(null)
    try {
      aplicar(await salvarWhatsapp(sessao.token, { remetente, mensagem }))
      setEnviado(false)
      setAviso({ tipo: 'ok', texto: 'Salvo.' })
    } catch (erro) {
      if (sessaoExpirada(erro)) return
      if (erro instanceof ErroApi && (erro.campo === 'remetente' || erro.campo === 'mensagem'))
        setErroServidor({ [erro.campo]: erro.message })
      setAviso({ tipo: 'erro', texto: mensagemDe(erro) })
    } finally {
      setSalvando(false)
    }
  }

  // Prévia com um cliente de exemplo, do jeito que o robô vai montar a mensagem.
  const previa = mensagem
    .replace(/\{nome\}/gi, 'Maria')
    .replace(/\{data\}/gi, new Date().toLocaleDateString('pt-BR'))
    .replace(/\{empresa\}/gi, sessao.empresa.nome)

  return (
    <div className="pagina tema-clientes">
      <FaixaPagina
        Ilustracao={IlustracaoClientes}
        titulo="Mensagem automática"
        subtitulo="Enviada pelo WhatsApp na data e horário do envio marcados em cada cliente."
        voltar={{ para: '/app/clientes', rotulo: 'Clientes' }}
      />

      <form className="pagina-secoes" onSubmit={salvar} noValidate>
        <SecaoPagina id="whatsapp-remetente" numero={1} titulo="WhatsApp que envia">
          <div className="erp-form">
            <CampoTexto
              id="whatsapp-remetente"
              rotulo="Celular que envia"
              type="tel"
              inputMode="numeric"
              placeholder="(16) 99103-9268"
              autoComplete="off"
              valor={remetente}
              onChange={(v) => {
                setRemetente(formatarTelefone(v))
                mudou()
              }}
              erro={erros.remetente}
            />
            <p className="clientes-previa">Este celular precisa estar conectado ao robô (QR Code, uma vez só).</p>
          </div>
        </SecaoPagina>

        <SecaoPagina id="whatsapp-mensagem" numero={2} titulo="Mensagem">
          <CampoArea
            id="whatsapp-mensagem"
            rotulo="Digitar mensagem automática"
            maxLength={MAXIMO}
            valor={mensagem}
            onChange={(v) => {
              setMensagem(v)
              mudou()
            }}
            erro={erros.mensagem}
          />
          <div className="mensagem-trechos">
            <span>Inserir:</span>
            {TRECHOS.map((t) => (
              <button
                key={t.trecho}
                type="button"
                className="mensagem-trecho"
                onClick={() => {
                  setMensagem((m) => `${m}${m && !m.endsWith(' ') ? ' ' : ''}${t.trecho}`.slice(0, MAXIMO))
                  mudou()
                  document.getElementById('whatsapp-mensagem')?.focus()
                }}
              >
                {t.rotulo}
              </button>
            ))}
          </div>
          {mensagem.trim() && (
            <div className="mensagem-previa">
              <span className="mensagem-previa-rotulo">Como o cliente recebe</span>
              <p className="mensagem-balao">{previa}</p>
            </div>
          )}
        </SecaoPagina>

        <SecaoPagina id="whatsapp-historico" numero={3} titulo="Últimos envios">
          {config.envios.length === 0 ? (
            <p className="erp-nota">Nenhuma mensagem enviada ainda.</p>
          ) : (
            <ul className="mensagem-envios">
              {config.envios.map((e) => (
                <li key={e.id} className="mensagem-envio">
                  <span className={STATUS[e.status].classe}>{STATUS[e.status].texto}</span>
                  <span className="mensagem-envio-textos">
                    <Link to={`/app/clientes/${e.clienteId}`} className="lista-nome">
                      {e.clienteNome}
                    </Link>
                    <span className="mensagem-envio-detalhe">
                      {formatarTelefone(e.telefone)} ·{' '}
                      {e.tipo === 'agendado' ? `envio de ${formatarDia(e.dataReferencia)}` : `manutenção de ${formatarDia(e.dataReferencia)}`} ·{' '}
                      {new Date(e.criadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                    {e.erro && <span className="mensagem-envio-erro">{e.erro}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SecaoPagina>

        <div className="pagina-barra">
          <button type="submit" className="pagina-botao" disabled={salvando}>
            <IconeCheck tamanho={20} />
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
          {aviso && <AvisoPagina aviso={aviso} />}
        </div>
      </form>
    </div>
  )
}
