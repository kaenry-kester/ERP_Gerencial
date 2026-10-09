type Props = {
  id: string
  rotulo: string
  valor: string
  onChange: (valor: string) => void
  opcoes: { valor: string; rotulo: string }[]
  erro?: string
  className?: string
}

// Lista de opções (select) no mesmo estilo dos campos de texto, com o rótulo sempre em cima.
export default function CampoSelecao({ id, rotulo, valor, onChange, opcoes, erro, className }: Props) {
  const idErro = `${id}-erro`
  return (
    <div className={['campo', 'preenchido', className].filter(Boolean).join(' ')}>
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
      <select
        id={id}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!erro}
        aria-describedby={erro ? idErro : undefined}
      >
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
    </div>
  )
}
