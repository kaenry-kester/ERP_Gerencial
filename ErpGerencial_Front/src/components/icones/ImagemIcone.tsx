import { useState, type ReactNode } from 'react'

type Props = {
  src: string
  /** Ícone mostrado enquanto a imagem não carrega ou caso ela ainda não exista na pasta */
  reserva: ReactNode
  className?: string
}

// A imagem é decorativa: o texto do botão já descreve a ação.
// Ela só aparece depois de carregar com sucesso, então nunca surge o ícone de "imagem quebrada".
export default function ImagemIcone({ src, reserva, className }: Props) {
  const [carregou, setCarregou] = useState(false)
  const [falhou, setFalhou] = useState(false)

  return (
    <>
      {!carregou && (
        <span className={className} aria-hidden="true">
          {reserva}
        </span>
      )}
      {!falhou && (
        <img
          src={src}
          alt=""
          className={className}
          hidden={!carregou}
          onLoad={() => setCarregou(true)}
          onError={() => setFalhou(true)}
        />
      )}
    </>
  )
}
