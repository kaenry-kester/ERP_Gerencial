import { useEffect, useRef } from 'react'
import { IconeCheck } from '../../../components/icones/Icones'
import EditorMensagem from './EditorMensagem'

type Props = {
  aberto: boolean
  onFechar: () => void
  /** Texto da mensagem deste cliente (vazio: ele recebe a mensagem padrão). */
  texto: string
  onTexto: (texto: string) => void
  /** Imagem desta mensagem (a salva ou a recém-escolhida); null: sem imagem. */
  imagemUrl: string | null
  onImagem: (imagem: Blob) => void
  onRemoverImagem: () => void
  /** Mensagem padrão da empresa (prévia quando o cliente não tem texto próprio). */
  padrao: { texto: string; imagemUrl: string | null } | null
  nomeCliente: string
  empresa: string
  /** Dia e hora do próximo envio (para a prévia); sem: agora. */
  envio: Date | null
}

const ID_CAMPO = 'cliente-mensagem'

/**
 * Janela da mensagem de WhatsApp de um cliente, aberta pelo cadastro (Editar cliente), com o mesmo editor da mensagem
 * padrão (EditorMensagem). As mudanças valem quando o cadastro é salvo.
 */
export default function JanelaMensagem(props: Props) {
  const { aberto, onFechar, texto, onTexto, imagemUrl, onImagem, onRemoverImagem, padrao, nomeCliente, empresa, envio } = props
  const janela = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = janela.current
    if (!d) return
    if (aberto && !d.open) {
      d.showModal()
      requestAnimationFrame(() => document.getElementById(ID_CAMPO)?.focus())
    } else if (!aberto && d.open) d.close()
  }, [aberto])

  // Sem texto próprio, o cliente recebe a mensagem padrão (com a imagem desta mensagem, se tiver; senão a da padrão)
  const usaPadrao = !texto.trim()

  return (
    // Esc, o botão de fechar ou clicar fora da janela fecham (o que foi escrito continua no cadastro)
    <dialog
      ref={janela}
      className="janela-envios janela-mensagem tema-clientes"
      aria-labelledby="janela-mensagem-titulo"
      onCancel={(e) => {
        e.preventDefault()
        onFechar()
      }}
      onClick={(e) => e.target === janela.current && onFechar()}
    >
      <header className="janela-envios-topo">
        <div>
          <h2 id="janela-mensagem-titulo">Mensagem do WhatsApp</h2>
          <p>Enviada automaticamente para {nomeCliente || 'este cliente'} nas datas do calendário.</p>
        </div>
        <button type="button" className="janela-envios-fechar" onClick={onFechar} aria-label="Fechar">
          ×
        </button>
      </header>

      <div className="janela-envios-corpo">
        <EditorMensagem
          idCampo={ID_CAMPO}
          rotulo="Mensagem para este cliente"
          placeholder="Deixe vazio para enviar a mensagem padrão da empresa."
          texto={texto}
          onTexto={onTexto}
          imagemUrl={imagemUrl}
          onImagem={async (imagem) => {
            onImagem(imagem)
            return null
          }}
          onRemoverImagem={async () => {
            onRemoverImagem()
            return null
          }}
          previa={{
            rotulo: usaPadrao ? 'Como o cliente recebe (mensagem padrão)' : 'Como o cliente recebe',
            texto: usaPadrao ? (padrao?.texto ?? '') : texto,
            imagemUrl: imagemUrl ?? (usaPadrao ? (padrao?.imagemUrl ?? null) : null),
          }}
          nomeCliente={nomeCliente || 'Maria'}
          empresa={empresa}
          envio={envio}
        />
      </div>

      <footer className="janela-mensagem-rodape">
        {!usaPadrao && (
          <button type="button" className="pagina-botao neutro" onClick={() => onTexto('')}>
            Usar a mensagem padrão
          </button>
        )}
        <button type="button" className="pagina-botao" onClick={onFechar}>
          <IconeCheck tamanho={20} />
          Concluir
        </button>
      </footer>
    </dialog>
  )
}
