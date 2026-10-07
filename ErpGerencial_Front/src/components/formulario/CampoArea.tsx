type Props = {
  id: string
  rotulo: string
  valor: string
  onChange: (valor: string) => void
  erro?: string
  placeholder?: string
  maxLength?: number
  className?: string
}

// Campo de texto com várias linhas (ex.: observação), no mesmo estilo do CampoTexto.
export default function CampoArea({ id, rotulo, valor, onChange, erro, placeholder, maxLength, className }: Props) {
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
      <textarea
        id={id}
        value={valor}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={4}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!erro}
        aria-describedby={erro ? idErro : undefined}
      />
    </div>
  )
}
