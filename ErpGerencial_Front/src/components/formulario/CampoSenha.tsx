import { useState } from 'react'
import { IconeOlho, IconeOlhoFechado } from '../icones/Icones'

type Props = {
  id: string
  rotulo: string
  valor: string
  onChange: (valor: string) => void
  onBlur?: () => void
  erro?: string
  autoComplete: 'current-password' | 'new-password'
  /** Id de um elemento extra que descreve o campo (ex.: lista de requisitos). */
  descricaoId?: string
  className?: string
}

export default function CampoSenha({
  id,
  rotulo,
  valor,
  onChange,
  onBlur,
  erro,
  autoComplete,
  descricaoId,
  className,
}: Props) {
  const [mostrar, setMostrar] = useState(false)
  const idErro = `${id}-erro`
  const descricao = [descricaoId, erro ? idErro : undefined].filter(Boolean).join(' ') || undefined

  return (
    // "preenchido": usado pelos campos com o rótulo dentro (o rótulo sobe quando há texto)
    <div className={['campo', valor && 'preenchido', className].filter(Boolean).join(' ')}>
      <div className="campo-cabecalho">
        <label htmlFor={id} className="campo-rotulo">
          {rotulo}
        </label>
        {erro && (
          <p id={idErro} className="campo-erro">
            {erro}
          </p>
        )}
      </div>
      <div className="campo-entrada">
        <input
          id={id}
          className="com-botao"
          type={mostrar ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-invalid={!!erro}
          aria-describedby={descricao}
        />
        <button
          type="button"
          className="botao-mostrar-senha"
          onClick={() => setMostrar((v) => !v)}
          aria-pressed={mostrar}
          aria-controls={id}
          aria-label={mostrar ? 'Esconder senha' : 'Mostrar senha'}
        >
          {mostrar ? <IconeOlhoFechado tamanho={18} /> : <IconeOlho tamanho={18} />}
          {/* Em telas estreitas, só o ícone aparece */}
          <span className="botao-mostrar-texto">{mostrar ? 'Esconder' : 'Mostrar'}</span>
        </button>
      </div>
    </div>
  )
}
