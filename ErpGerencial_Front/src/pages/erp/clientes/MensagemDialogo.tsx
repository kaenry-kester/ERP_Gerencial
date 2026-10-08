import { useEffect, useRef, useState } from 'react'
import { IconeCheck } from '../../../components/icones/Icones'
import { MENSAGEM_MAXIMO as MAXIMO, TRECHOS_MENSAGEM as TRECHOS } from './formatos'

type Props = {
  aberto: boolean
  titulo: string
  /** Frase curta embaixo do título. */
  dica: string
  valor: string
  /** Enquanto salva no servidor. */
  salvando?: boolean
  onSalvar: (mensagem: string) => void
  onFechar: () => void
}

// Caixa grande, por cima da tela, para digitar uma mensagem de WhatsApp (a padrão ou a de um cliente).
export default function MensagemDialogo({ aberto, titulo, dica, valor, salvando, onSalvar, onFechar }: Props) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const campo = useRef<HTMLTextAreaElement>(null)
  const [texto, setTexto] = useState(valor)

  useEffect(() => {
    const d = dialogo.current
    if (!d) return
    if (aberto && !d.open) {
      setTexto(valor)
      d.showModal()
      requestAnimationFrame(() => campo.current?.focus())
    } else if (!aberto && d.open) d.close()
    // Só ao abrir/fechar: o texto em edição não deve ser trocado enquanto a caixa está aberta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto])

  const inserir = (trecho: string) => {
    setTexto((t) => `${t}${t && !t.endsWith(' ') ? ' ' : ''}${trecho}`.slice(0, MAXIMO))
    campo.current?.focus()
  }

  return (
    // Esc ou clicar fora fecham sem salvar
    <dialog
      ref={dialogo}
      className="mensagem-dialogo tema-clientes"
      aria-labelledby="mensagem-dialogo-titulo"
      onCancel={(e) => {
        e.preventDefault()
        onFechar()
      }}
      onClick={(e) => e.target === dialogo.current && onFechar()}
    >
      <header className="mensagem-dialogo-topo">
        <h2 id="mensagem-dialogo-titulo">{titulo}</h2>
        <p>{dica}</p>
      </header>

      <div className="mensagem-dialogo-corpo">
        <label htmlFor="mensagem-dialogo-texto" className="sr-only">
          {titulo}
        </label>
        <textarea
          id="mensagem-dialogo-texto"
          ref={campo}
          value={texto}
          maxLength={MAXIMO}
          placeholder="Digite a mensagem que será enviada para o cliente..."
          onChange={(e) => setTexto(e.target.value)}
        />
        <div className="mensagem-dialogo-linha">
          <div className="mensagem-trechos">
            <span>Inserir:</span>
            {TRECHOS.map((t) => (
              <button key={t.trecho} type="button" className="mensagem-trecho" onClick={() => inserir(t.trecho)}>
                {t.rotulo}
              </button>
            ))}
          </div>
          <span className="mensagem-dialogo-contagem">
            {texto.length}/{MAXIMO}
          </span>
        </div>
      </div>

      <footer className="mensagem-dialogo-acoes">
        <button type="button" className="pagina-botao neutro" onClick={onFechar}>
          Cancelar
        </button>
        <button type="button" className="pagina-botao" onClick={() => onSalvar(texto.trim())} disabled={salvando}>
          <IconeCheck tamanho={20} />
          {salvando ? 'Salvando...' : 'Salvar mensagem'}
        </button>
      </footer>
    </dialog>
  )
}
