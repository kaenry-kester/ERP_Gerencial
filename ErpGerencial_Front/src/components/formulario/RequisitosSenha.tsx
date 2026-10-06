import { requisitosSenha } from '../../utils/validacao'
import { IconeCheck, IconePendente } from '../icones/Icones'
import './requisitos-senha.css'

type Props = {
  /** Id usado no aria-describedby do campo de senha. */
  id: string
  senha: string
  className?: string
}

// Lista dos requisitos da senha, marcando em azul os que já foram atendidos.
export default function RequisitosSenha({ id, senha, className }: Props) {
  return (
    <div className={className ? `requisitos ${className}` : 'requisitos'} id={id}>
      <p className="requisitos-titulo">A senha precisa ter:</p>
      <ul className="requisitos-lista">
        {requisitosSenha(senha).map((requisito) => (
          <li key={requisito.id} className={requisito.atendido ? 'requisito atendido' : 'requisito'}>
            <span className="requisito-icone">
              {requisito.atendido ? <IconeCheck tamanho={14} /> : <IconePendente tamanho={14} />}
            </span>
            <span className="requisito-texto">{requisito.texto}</span>
            <span className="requisito-texto-curto" aria-hidden="true">
              {requisito.textoCurto}
            </span>
            <span className="sr-only">{requisito.atendido ? ' — ok' : ' — pendente'}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
