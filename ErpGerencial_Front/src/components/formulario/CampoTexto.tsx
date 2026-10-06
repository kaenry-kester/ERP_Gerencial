import type { HTMLAttributes } from 'react'

type Props = {
  id: string
  rotulo: string
  valor: string
  onChange: (valor: string) => void
  onBlur?: () => void
  erro?: string
  type?: 'text' | 'email' | 'tel'
  placeholder?: string
  autoComplete?: string
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode']
  className?: string
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
}: Props) {
  const idErro = `${id}-erro`

  return (
    <div className={className ? `campo ${className}` : 'campo'}>
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
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-invalid={!!erro}
        aria-describedby={erro ? idErro : undefined}
      />
    </div>
  )
}
