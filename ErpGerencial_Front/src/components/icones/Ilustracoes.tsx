// Ilustrações coloridas: botões grandes da tela inicial, faixas das páginas e telas de acesso.
// Produtos, Clientes, Financeiro, Entrar e Cadastro são imagens (public/imgs/ilustracoes);
// as outras ainda são desenhadas aqui em código (SVG).

type Props = {
  tamanho?: number
}

/**
 * Ilustração em imagem: ocupa o mesmo quadrado que os desenhos (tamanho × tamanho) e
 * se encaixa nele sem distorcer (object-fit: contain), mesmo não sendo quadrada.
 */
function Imagem({ arquivo, tamanho }: { arquivo: string; tamanho: number }) {
  return (
    <img
      src={`/imgs/ilustracoes/${arquivo}.png`}
      alt=""
      aria-hidden="true"
      width={tamanho}
      height={tamanho}
      className="ilustracao-imagem"
      draggable={false}
    />
  )
}

/** Sombra suave embaixo dos desenhos. */
const SOMBRA = <ellipse cx="64" cy="116" rx="48" ry="5.5" fill="#0b0a09" opacity="0.12" />

const svg = (tamanho: number) => ({
  width: tamanho,
  height: tamanho,
  viewBox: '0 0 128 128',
  'aria-hidden': true,
})

/** Caixas de papelão com etiqueta (Produtos). */
export function IlustracaoProdutos({ tamanho = 112 }: Props) {
  return <Imagem arquivo="produtos" tamanho={tamanho} />
}

/** Duas pessoas (Clientes). */
export function IlustracaoClientes({ tamanho = 112 }: Props) {
  return <Imagem arquivo="clientes" tamanho={tamanho} />
}

/** Nota de dinheiro e moedas (Financeiro). */
export function IlustracaoFinanceiro({ tamanho = 112 }: Props) {
  return <Imagem arquivo="financeiro" tamanho={tamanho} />
}

/** Porta aberta com seta e cadeado (Entrar). */
export function IlustracaoEntrar({ tamanho = 112 }: Props) {
  return <Imagem arquivo="entrar" tamanho={tamanho} />
}

/** Loja com "+" (Criar conta). */
export function IlustracaoCadastro({ tamanho = 112 }: Props) {
  return <Imagem arquivo="cadastro" tamanho={tamanho} />
}

/** Loja com toldo listrado (base das ilustrações de cadastro e empresa). */
function Loja() {
  const listras = [0, 1, 2, 3, 4, 5, 6]
  return (
    <g>
      <polygon points="20,18 108,18 116,36 12,36" fill="#145369" />
      {listras.map((i) => (
        <g key={i}>
          <rect x={12 + i * 14.86} y="36" width="14.86" height="12" fill={i % 2 ? '#1f7a99' : '#f8f8f8'} />
          <circle cx={19.43 + i * 14.86} cy="48" r="7.43" fill={i % 2 ? '#1f7a99' : '#f8f8f8'} />
        </g>
      ))}
      <rect x="18" y="50" width="92" height="60" fill="#e6d89a" />
      <rect x="18" y="50" width="92" height="6" fill="#0b0a09" opacity="0.08" />
      <rect x="28" y="68" width="24" height="42" rx="2" fill="#8a663b" />
      <circle cx="47" cy="90" r="2" fill="#e6d89a" />
      <rect x="62" y="64" width="38" height="26" rx="2" fill="#e3eef2" />
      <rect x="62" y="64" width="38" height="26" rx="2" fill="none" stroke="#5f4527" strokeWidth="3" />
      <line x1="81" y1="64" x2="81" y2="90" stroke="#5f4527" strokeWidth="3" />
    </g>
  )
}

/** Loja com o cartão do CNPJ na frente (dados da empresa). */
export function IlustracaoEmpresa({ tamanho = 112 }: Props) {
  return (
    <svg {...svg(tamanho)}>
      {SOMBRA}
      <Loja />
      <g transform="rotate(-6 96 98)">
        <rect x="72" y="80" width="50" height="34" rx="4" fill="#f8f8f8" />
        <rect x="72" y="80" width="50" height="9" rx="4" fill="#145369" />
        <rect x="78" y="95" width="30" height="4" rx="2" fill="#5b6670" />
        <rect x="78" y="103" width="22" height="4" rx="2" fill="#cdd4da" />
      </g>
    </svg>
  )
}

/** Equipe de três pessoas com um selo de aprovado (usuários e permissões). */
export function IlustracaoUsuarios({ tamanho = 112 }: Props) {
  return (
    <svg {...svg(tamanho)}>
      {SOMBRA}
      <path d="M8 108a20 20 0 0 1 40 0Z" fill="#5b6670" />
      <circle cx="28" cy="66" r="12" fill="#e2ad83" />
      <path d="M16 64a12 12 0 0 1 24 0c-3-4-7-6-12-6s-9 2-12 6Z" fill="#2a2420" />
      <path d="M80 108a20 20 0 0 1 40 0Z" fill="#8a663b" />
      <circle cx="100" cy="66" r="12" fill="#c98f62" />
      <path d="M88 63a12 12 0 0 1 24 0c-3-5-7-7-12-7s-9 2-12 7Z" fill="#3b2a1f" />
      <path d="M34 114a30 30 0 0 1 60 0Z" fill="#145369" />
      <path d="M56 86h16l-8 10Z" fill="#f8f8f8" />
      <circle cx="64" cy="62" r="17" fill="#f0c39a" />
      <path d="M47 61c0-11 7-19 17-19s17 8 17 19c-4-6-10-9-17-9-6 0-12 3-17 9Z" fill="#5a3b25" />
      <circle cx="98" cy="28" r="17" fill="#e6d89a" />
      <polyline points="89,28 96,35 108,21" fill="none" stroke="#145369" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Pessoa com um escudo e cadeado (minha conta e segurança). */
export function IlustracaoConta({ tamanho = 112 }: Props) {
  return (
    <svg {...svg(tamanho)}>
      {SOMBRA}
      <path d="M14 114a34 34 0 0 1 68 0Z" fill="#145369" />
      <path d="M38 82h20l-10 13Z" fill="#f8f8f8" />
      <circle cx="48" cy="54" r="21" fill="#f0c39a" />
      <path d="M27 53c0-13 9-23 21-23s21 10 21 23c-5-7-13-11-21-11-7 0-15 4-21 11Z" fill="#2a2420" />
      <path d="M92 52l26 10v18c0 17-11 28-26 33-15-5-26-16-26-33V62Z" fill="#8a663b" />
      <path d="M92 58l20 8v14c0 13-8 22-20 26Z" fill="#6c4f2c" />
      <rect x="83" y="78" width="18" height="15" rx="2.5" fill="#e6d89a" />
      <path d="M86.5 78v-4a5.5 5.5 0 0 1 11 0v4" fill="none" stroke="#e6d89a" strokeWidth="3.2" />
      <circle cx="92" cy="85" r="2.4" fill="#5f4527" />
    </svg>
  )
}

/** Cone de obra com uma chave (módulo em construção). */
export function IlustracaoConstrucao({ tamanho = 112 }: Props) {
  return (
    <svg {...svg(tamanho)}>
      {SOMBRA}
      <rect x="26" y="102" width="76" height="10" rx="3" fill="#5f4527" />
      <polygon points="54,16 74,16 94,102 34,102" fill="#8a663b" />
      <polygon points="50,36 78,36 82,52 46,52" fill="#e6d89a" />
      <polygon points="42,68 86,68 90,84 38,84" fill="#e6d89a" />
      <polygon points="54,16 74,16 75,20 53,20" fill="#6c4f2c" />
      <g transform="rotate(35 100 50)">
        <rect x="95" y="34" width="10" height="56" rx="4" fill="#145369" />
        <path d="M100 14a14 14 0 0 1 12 21h-24a14 14 0 0 1 12-21Z" fill="#1f7a99" />
        <rect x="96" y="14" width="8" height="12" fill="#f8f8f8" />
      </g>
    </svg>
  )
}
