import { useEffect, useState, type SubmitEvent } from 'react'
import CampoArea from '../../../components/formulario/CampoArea'
import CampoTexto from '../../../components/formulario/CampoTexto'
import type { Aviso } from '../../../components/formulario/FaixaAviso'
import { IconeCheck, IconeMensagem } from '../../../components/icones/Icones'
import { IlustracaoClientes } from '../../../components/icones/Ilustracoes'
import { useSessaoExpirada } from '../../../hooks/useSessaoExpirada'
import {
  ErroApi,
  excluirImagemMensagem,
  mensagemDe,
  obterWhatsapp,
  salvarImagemMensagem,
  salvarWhatsapp,
  urlImagemMensagem,
  type ConfiguracaoWhatsapp,
} from '../../../services/api'
import { formatarTelefone, telefoneValido } from '../../../utils/validacao'
import AvisoPagina from '../AvisoPagina'
import { useErp } from '../contexto'
import FaixaPagina from '../FaixaPagina'
import { tem } from '../modulos'
import SecaoPagina from '../SecaoPagina'
import SemAcesso from '../SemAcesso'
import { MENSAGEM_MAXIMO as MAXIMO, TRECHOS_MENSAGEM as TRECHOS } from './formatos'
import BalaoMensagem from './BalaoMensagem'
import ExtrasMensagem from './ExtrasMensagem'
import JanelaEnvios from './JanelaEnvios'
import '../../../styles/acesso.css'
import './clientes.css'

/** Sugestão de texto para quem ainda não escreveu nenhuma mensagem. */
const SUGESTAO =
  'Olá, {nome}! Aqui é da {empresa}. Hoje, {data}, é o dia da manutenção do seu filtro. Quer agendar a visita?'

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
  const [ultimosAbertos, setUltimosAbertos] = useState(false)
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

  return (
    <div className="pagina tema-clientes">
      <FaixaPagina
        Ilustracao={IlustracaoClientes}
        titulo="Mensagem automática"
        subtitulo="Enviada pelo WhatsApp na data e horário do envio marcados em cada cliente."
        voltar={{ para: '/app/clientes', rotulo: 'Clientes' }}
        acoes={
          <button type="button" className="pagina-botao claro" onClick={() => setUltimosAbertos(true)}>
            <IconeMensagem tamanho={20} />
            Últimos envios
          </button>
        }
      />

      <JanelaEnvios
        aberto={ultimosAbertos}
        titulo="Últimos envios"
        dica="Os últimos 15 clientes que receberam a mensagem automática."
        envios={config.envios}
        mostrarCliente
        onFechar={() => setUltimosAbertos(false)}
      />

      <form className="pagina-secoes" onSubmit={salvar} noValidate>
        <SecaoPagina id="whatsapp-remetente" numero={1} titulo="WhatsApp que envia">
          <div className="erp-form">
            <CampoTexto
              id="whatsapp-remetente"
              rotulo="Número remetente"
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
          <ExtrasMensagem
            idCampo="whatsapp-mensagem"
            valor={mensagem}
            maximo={MAXIMO}
            onChange={(v) => {
              setMensagem(v)
              mudou()
            }}
            imagemUrl={config.imagemId ? urlImagemMensagem(config.imagemId) : null}
            onImagem={async (imagem) => {
              try {
                const { id } = await salvarImagemMensagem(sessao.token, imagem)
                setConfig((c) => c && { ...c, imagemId: id })
                return null
              } catch (erro) {
                return sessaoExpirada(erro) ? null : mensagemDe(erro)
              }
            }}
            onRemoverImagem={async () => {
              try {
                await excluirImagemMensagem(sessao.token)
                setConfig((c) => c && { ...c, imagemId: null })
                return null
              } catch (erro) {
                return sessaoExpirada(erro) ? null : mensagemDe(erro)
              }
            }}
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
          <div className="mensagem-previa">
            <span className="cliente-whatsapp-rotulo">Como o cliente recebe (exemplo com a cliente Maria)</span>
            <BalaoMensagem
              texto={mensagem}
              imagemUrl={config.imagemId ? urlImagemMensagem(config.imagemId) : null}
              nome="Maria"
              empresa={sessao.empresa.nome}
            />
          </div>
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
