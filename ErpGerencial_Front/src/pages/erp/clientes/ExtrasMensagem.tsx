import { useEffect, useRef, useState } from 'react'
import type { EmojiClickEvent } from 'emoji-picker-element/shared'

/**
 * Lista completa de emojis em português (nomes e palavras de busca), da Emojibase/CLDR, servida pelo jsDelivr.
 * O seletor baixa na primeira vez e guarda no navegador (funciona depois mesmo sem internet).
 */
const EMOJIS_PT = 'https://cdn.jsdelivr.net/npm/emoji-picker-element-data@1.8.0/pt/cldr/data.json'

/** A imagem é reduzida no navegador antes de enviar (lado maior), em JPEG. */
const LADO_MAXIMO = 1600

/** Reduz a imagem escolhida (no máximo LADO_MAXIMO px) e devolve em JPEG. */
async function prepararImagem(arquivo: File): Promise<Blob> {
  const imagem = await createImageBitmap(arquivo)
  const escala = Math.min(1, LADO_MAXIMO / Math.max(imagem.width, imagem.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(imagem.width * escala)
  canvas.height = Math.round(imagem.height * escala)
  const ctx = canvas.getContext('2d')!
  // Fundo branco: PNG transparente não fica preto no JPEG
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(imagem, 0, 0, canvas.width, canvas.height)
  imagem.close()
  return new Promise((ok, erro) =>
    canvas.toBlob((b) => (b ? ok(b) : erro(new Error('Não foi possível usar esta imagem'))), 'image/jpeg', 0.85),
  )
}

type Props = {
  /** Id do campo de texto da mensagem (o emoji entra onde está o cursor). */
  idCampo: string
  valor: string
  onChange: (valor: string) => void
  maximo: number
  /** Imagem atual da mensagem; null: sem imagem. */
  imagemUrl: string | null
  /** Recebe a imagem (já reduzida); devolve uma mensagem de erro, se der errado. */
  onImagem: (imagem: Blob) => Promise<string | null>
  onRemoverImagem: () => Promise<string | null>
}

/**
 * Botões grandes de "Emojis" (todos os emojis, com busca em português) e "Imagem" da mensagem automática.
 * O emoji entra no texto onde está o cursor; a imagem vai como foto no WhatsApp, com o texto de legenda.
 */
export default function ExtrasMensagem({ idCampo, valor, onChange, maximo, imagemUrl, onImagem, onRemoverImagem }: Props) {
  const [emojisAbertos, setEmojisAbertos] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const arquivo = useRef<HTMLInputElement>(null)
  const caixa = useRef<HTMLDivElement>(null)
  const lugarDoSeletor = useRef<HTMLDivElement>(null)
  // O seletor de emojis fica aberto enquanto se digita: o emoji escolhido entra sempre no texto atual
  const aoEscolherEmoji = useRef<(emoji: string) => void>(() => {})
  useEffect(() => {
    aoEscolherEmoji.current = (emoji) => {
      const campo = document.getElementById(idCampo) as HTMLTextAreaElement | null
      const inicio = campo?.selectionStart ?? valor.length
      const fim = campo?.selectionEnd ?? valor.length
      const novo = `${valor.slice(0, inicio)}${emoji}${valor.slice(fim)}`
      if (novo.length > maximo) return
      onChange(novo)
      // Cursor logo depois do emoji (dá para escolher vários em seguida)
      requestAnimationFrame(() => campo?.setSelectionRange(inicio + emoji.length, inicio + emoji.length))
    }
  })

  // Clicar fora (ou Esc) fecha os emojis
  useEffect(() => {
    if (!emojisAbertos) return
    const fora = (e: MouseEvent) => !caixa.current?.contains(e.target as Node) && setEmojisAbertos(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setEmojisAbertos(false)
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('keydown', esc)
    }
  }, [emojisAbertos])

  // Monta o seletor de emojis só quando ele é aberto (o código e a lista carregam sob demanda)
  useEffect(() => {
    if (!emojisAbertos) return
    let ativo = true
    const lugar = lugarDoSeletor.current
    Promise.all([import('emoji-picker-element/picker'), import('emoji-picker-element/i18n/pt_BR')]).then(
      ([{ default: Picker }, { default: i18n }]) => {
        if (!ativo || !lugar) return
        const seletor = new Picker({ locale: 'pt', dataSource: EMOJIS_PT, i18n })
        seletor.classList.add('light')
        seletor.addEventListener('emoji-click', (e: EmojiClickEvent) => e.detail.unicode && aoEscolherEmoji.current(e.detail.unicode))
        lugar.replaceChildren(seletor)
      },
    )
    return () => {
      ativo = false
      lugar?.replaceChildren()
    }
  }, [emojisAbertos])

  const escolherImagem = async (lista: FileList | null) => {
    const f = lista?.[0]
    if (arquivo.current) arquivo.current.value = ''
    if (!f) return
    if (!f.type.startsWith('image/')) {
      setErro('Escolha uma imagem (JPG, PNG ou WEBP)')
      return
    }
    setOcupado(true)
    setErro(null)
    try {
      setErro(await onImagem(await prepararImagem(f)))
    } catch {
      setErro('Não foi possível abrir esta imagem. Tente um arquivo JPG ou PNG.')
    } finally {
      setOcupado(false)
    }
  }

  const remover = async () => {
    setOcupado(true)
    setErro(null)
    setErro(await onRemoverImagem())
    setOcupado(false)
  }

  return (
    <div className="mensagem-extras">
      <div className="mensagem-ferramentas" ref={caixa}>
        <button
          type="button"
          className={emojisAbertos ? 'mensagem-ferramenta ativa' : 'mensagem-ferramenta'}
          aria-expanded={emojisAbertos}
          onClick={() => setEmojisAbertos((a) => !a)}
        >
          <span className="mensagem-ferramenta-icone" aria-hidden="true">😀</span>
          <span>
            <strong>Emojis</strong>
            <small>Todos os emojis, com busca</small>
          </span>
        </button>
        <button type="button" className="mensagem-ferramenta" onClick={() => arquivo.current?.click()} disabled={ocupado}>
          <span className="mensagem-ferramenta-icone" aria-hidden="true">🖼️</span>
          <span>
            <strong>{ocupado ? 'Preparando...' : imagemUrl ? 'Trocar imagem' : 'Adicionar imagem'}</strong>
            <small>Vai como foto, com o texto de legenda</small>
          </span>
        </button>
        <input
          ref={arquivo}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => escolherImagem(e.target.files)}
        />
        {emojisAbertos && <div className="mensagem-emojis" ref={lugarDoSeletor} />}
      </div>

      {imagemUrl && (
        <div className="mensagem-imagem">
          <img src={imagemUrl} alt="Imagem da mensagem" />
          <button type="button" className="mensagem-imagem-remover" onClick={remover} disabled={ocupado}>
            Remover imagem
          </button>
        </div>
      )}
      {erro && (
        <p className="mensagem-extras-erro" role="alert">
          {erro}
        </p>
      )}
    </div>
  )
}
