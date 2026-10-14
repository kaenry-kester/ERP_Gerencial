import type { HTMLAttributes } from 'react'
import './ficha.css'

type Props = {
  id: string
  rotulo: string
  valor: string
  onChange: (valor: string) => void
  erro?: string
  obrigatorio?: boolean
  type?: 'text' | 'tel' | 'date' | 'time' | 'datetime-local'
  /** Data mínima (campos de data), ex.: "2026-10-14". */
  min?: string
  /** Texto longo (ex.: observação): vira uma caixa de texto com esse número de linhas. */
  linhas?: number
  /** Com opções, vira uma lista de escolha (select). */
  opcoes?: { valor: string; rotulo: string }[]
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode']
  placeholder?: string
  maxLength?: number
  /** Id de um <datalist> com sugestões. */
  lista?: string
  /** Colunas da ficha (ex.: "c9") e "do-cep" (preenchido pela busca do CEP). */
  className?: string
  /** Imagem pequena à esquerda do campo (ex.: "/imgs/whatsapp.png"). */
  icone?: string
}

/**
 * Campo da ficha de cadastro (clientes e produtos): rótulo em negrito em cima e o campo numa caixa retangular,
 * como num formulário impresso (ver ficha.css).
 */
export default function CampoFicha({
  id,
  rotulo,
  valor,
  onChange,
  erro,
  obrigatorio,
  type = 'text',
  inputMode,
  placeholder,
  maxLength,
  lista,
  opcoes,
  linhas,
  className,
  icone,
  min,
}: Props) {
  const idErro = `${id}-erro`
  const campoTexto = (
    <input
      id={id}
      type={type}
      value={valor}
      inputMode={inputMode}
      placeholder={placeholder}
      maxLength={maxLength}
      min={min}
      list={lista}
      autoComplete="off"
      required={obrigatorio}
      aria-invalid={!!erro}
      aria-describedby={erro ? idErro : undefined}
      onChange={(e) => onChange(e.target.value)}
      // Data e horário: clicar em qualquer parte da caixa abre o seletor (não só no ícone)
      onClick={
        type === 'text' || type === 'tel'
          ? undefined
          : (e) => {
              try {
                e.currentTarget.showPicker()
              } catch {
                // Navegador sem showPicker: continua abrindo pelo ícone
              }
            }
      }
    />
  )
  return (
    <div className={['ficha-campo', erro && 'com-erro', className].filter(Boolean).join(' ')}>
      <div className="ficha-cabecalho">
        <label htmlFor={id} className="ficha-rotulo">
          {rotulo}
          {obrigatorio && (
            <span className="ficha-obrigatorio" aria-hidden="true">
              {' '}*
            </span>
          )}
        </label>
        {erro && (
          <span id={idErro} className="ficha-erro">
            {erro}
          </span>
        )}
      </div>
      {linhas ? (
        <textarea
          id={id}
          rows={linhas}
          value={valor}
          placeholder={placeholder}
          maxLength={maxLength}
          aria-invalid={!!erro}
          aria-describedby={erro ? idErro : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : opcoes ? (
        <select id={id} value={valor} aria-invalid={!!erro} aria-describedby={erro ? idErro : undefined} onChange={(e) => onChange(e.target.value)}>
          {opcoes.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.rotulo}
            </option>
          ))}
        </select>
      ) : icone ? (
        <div className="ficha-com-icone">
          <img src={icone} alt="" aria-hidden="true" />
          {campoTexto}
        </div>
      ) : (
        campoTexto
      )}
    </div>
  )
}
