import { IconeAlerta, IconeCheck } from '../icones/Icones'

export type Aviso = { tipo: 'ok' | 'erro'; texto: string } | null

type Props = {
  /** Id do título, usado no aria-labelledby da seção. */
  id: string
  titulo: string
  /** Versão curta do título para celulares estreitos (o leitor de tela continua lendo a completa). */
  tituloCurto?: string
  aviso: Aviso
}

// Faixa cinza do topo da área branca (tela dividida): a instrução da tela,
// substituída pelo aviso de sucesso (azul) ou de erro (vermelho) quando houver.
export default function FaixaAviso({ id, titulo, tituloCurto, aviso }: Props) {
  return (
    <div className="tela-faixa">
      <h2 id={id} className={aviso ? 'tela-faixa-titulo sr-only' : 'tela-faixa-titulo'}>
        {tituloCurto ? (
          <>
            <span className="faixa-titulo-longo">{titulo}</span>
            <span className="faixa-titulo-curto" aria-hidden="true">
              {tituloCurto}
            </span>
          </>
        ) : (
          titulo
        )}
      </h2>
      <p className={aviso?.tipo === 'erro' ? 'tela-status erro' : 'tela-status'} role="status">
        {aviso && (
          <>
            {aviso.tipo === 'erro' ? <IconeAlerta tamanho={16} /> : <IconeCheck tamanho={16} />}
            {aviso.texto}
          </>
        )}
      </p>
    </div>
  )
}
