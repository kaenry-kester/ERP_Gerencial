import './ficha.css'

type Props = {
  rotulo: string
  /** Vazio aparece como "—". */
  valor: string | null | undefined
  /** Colunas da ficha (ex.: "c9"), como no CampoFicha. */
  className?: string
  /** Imagem pequena à esquerda do valor (ex.: "/imgs/whatsapp.png"). */
  icone?: string
  /** Texto longo (ex.: observação): caixa mais alta, com quebra de linha. */
  linhas?: number
}

/**
 * Campo da ficha só para ver (páginas de detalhes do cliente e do produto): o mesmo rótulo em negrito e a mesma
 * caixa retangular do CampoFicha do cadastro, com o valor salvo dentro.
 */
export default function ValorFicha({ rotulo, valor, className, icone, linhas }: Props) {
  const texto = valor?.trim() ? valor : '—'
  return (
    <div className={['ficha-campo', className].filter(Boolean).join(' ')}>
      <div className="ficha-cabecalho">
        <span className="ficha-rotulo">{rotulo}</span>
      </div>
      <div
        className={linhas ? 'ficha-valor longo' : 'ficha-valor'}
        style={linhas ? { minHeight: `${linhas * 1.3 + 0.6}em` } : undefined}
        title={linhas ? undefined : texto}
      >
        {icone && <img src={icone} alt="" aria-hidden="true" />}
        <span>{texto}</span>
      </div>
    </div>
  )
}
