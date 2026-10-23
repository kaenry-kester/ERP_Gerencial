import type { ReactNode } from 'react'
import CampoArea from '../../../components/formulario/CampoArea'
import BalaoMensagem from './BalaoMensagem'
import ExtrasMensagem from './ExtrasMensagem'
import { MENSAGEM_MAXIMO, TRECHOS_MENSAGEM } from './formatos'

type Props = {
  /** Id do campo de texto (o emoji e os trechos entram onde está o cursor). */
  idCampo: string
  rotulo: string
  placeholder?: string
  texto: string
  onTexto: (texto: string) => void
  erro?: string
  /** Imagem desta mensagem; null: sem imagem. */
  imagemUrl: string | null
  /** Recebe a imagem (já reduzida); devolve uma mensagem de erro, se der errado. */
  onImagem: (imagem: Blob) => Promise<string | null>
  onRemoverImagem: () => Promise<string | null>
  /** O que aparece na prévia (pode ser outra mensagem, ex.: a padrão quando o cliente não tem texto próprio). */
  previa: { rotulo: string; texto: string; imagemUrl: string | null }
  nomeCliente: string
  empresa: string
  /** Dia e hora do envio (para a prévia); sem: agora. */
  envio?: Date | null
  /** Conteúdo acima do texto (ex.: o número que envia, na mensagem padrão). */
  topo?: ReactNode
}

/**
 * Editor da mensagem de WhatsApp, igual na mensagem padrão (Clientes → Mensagem automática) e na mensagem de cada
 * cliente (Editar cliente): à esquerda o texto, os trechos ({nome}, {data}, {empresa}), Emojis e Imagem; à direita a
 * prévia como o cliente recebe.
 */
export default function EditorMensagem(props: Props) {
  const { idCampo, rotulo, placeholder, texto, onTexto, erro, imagemUrl, onImagem, onRemoverImagem, previa } = props

  const inserir = (trecho: string) => {
    const campo = document.getElementById(idCampo) as HTMLTextAreaElement | null
    const inicio = campo?.selectionStart ?? texto.length
    const fim = campo?.selectionEnd ?? texto.length
    const novo = `${texto.slice(0, inicio)}${trecho}${texto.slice(fim)}`
    if (novo.length > MENSAGEM_MAXIMO) return
    onTexto(novo)
    requestAnimationFrame(() => {
      campo?.focus()
      campo?.setSelectionRange(inicio + trecho.length, inicio + trecho.length)
    })
  }

  return (
    <div className="editor-mensagem">
      {/* Escrever */}
      <section className="editor-mensagem-coluna" aria-label="Escrever a mensagem">
        {props.topo}
        <CampoArea
          id={idCampo}
          rotulo={rotulo}
          placeholder={placeholder}
          maxLength={MENSAGEM_MAXIMO}
          valor={texto}
          onChange={onTexto}
          erro={erro}
        />
        <div className="janela-mensagem-linha">
          <div className="mensagem-trechos">
            <span>Inserir:</span>
            {TRECHOS_MENSAGEM.map((t) => (
              <button key={t.trecho} type="button" className="mensagem-trecho" onClick={() => inserir(t.trecho)}>
                {t.rotulo}
              </button>
            ))}
          </div>
          <span className="janela-mensagem-contagem">
            {texto.length}/{MENSAGEM_MAXIMO}
          </span>
        </div>
        <ExtrasMensagem
          idCampo={idCampo}
          valor={texto}
          onChange={onTexto}
          maximo={MENSAGEM_MAXIMO}
          imagemUrl={imagemUrl}
          onImagem={onImagem}
          onRemoverImagem={onRemoverImagem}
        />
      </section>

      {/* Como o cliente recebe */}
      <section className="editor-mensagem-coluna" aria-label="Como o cliente recebe">
        <span className="cliente-whatsapp-rotulo">{previa.rotulo}</span>
        <BalaoMensagem
          texto={previa.texto}
          imagemUrl={previa.imagemUrl}
          nome={props.nomeCliente}
          empresa={props.empresa}
          envio={props.envio}
        />
      </section>
    </div>
  )
}
