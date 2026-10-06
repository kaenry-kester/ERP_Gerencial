import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import Header from '../components/header/header'
import Footer from '../components/footer/footer'
import EmployeeModule from '../components/dashboard/EmployeeModule'
import ProductModule from '../components/dashboard/ProductModule'
import ClientModule from '../components/dashboard/ClientModule'
import FinanceModule from '../components/dashboard/FinanceModule'
import { useErp } from '../context/ErpContext'
import type { ActiveModule } from '../types'
import '../pages/home/App.css'

export default function DashboardPage() {
  const { store, employees, products, clients, currentUser } = useErp()
  const [activeModule, setActiveModule] = useState<ActiveModule>('overview')

  const stats = useMemo(
    () => [
      { label: 'Produtos', value: String(products.length), trend: 'Em estoque' },
      { label: 'Clientes', value: String(clients.length), trend: 'Cadastrados' },
      { label: 'Funcionários', value: String(employees.length), trend: 'Ativos' },
      {
        label: 'Valor em estoque',
        value: `R$ ${products.reduce((sum, p) => sum + p.price * p.stock, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        trend: 'Total estimado',
      },
    ],
    [products, clients, employees],
  )

  if (!currentUser) return <Navigate to="/login" replace />

  const isAdmin = currentUser.role === 'admin'

  const modules: { id: ActiveModule; label: string }[] = [
    { id: 'product', label: 'Cadastrar produto' },
    { id: 'manage-products', label: 'Gerenciar produtos' },
    { id: 'client', label: 'Cadastrar cliente' },
    { id: 'clients', label: 'Visualizar cliente' },
    { id: 'finance', label: 'Financeiro' },
  ]

  return (
    <div className="app-shell">
      <Header
        storeName={store.name}
        userName={currentUser.name}
        role={currentUser.role}
      />

      <main className="dashboard">
        <section className="welcome-bar">
          <div>
            <p className="eyebrow">Home da loja</p>
            <h1>{store.name}</h1>
            {store.tradeName && <p className="store-trade-name">{store.tradeName}</p>}
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={() => setActiveModule('employee')}
          >
            Cadastrar funcionário
          </button>
        </section>

        <section className="store-summary">
          <div className="summary-card">
            <span>Empresa</span>
            <strong>{store.name}</strong>
            <small>{store.city}{store.state ? ` / ${store.state}` : ''}</small>
          </div>
          <div className="summary-card">
            <span>CNPJ</span>
            <strong>{store.cnpj || '—'}</strong>
            <small>{store.address || 'Endereço não informado'}</small>
          </div>
          <div className="summary-card">
            <span>Contato</span>
            <strong>{store.email}</strong>
            <small>{store.phone || '—'}</small>
          </div>
          <div className="summary-card">
            <span>Perfil atual</span>
            <strong>{isAdmin ? 'Administrador' : 'Usuário'}</strong>
            <small>{currentUser.name}</small>
          </div>
        </section>

        <section className="stats-grid" aria-label="Resumo operacional">
          {stats.map((item) => (
            <article key={item.label} className="stat-card">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.trend}</small>
            </article>
          ))}
        </section>

        <section className="module-grid">
          {modules.map((mod) => (
            <button
              key={mod.id}
              type="button"
              className={activeModule === mod.id ? 'module-button active' : 'module-button'}
              onClick={() => setActiveModule(mod.id)}
            >
              {mod.label}
            </button>
          ))}
        </section>

        <section className="content-area">
          {activeModule === 'overview' && (
            <article className="panel large-panel">
              <div className="panel-header">
                <h2>Visão geral</h2>
              </div>
              <p className="overview-text">
                Bem-vindo ao painel da <strong>{store.name}</strong>. Use os botões acima para
                gerenciar produtos, clientes e financeiro. Como{' '}
                <strong>{isAdmin ? 'administrador' : 'usuário'}</strong>, você{' '}
                {isAdmin
                  ? 'pode cadastrar e alterar produtos e clientes.'
                  : 'pode visualizar produtos e clientes, mas não alterá-los.'}
              </p>
              <div className="overview-quick">
                <div>
                  <span>Produtos</span>
                  <strong>{products.length}</strong>
                </div>
                <div>
                  <span>Clientes</span>
                  <strong>{clients.length}</strong>
                </div>
                <div>
                  <span>Colaboradores</span>
                  <strong>{employees.length}</strong>
                </div>
              </div>
            </article>
          )}

          {activeModule === 'employee' && <EmployeeModule />}
          {activeModule === 'product' && <ProductModule mode="create" />}
          {activeModule === 'manage-products' && <ProductModule mode="manage" />}
          {activeModule === 'client' && <ClientModule mode="create" />}
          {activeModule === 'clients' && <ClientModule mode="view" />}
          {activeModule === 'finance' && <FinanceModule />}
        </section>
      </main>

      <Footer />
    </div>
  )
}
