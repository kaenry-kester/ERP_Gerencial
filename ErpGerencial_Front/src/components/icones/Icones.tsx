// Ícones de linha (SVG, na cor do texto). O IconeCadastro é uma imagem (public/imgs/ilustracoes).

type IconeProps = {
  tamanho?: number
}

const base = (tamanho: number) => ({
  width: tamanho,
  height: tamanho,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
})

export function IconeLogin({ tamanho = 24 }: IconeProps) {
  return (
    <svg {...base(tamanho)}>
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" y1="12" x2="3" y2="12" />
    </svg>
  )
}

/** Pessoa com "+" (Criar conta, Novo usuário): imagem, no mesmo quadrado do ícone. */
export function IconeCadastro({ tamanho = 24 }: IconeProps) {
  return (
    <img
      src="/imgs/ilustracoes/novo-usuario.png"
      alt=""
      aria-hidden="true"
      width={tamanho}
      height={tamanho}
      className="ilustracao-imagem"
      draggable={false}
    />
  )
}

export function IconeVoltar({ tamanho = 24 }: IconeProps) {
  return (
    <svg {...base(tamanho)}>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  )
}

export function IconeOlho({ tamanho = 24 }: IconeProps) {
  return (
    <svg {...base(tamanho)}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export function IconeOlhoFechado({ tamanho = 24 }: IconeProps) {
  return (
    <svg {...base(tamanho)}>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

export function IconeSeta({ tamanho = 24 }: IconeProps) {
  return (
    <svg {...base(tamanho)}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  )
}

export function IconeCheck({ tamanho = 24 }: IconeProps) {
  return (
    <svg {...base(tamanho)} strokeWidth={3}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export function IconeAlerta({ tamanho = 24 }: IconeProps) {
  return (
    <svg {...base(tamanho)} strokeWidth={2.5}>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="7.5" x2="12" y2="12.5" />
      <line x1="12" y1="16.5" x2="12" y2="16.5" />
    </svg>
  )
}

export function IconePendente({ tamanho = 24 }: IconeProps) {
  return (
    <svg {...base(tamanho)}>
      <circle cx="12" cy="12" r="4" />
    </svg>
  )
}

export function IconeLoja({ tamanho = 24 }: IconeProps) {
  return (
    <svg {...base(tamanho)}>
      <path d="M4 9.5 5.5 4h13L20 9.5" />
      <path d="M4 9.5a2.67 2.67 0 0 0 5.33 0 2.67 2.67 0 0 0 5.34 0 2.67 2.67 0 0 0 5.33 0" />
      <path d="M5.5 12.5V20h13v-7.5" />
      <path d="M10 20v-4.5h4V20" />
    </svg>
  )
}

export function IconeCaixa({ tamanho = 24 }: IconeProps) {
  return (
    <svg {...base(tamanho)}>
      <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
      <polyline points="3 8 12 13 21 8" />
      <line x1="12" y1="13" x2="12" y2="21" />
    </svg>
  )
}

export function IconeClientes({ tamanho = 24 }: IconeProps) {
  return (
    <svg {...base(tamanho)}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" />
      <path d="M18.5 14.3A6.5 6.5 0 0 1 21.5 20" />
    </svg>
  )
}

export function IconeCracha({ tamanho = 24 }: IconeProps) {
  return (
    <svg {...base(tamanho)}>
      <rect x="3" y="5" width="18" height="15" rx="2" />
      <circle cx="9" cy="11.5" r="2.5" />
      <path d="M5.5 17.5a3.5 3.5 0 0 1 7 0" />
      <line x1="15" y1="10" x2="18" y2="10" />
      <line x1="15" y1="14" x2="18" y2="14" />
    </svg>
  )
}

export function IconeCarteira({ tamanho = 24 }: IconeProps) {
  return (
    <svg {...base(tamanho)}>
      <path d="M19 7V5a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V6" />
      <circle cx="16.5" cy="14" r="1.2" />
    </svg>
  )
}

export function IconeUsuario({ tamanho = 24 }: IconeProps) {
  return (
    <svg {...base(tamanho)}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  )
}

export function IconeLixeira({ tamanho = 24 }: IconeProps) {
  return (
    <svg {...base(tamanho)}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

export function IconeBusca({ tamanho = 24 }: IconeProps) {
  return (
    <svg {...base(tamanho)}>
      <circle cx="11" cy="11" r="7" />
      <line x1="16.5" y1="16.5" x2="21" y2="21" />
    </svg>
  )
}

export function IconeLapis({ tamanho = 24 }: IconeProps) {
  return (
    <svg {...base(tamanho)}>
      <path d="M4 20h4L19 9a2.83 2.83 0 0 0-4-4L4 16v4Z" />
      <line x1="13.5" y1="6.5" x2="17.5" y2="10.5" />
    </svg>
  )
}

export function IconeMensagem({ tamanho = 24 }: IconeProps) {
  return (
    <svg {...base(tamanho)}>
      <path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.4L3 21l2.1-5.6A8.4 8.4 0 1 1 21 11.5Z" />
      <line x1="8.5" y1="11.5" x2="15.5" y2="11.5" />
    </svg>
  )
}

export function IconeMais({ tamanho = 24 }: IconeProps) {
  return (
    <svg {...base(tamanho)} strokeWidth={2.5}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}
