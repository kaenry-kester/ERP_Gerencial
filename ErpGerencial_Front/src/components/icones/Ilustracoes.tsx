// Ilustrações coloridas dos botões grandes da tela inicial do ERP.
// Para trocar por imagens próprias, coloque public/imgs/modulos/<id>.png (ex.: produtos.png):
// a tela inicial usa a imagem quando ela existe e estas ilustrações enquanto isso.

type Props = {
  tamanho?: number
}

const svg = (tamanho: number) => ({
  width: tamanho,
  height: tamanho,
  viewBox: '0 0 128 128',
  'aria-hidden': true,
})

/** Caixas de papelão (mesmas cores da caixa do logo Órion) com etiqueta de preço. */
export function IlustracaoProdutos({ tamanho = 112 }: Props) {
  return (
    <svg {...svg(tamanho)}>
      <ellipse cx="66" cy="114" rx="50" ry="6" fill="#0b0a09" opacity="0.12" />

      {/* Caixa de trás */}
      <polygon points="18,56 66,56 66,108 18,108" fill="#8a663b" />
      <polygon points="18,56 34,40 82,40 66,56" fill="#b0844f" />
      <polygon points="66,56 82,40 82,92 66,108" fill="#6c4f2c" />
      <polygon points="36,56 52,40 60,40 44,56" fill="#e6d89a" />
      <rect x="36" y="56" width="8" height="52" fill="#e6d89a" />
      <rect x="36" y="56" width="8" height="52" fill="#0b0a09" opacity="0.08" />

      {/* Caixa da frente */}
      <polygon points="58,78 100,78 100,112 58,112" fill="#9b7445" />
      <polygon points="58,78 70,66 112,66 100,78" fill="#c09159" />
      <polygon points="100,78 112,66 112,100 100,112" fill="#76572f" />
      <polygon points="75,78 87,66 94,66 82,78" fill="#ede1a6" />
      <rect x="75" y="78" width="7" height="34" fill="#ede1a6" />
      <rect x="64" y="96" width="14" height="9" rx="1.5" fill="#f8f8f8" opacity="0.85" />

      {/* Etiqueta de preço */}
      <g transform="rotate(-24 34 26)">
        <path d="M14 16h28l11 11-11 11H14a3 3 0 0 1-3-3V19a3 3 0 0 1 3-3Z" fill="#1f7a99" />
        <path d="M14 16h28l11 11-11 11H14a3 3 0 0 1-3-3V19a3 3 0 0 1 3-3Z" fill="#145369" opacity="0.35" transform="translate(0 2)" />
        <circle cx="19" cy="27" r="3.2" fill="#f8f8f8" />
        <rect x="26" y="22" width="16" height="3.5" rx="1.5" fill="#f8f8f8" opacity="0.9" />
        <rect x="26" y="29" width="11" height="3.5" rx="1.5" fill="#f8f8f8" opacity="0.7" />
      </g>
    </svg>
  )
}

/** Duas pessoas (clientes) com um cartão de contato. */
export function IlustracaoClientes({ tamanho = 112 }: Props) {
  return (
    <svg {...svg(tamanho)}>
      <ellipse cx="64" cy="114" rx="50" ry="6" fill="#0b0a09" opacity="0.12" />

      {/* Pessoa de trás */}
      <path d="M14 104a26 26 0 0 1 52 0v6H14Z" fill="#5b6670" />
      <circle cx="40" cy="48" r="15" fill="#e2ad83" />
      <path d="M25 47a15 15 0 0 1 30 0c-4-6-10-8-15-8s-11 2-15 8Z" fill="#2a2420" />

      {/* Pessoa da frente */}
      <path d="M40 112a32 32 0 0 1 64 0Z" fill="#145369" />
      <path d="M62 82h20l-10 13Z" fill="#f8f8f8" />
      <path d="M68 82h8l-4 6Z" fill="#1f7a99" />
      <circle cx="72" cy="56" r="19" fill="#f0c39a" />
      <path d="M53 55c0-12 8-21 19-21s19 9 19 21c-5-7-12-10-19-10-4 0-8 1-11 3-3 2-6 4-8 7Z" fill="#5a3b25" />

      {/* Cartão de contato */}
      <g transform="rotate(8 104 34)">
        <rect x="86" y="18" width="36" height="28" rx="4" fill="#f8f8f8" />
        <rect x="86" y="18" width="36" height="28" rx="4" fill="none" stroke="#cdd4da" strokeWidth="1.5" />
        <circle cx="96" cy="30" r="5" fill="#1f7a99" />
        <path d="M90 41a6 6 0 0 1 12 0Z" fill="#1f7a99" />
        <rect x="105" y="26" width="13" height="3" rx="1.5" fill="#5b6670" />
        <rect x="105" y="32" width="10" height="3" rx="1.5" fill="#cdd4da" />
        <rect x="105" y="38" width="12" height="3" rx="1.5" fill="#cdd4da" />
      </g>
    </svg>
  )
}

/** Nota de dinheiro, pilha de moedas e gráfico subindo. */
export function IlustracaoFinanceiro({ tamanho = 112 }: Props) {
  // Pilha de moedas: de baixo para cima
  const moedas = [0, 1, 2, 3].map((i) => 104 - i * 9)
  return (
    <svg {...svg(tamanho)}>
      <ellipse cx="64" cy="114" rx="50" ry="6" fill="#0b0a09" opacity="0.12" />

      {/* Nota de dinheiro */}
      <g transform="rotate(-14 52 58)">
        <rect x="12" y="38" width="80" height="44" rx="5" fill="#3f9a5b" />
        <rect x="18" y="44" width="68" height="32" rx="3" fill="none" stroke="#8fd3a5" strokeWidth="2" />
        <circle cx="52" cy="60" r="10" fill="#8fd3a5" />
        <text x="52" y="65.5" textAnchor="middle" fontSize="15" fontWeight="700" fill="#2c7a45" fontFamily="Lexend, sans-serif">
          $
        </text>
        <circle cx="26" cy="60" r="3" fill="#8fd3a5" />
        <circle cx="78" cy="60" r="3" fill="#8fd3a5" />
      </g>

      {/* Moedas */}
      {moedas.map((y) => (
        <g key={y}>
          <path d={`M68 ${y}v6a20 7 0 0 0 40 0v-6Z`} fill="#c8922c" />
          <ellipse cx="88" cy={y} rx="20" ry="7" fill="#f2c94c" />
          <ellipse cx="88" cy={y} rx="14" ry="4.5" fill="none" stroke="#d9a637" strokeWidth="1.5" />
        </g>
      ))}

      {/* Gráfico subindo */}
      <polyline
        points="14,100 34,84 48,92 72,62"
        fill="none"
        stroke="#145369"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polygon points="64,56 82,52 76,70" fill="#145369" />
    </svg>
  )
}

// ---------- Telas de acesso e configurações ----------

const SOMBRA = <ellipse cx="64" cy="116" rx="48" ry="5.5" fill="#0b0a09" opacity="0.12" />

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

/** Porta aberta com uma seta entrando e um cadeado aberto (login). */
export function IlustracaoEntrar({ tamanho = 112 }: Props) {
  return (
    <svg {...svg(tamanho)}>
      {SOMBRA}
      <rect x="34" y="12" width="56" height="100" rx="4" fill="#0f4255" />
      <rect x="41" y="19" width="42" height="93" fill="#e3eef2" />
      <polygon points="41,19 66,28 66,104 41,112" fill="#1f7a99" />
      <circle cx="60" cy="68" r="3" fill="#e6d89a" />
      <line x1="6" y1="68" x2="56" y2="68" stroke="#8a663b" strokeWidth="9" strokeLinecap="round" />
      <polygon points="52,52 74,68 52,84" fill="#8a663b" />
      <circle cx="100" cy="96" r="18" fill="#e6d89a" />
      <rect x="91" y="94" width="18" height="13" rx="2" fill="#5f4527" />
      <path d="M94 94v-5a6 6 0 0 1 11.5-2.4" fill="none" stroke="#5f4527" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  )
}

/** Loja com um "+" (criar conta). */
export function IlustracaoCadastro({ tamanho = 112 }: Props) {
  return (
    <svg {...svg(tamanho)}>
      {SOMBRA}
      <Loja />
      <circle cx="104" cy="100" r="19" fill="#1f7a99" />
      <rect x="94" y="97.5" width="20" height="5" rx="2" fill="#f8f8f8" />
      <rect x="101.5" y="90" width="5" height="20" rx="2" fill="#f8f8f8" />
    </svg>
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
