import { Link, useNavigate } from 'react-router-dom'
import { useErp } from '../context/ErpContext'
import '../styles/landing.css'

const benefits = [
  {
    title: 'Gestão centralizada',
    description: 'Todos os dados da loja em um único lugar: clientes, produtos, vendas e operação diária.',
    icon: '🏪',
  },
  {
    title: 'Controle de estoque',
    description: 'Evite faltas e excesso de itens com atualização instantânea do inventário da loja.',
    icon: '📦',
  },
  {
    title: 'Foco em vendas',
    description: 'Acelere o atendimento com cadastros prontos, relatórios claros e fluxo de caixa organizado.',
    icon: '💰',
  },
  {
    title: 'Perfis de acesso',
    description: 'Administradores gerenciam tudo; usuários visualizam informações com segurança.',
    icon: '🔐',
  },
  {
    title: 'Financeiro integrado',
    description: 'Emita cupom eletrônico e nota fiscal diretamente pelo sistema.',
    icon: '🧾',
  },
  {
    title: 'Pronto para crescer',
    description: 'Estrutura pensada para lojas de varejo que querem escalar com eficiência.',
    icon: '📈',
  },
]

const features = [
  'Cadastro completo da loja com CNPJ, endereço e contatos',
  'Controle de funcionários com perfis Admin e Usuário',
  'Cadastro e gestão de produtos com preço e estoque',
  'Cadastro e consulta de clientes',
  'Emissão de cupom eletrônico e nota fiscal eletrônica',
  'Dashboard com visão geral da operação',
]

export default function LandingPage() {
  const { isStoreRegistered, store } = useErp()
  const navigate = useNavigate()

  const handleRegisteredStoreAction = () => {
    if (!isStoreRegistered) {
      navigate('/cadastrar-loja')
      return
    }

    navigate('/login')
  }

  return (
    <div className="landing-page">
      <header className="landing-header">
        <div className="brand-box">
          <span className="brand-mark">ERP</span>
          <div>
            <strong>ERP Gerencial</strong>
            <small>Varejo inteligente</small>
          </div>
        </div>

        <nav className="landing-actions">
          <Link to="/cadastrar-loja" className="primary-button">
            Abrir minha loja
          </Link>
          <button
            type="button"
            className="ghost-button"
            onClick={handleRegisteredStoreAction}
            title={isStoreRegistered ? 'Ir para o login da loja' : 'Cadastre uma loja primeiro'}
          >
            Já tenho loja registrada
          </button>
        </nav>
      </header>

      <main className="landing-main">
        <section className="hero-section">
          <div className="hero-copy">
            <p className="eyebrow">Sistema completo para varejo</p>
            <h1>Controle tudo da sua loja em um único painel.</h1>
            <p className="hero-text">
              Organize vendas, estoque, clientes, funcionários e financeiro com um ERP pensado
              para lojas de varejo que querem crescer com eficiência e simplicidade.
            </p>

            <div className="hero-actions">
              <Link to="/cadastrar-loja" className="primary-button">
                Abrir minha loja
              </Link>
              <button
                type="button"
                className="ghost-button"
                onClick={handleRegisteredStoreAction}
                title={isStoreRegistered ? 'Ir para o login da loja' : 'Cadastre uma loja primeiro'}
              >
                Já tenho loja registrada
              </button>
            </div>
          </div>
        </section>

        {isStoreRegistered && (
          <section id="lojas-cadastradas" className="registered-stores-section">
            <h2>Lojas cadastradas</h2>
            <p className="section-subtitle">
              Selecione sua loja para acessar o sistema.
            </p>

            <div className="registered-stores-grid">
              <button
                type="button"
                className="registered-store-card"
                onClick={() => navigate('/login')}
              >
                <span className="store-card-badge">Loja</span>
                <strong>{store.name}</strong>
                {store.tradeName && <span className="store-card-trade">{store.tradeName}</span>}
                <small>{store.cnpj || 'CNPJ não informado'}</small>
                <small>{store.city}{store.state ? ` / ${store.state}` : ''}</small>
                <span className="store-card-action">Acessar loja →</span>
              </button>
            </div>
          </section>
        )}

        <section className="benefits-section">
          <h2>Vantagens do sistema</h2>
          <p className="section-subtitle">
            Tudo o que sua loja precisa para operar com agilidade e controle total.
          </p>
          <div className="benefits-grid">
            {benefits.map((item) => (
              <article key={item.title} className="benefit-card">
                <span className="benefit-icon">{item.icon}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="features-section">
          <h2>Funcionalidades principais</h2>
          <ul className="features-list">
            {features.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
        </section>

        <section className="cta-section">
          <h2>Pronto para começar?</h2>
          <p>Cadastre sua loja em minutos e comece a gerenciar seu varejo hoje mesmo.</p>
          <div className="hero-actions">
            <Link to="/cadastrar-loja" className="primary-button">
              Abrir minha loja
            </Link>
            {isStoreRegistered && (
              <Link
                to="/login"
                className="primary2-button registered-login-button"
                onClick={handleRegisteredStoreAction}
              >
                Já tenho loja registrada
              </Link>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
