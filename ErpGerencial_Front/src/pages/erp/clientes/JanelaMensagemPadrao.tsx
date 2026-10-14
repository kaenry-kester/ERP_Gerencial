import { useEffect, useRef, useState } from 'react'
import CampoTexto from '../../../components/formulario/CampoTexto'
import type { Aviso } from '../../../components/formulario/FaixaAviso'
import { IconeCheck, IconeMensagem } from '../../../components/icones/Icones'
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
import EditorMensagem from './EditorMensagem'
import JanelaEnvios from './JanelaEnvios'

/** Sugestão de texto para quem ainda não escreveu nenhuma mensagem. */
const SUGESTAO =
  'Olá, {nome}! Aqui é da {empresa}. Hoje, {data}, é o dia da manutenção do seu filtro. Quer agendar a visita?'

const ID_CAMPO = 'whatsapp-mensagem'

type Props = { aberto: boolean; onFechar: () => void }

/**
 * Mensagem automática padrão da empresa (botão "Inserir mensagem automática" da lista de clientes), na mesma janela e
 * com o mesmo editor da mensagem de cada cliente (EditorMensagem): o número que envia, o texto, emojis e imagem, e a
 * prévia. Vale para todos os clientes que não têm mensagem própria.
 */
export default function JanelaMensagemPadrao({ aberto, onFechar }: Props) {
  const { sessao } = useErp()
  const sessaoExpirada = useSessaoExpirada()
  const janela = useRef<HTMLDialogElement>(null)
  const [config, setConfig] = useState<ConfiguracaoWhatsapp | null>(null)
  const [remetente, setRemetente] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [erroRemetente, setErroRemetente] = useState<string>()
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState<Aviso>(null)
  const [ultimosAbertos, setUltimosAbertos] = useState(false)

  const aplicar = (c: ConfiguracaoWhatsapp) => {
    setConfig(c)
    setRemetente(formatarTelefone(c.remetente ?? ''))
    setMensagem(c.mensagem ?? SUGESTAO)
  }

  useEffect(() => {
    const d = janela.current
    if (!d) return
    if (aberto && !d.open) d.showModal()
    else if (!aberto && d.open) d.close()
  }, [aberto])

  // Carrega a mensagem atual sempre que a janela abre
  useEffect(() => {
    if (!aberto) return
    let ativo = true
    setConfig(null)
    setAviso(null)
    setErroRemetente(undefined)
    obterWhatsapp(sessao.token)
      .then((c) => {
        if (!ativo) return
        aplicar(c)
        requestAnimationFrame(() => document.getElementById(ID_CAMPO)?.focus())
      })
      .catch((e) => ativo && !sessaoExpirada(e) && setAviso({ tipo: 'erro', texto: mensagemDe(e) }))
    return () => {
      ativo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, sessao.token])

  const salvar = async () => {
    if (salvando) return
    if (remetente && !telefoneValido(remetente)) {
      setErroRemetente('Incompleto')
      document.getElementById('whatsapp-remetente')?.focus()
      return
    }
    setSalvando(true)
    setAviso(null)
    try {
      aplicar(await salvarWhatsapp(sessao.token, { remetente, mensagem }))
      onFechar()
    } catch (erro) {
      if (sessaoExpirada(erro)) return
      if (erro instanceof ErroApi && erro.campo === 'remetente') setErroRemetente(erro.message)
      setAviso({ tipo: 'erro', texto: mensagemDe(erro) })
    } finally {
      setSalvando(false)
    }
  }

  // A imagem é salva na hora (o texto, no "Salvar")
  const trocarImagem = async (imagem: Blob | null) => {
    try {
      if (imagem) {
        const { id } = await salvarImagemMensagem(sessao.token, imagem)
        setConfig((c) => c && { ...c, imagemId: id })
      } else {
        await excluirImagemMensagem(sessao.token)
        setConfig((c) => c && { ...c, imagemId: null })
      }
      return null
    } catch (erro) {
      return sessaoExpirada(erro) ? null : mensagemDe(erro)
    }
  }

  const imagemUrl = config?.imagemId ? urlImagemMensagem(config.imagemId) : null

  return (
    // Esc, o botão de fechar ou clicar fora da janela fecham sem salvar o texto
    <dialog
      ref={janela}
      className="janela-envios janela-mensagem tema-clientes"
      aria-labelledby="janela-mensagem-padrao-titulo"
      onCancel={(e) => {
        e.preventDefault()
        onFechar()
      }}
      onClick={(e) => e.target === janela.current && onFechar()}
    >
      <header className="janela-envios-topo">
        <div>
          <h2 id="janela-mensagem-padrao-titulo">Mensagem automática</h2>
          <p>Enviada pelo WhatsApp a todos os clientes sem mensagem própria, nas datas do calendário de cada um.</p>
        </div>
        <button type="button" className="janela-envios-fechar" onClick={onFechar} aria-label="Fechar">
          ×
        </button>
      </header>

      <div className="janela-envios-corpo">
        {!config ? (
          aviso ? <AvisoPagina aviso={aviso} /> : <p className="erp-carregando">Carregando...</p>
        ) : (
          <EditorMensagem
            idCampo={ID_CAMPO}
            rotulo="Mensagem padrão"
            texto={mensagem}
            onTexto={(t) => {
              setMensagem(t)
              setAviso(null)
            }}
            imagemUrl={imagemUrl}
            onImagem={(imagem) => trocarImagem(imagem)}
            onRemoverImagem={() => trocarImagem(null)}
            previa={{ rotulo: 'Como o cliente recebe (exemplo com a cliente Maria)', texto: mensagem, imagemUrl }}
            nomeCliente="Maria"
            empresa={sessao.empresa.nome}
            topo={
              <CampoTexto
                id="whatsapp-remetente"
                rotulo="WhatsApp que envia (número remetente)"
                type="tel"
                inputMode="numeric"
                placeholder="(16) 99103-9268"
                autoComplete="off"
                valor={remetente}
                onChange={(v) => {
                  setRemetente(formatarTelefone(v))
                  setErroRemetente(undefined)
                  setAviso(null)
                }}
                erro={erroRemetente}
              />
            }
          />
        )}
      </div>

      <footer className="janela-mensagem-rodape">
        <button type="button" className="pagina-botao neutro janela-mensagem-esquerda" onClick={() => setUltimosAbertos(true)}>
          <IconeMensagem tamanho={20} />
          Últimos envios
        </button>
        {aviso && config && <AvisoPagina aviso={aviso} />}
        <button type="button" className="pagina-botao neutro" onClick={onFechar}>
          Cancelar
        </button>
        <button type="button" className="pagina-botao" onClick={salvar} disabled={salvando || !config}>
          <IconeCheck tamanho={20} />
          {salvando ? 'Salvando...' : 'Salvar'}
        </button>
      </footer>

      <JanelaEnvios
        aberto={ultimosAbertos}
        titulo="Últimos envios"
        dica="Os últimos 15 clientes que receberam a mensagem automática."
        envios={config?.envios ?? []}
        mostrarCliente
        onFechar={() => setUltimosAbertos(false)}
      />
    </dialog>
  )
}
