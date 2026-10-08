import type { HTMLAttributes } from 'react'

type Props = {
  id: string
  rotulo: string
  valor: string
  onChange: (valor: string) => void
  onBlur?: () => void
  erro?: string
  type?: 'text' | 'email' | 'tel' | 'datetime-local'
  placeholder?: string
  autoComplete?: string
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode']
  className?: string
  /** Id de um <datalist> com sugestões (a pessoa pode escolher ou digitar outra coisa). */
  lista?: string
  maxLength?: number
}

export default function CampoTexto({
  id,
  rotulo,
  valor,
  onChange,
  onBlur,
  erro,
  type = 'text',
  placeholder,
  autoComplete,
  inputMode,
  className,
  lista,
  maxLength,
}: Props) {
  const idErro = `${id}-erro`

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
      <input
        id={id}
        type={type}
        value={valor}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        list={lista}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-invalid={!!erro}
        aria-describedby={erro ? idErro : undefined}
      />
    </div>
  )
}
