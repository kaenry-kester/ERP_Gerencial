import { useEffect, useMemo, useState } from 'react'
import Footer from '../../components/footer/footer'
import Header from '../../components/header/header'
import './App.css'

const STORAGE_KEY = 'erp-gerencial-v1'

type Role = 'admin' | 'user'

type Store = {
  name: string
  cnpj: string
  phone: string
  email: string
  address: string
  city: string
  state: string
}

type Employee = {
  id: number
  name: string
  email: string
  password: string
  phone: string
  birthDate: string
  role: Role
}

type Product = {
  id: number
  name: string
  category: string
  price: number
  stock: number
}

type Client = {
  id: number
  name: string
  email: string
  phone: string
  city: string
}

const initialStore: Store = {
  name: 'Loja Nova Era',
  cnpj: '12.345.678/0001-90',
  phone: '(11) 3456-7890',
  email: 'contato@lojanovaera.com.br',
  address: 'Rua das Flores, 245',
  city: 'São Paulo',
  state: 'SP',
}

const initialEmployees: Employee[] = [
  {
    id: 1,
    name: 'Maria Silva',
    email: 'admin@lojanovaera.com.br',
    password: '123456',
    phone: '(11) 98765-4321',
    birthDate: '1990-04-18',
    role: 'admin',
  },
]

const initialProducts: Product[] = [
  { id: 1, name: 'Notebook Gamer', category: 'Eletrônicos', price: 4299.9, stock: 18 },
  { id: 2, name: 'Smartphone X10', category: 'Celulares', price: 2499, stock: 42 },
  { id: 3, name: 'Cafeteira Deluxe', category: 'Casa', price: 389.9, stock: 25 },
]

const initialClients: Client[] = [
  { id: 1, name: 'João Pereira', email: 'joao@email.com', phone: '(11) 91234-5678', city: 'São Paulo' },
  { id: 2, name: 'Ana Souza', email: 'ana@email.com', phone: '(11) 99876-5432', city: 'Campinas' },
]

const emptyEmployeeForm = {
  name: '',
  email: '',
  password: '',
  phone: '',
  birthDate: '',
  role: 'user' as Role,
}

const emptyProductForm = {
  name: '',
  category: '',
  price: '',
  stock: '',
}

const emptyClientForm = {
  name: '',
  email: '',
  phone: '',
  city: '',
}

function getStoredData() {
  const raw = localStorage.getItem(STORAGE_KEY)

  if (!raw) {
    return {
      store: initialStore,
      employees: initialEmployees,
      products: initialProducts,
      clients: initialClients,
    }
  }

  try {
    const parsed = JSON.parse(raw) as {
      store?: Store
      employees?: Employee[]
      products?: Product[]
      clients?: Client[]
    }

    return {
      store: parsed.store ?? initialStore,
      employees: parsed.employees ?? initialEmployees,
      products: parsed.products ?? initialProducts,
      clients: parsed.clients ?? initialClients,
    }
  } catch {
    return {
      store: initialStore,
      employees: initialEmployees,
      products: initialProducts,
      clients: initialClients,
    }
  }
}

export default function App() {
  const storedData = useMemo(() => getStoredData(), [])
  const [screen, setScreen] = useState<'landing' | 'storeForm' | 'login' | 'dashboard'>('landing')
  const [store, setStore] = useState<Store>(storedData.store)
  const [employees, setEmployees] = useState<Employee[]>(storedData.employees)
  const [products, setProducts] = useState<Product[]>(storedData.products)
  const [clients, setClients] = useState<Client[]>(storedData.clients)
  const [currentRole, setCurrentRole] = useState<Role>('admin')
  const [activeModule, setActiveModule] = useState('overview')
  const [employeeForm, setEmployeeForm] = useState(emptyEmployeeForm)
  const [productForm, setProductForm] = useState(emptyProductForm)
  const [clientForm, setClientForm] = useState(emptyClientForm)
  const [financeMessage, setFinanceMessage] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginData, setLoginData] = useState({
    email: employees[0]?.email ?? 'admin@lojanovaera.com.br',
    password: employees[0]?.password ?? '123456',
  })

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        store,
        employees,
        products,
        clients,
      }),
    )
  }, [store, employees, products, clients])

  const stats = useMemo(
    () => [
      { label: 'Faturamento', value: 'R$ 128.4k', trend: '+12.4%' },
      { label: 'Pedidos', value: '482', trend: '+8.1%' },
      { label: 'Clientes', value: String(clients.length), trend: '+7.0%' },
      { label: 'Produtos', value: String(products.length), trend: '+3.5%' },
    ],
    [clients.length, products.length],
  )

  const isAdmin = currentRole === 'admin'
  const hasStoreSaved = Boolean(store.name && store.email)

  const handleGoToLogin = () => {
    if (!hasStoreSaved) {
      setScreen('storeForm')
      return
    }

    setScreen('login')
  }

  const handleStoreSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const adminEmployee = {
      id: Date.now(),
      name: 'Administrador da loja',
      email: 'admin@lojanovaera.com.br',
      password: '123456',
      phone: store.phone,
      birthDate: '1990-01-01',
      role: 'admin' as Role,
    }

    setEmployees((previous) => {
      const hasAdmin = previous.some((employee) => employee.email.toLowerCase() === adminEmployee.email.toLowerCase())
      return hasAdmin ? previous : [adminEmployee, ...previous]
    })

    setLoginData({
      email: 'admin@lojanovaera.com.br',
      password: '123456',
    })
    setCurrentRole('admin')
    setLoginError('')
    setScreen('login')
  }

  const handleLogin = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const foundEmployee = employees.find(
      (employee) =>
        employee.email.toLowerCase() === loginData.email.toLowerCase() &&
        employee.password === loginData.password,
    )

    if (!foundEmployee) {
      setLoginError('Credenciais inválidas. Verifique e-mail e senha da loja cadastrada.')
      return
    }

    setCurrentRole(foundEmployee.role)
    setLoginError('')
    setScreen('dashboard')
  }

  const handleEmployeeSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    setEmployees((previous) => [
      ...previous,
      {
        id: Date.now(),
        name: employeeForm.name,
        email: employeeForm.email,
        password: employeeForm.password,
        phone: employeeForm.phone,
        birthDate: employeeForm.birthDate,
        role: employeeForm.role,
      },
    ])

    setEmployeeForm(emptyEmployeeForm)
    setActiveModule('overview')
  }

  const handleProductSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!isAdmin) return

    setProducts((previous) => [
      ...previous,
      {
        id: Date.now(),
        name: productForm.name,
        category: productForm.category,
        price: Number(productForm.price),
        stock: Number(productForm.stock),
      },
    ])

    setProductForm(emptyProductForm)
  }

  const handleClientSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!isAdmin) return

    setClients((previous) => [
      ...previous,
      {
        id: Date.now(),
        name: clientForm.name,
        email: clientForm.email,
        phone: clientForm.phone,
        city: clientForm.city,
      },
    ])

    setClientForm(emptyClientForm)
  }

  const updateProduct = (id: number, field: keyof Product, value: string | number) => {
    if (!isAdmin) return

    setProducts((previous) =>
      previous.map((product) =>
        product.id === id ? { ...product, [field]: field === 'price' || field === 'stock' ? Number(value) : value } : product,
      ),
    )
  }

  const updateClient = (id: number, field: keyof Client, value: string) => {
    if (!isAdmin) return

    setClients((previous) =>
      previous.map((client) => (client.id === id ? { ...client, [field]: value } : client)),
    )
  }

  const handleFinanceAction = (type: 'cupom' | 'nfe') => {
    setFinanceMessage(
      type === 'cupom'
        ? 'Cupom eletrônico emitido com sucesso para o cliente atual.'
        : 'Nota eletrônica gerada com sucesso e enviada para o destinatário.',
    )
  }

  if (screen === 'landing') {
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
            <button type="button" className="secondary-button" onClick={() => setScreen('storeForm')}>
              Cadastrar loja
            </button>
            <button type="button" className="primary-button" onClick={handleGoToLogin}>
              Já tenho loja cadastrada
            </button>
          </nav>
        </header>

        <main className="landing-main">
          <section className="hero-section">
            <div className="hero-copy">
              <p className="eyebrow">Sistema completo para varejo</p>
              <h1>Controle tudo da sua loja em um único painel.</h1>
              <p className="hero-text">
                Organize vendas, estoque, clientes, funcionários e financeiro com um ERP pensado para lojas de varejo que querem crescer com eficiência.
              </p>

              <div className="hero-actions">
                <button type="button" className="primary-button" onClick={() => setScreen('storeForm')}>
                  Abrir minha loja
                </button>
                <button type="button" className="ghost-button" onClick={handleGoToLogin}>
                  Já tenho loja cadastrada
                </button>
              </div>
            </div>

            <div className="hero-panel">
              <div className="mini-card">
                <span>Vendas do dia</span>
                <strong>R$ 28.460</strong>
                <small>+18,3% vs ontem</small>
              </div>
              <div className="mini-card">
                <span>Produtos em estoque</span>
                <strong>1.842</strong>
                <small>96% disponível</small>
              </div>
            </div>
          </section>

          <section className="benefits-section">
            <h2>Vantagens do sistema</h2>
            <div className="benefits-grid">
              <article className="benefit-card">
                <h3>Gestão centralizada</h3>
                <p>Todos os dados da loja em um único lugar: clientes, produtos, vendas e operação diária.</p>
              </article>
              <article className="benefit-card">
                <h3>Controle de estoque</h3>
                <p>Evite faltas e excesso de itens com atualização instantânea do inventário da loja.</p>
              </article>
              <article className="benefit-card">
                <h3>Foco em vendas</h3>
                <p>Acelere o atendimento com cadastros prontos, relatórios claros e fluxo de caixa organizado.</p>
              </article>
            </div>
          </section>

          <section className="features-section">
            <h2>Funcionalidades principais</h2>
            <ul>
              <li>Cadastro da loja com dados completos</li>
              <li>Controle de funcionários com perfis admin e usuário</li>
              <li>Cadastro e gestão de produtos</li>
              <li>Cadastro e consulta de clientes</li>
              <li>Emissão de cupom eletrônico e nota fiscal</li>
            </ul>
          </section>
        </main>
      </div>
    )
  }

  if (screen === 'storeForm') {
    return (
      <div className="page-shell">
        <main className="form-page">
          <div className="form-card wide-card">
            <div className="form-header">
              <div>
                <p className="eyebrow">Cadastro da loja</p>
                <h2>Cadastre sua empresa</h2>
              </div>
              <button type="button" className="ghost-button" onClick={() => setScreen('landing')}>
                Voltar
              </button>
            </div>

            <form className="store-form" onSubmit={handleStoreSubmit}>
              <div className="form-grid two-columns">
                <label>
                  <span>Nome da loja</span>
                  <input
                    value={store.name}
                    onChange={(event) => setStore((previous) => ({ ...previous, name: event.target.value }))}
                    placeholder="Ex: Loja Nova Era"
                  />
                </label>

                <label>
                  <span>CNPJ</span>
                  <input
                    value={store.cnpj}
                    onChange={(event) => setStore((previous) => ({ ...previous, cnpj: event.target.value }))}
                    placeholder="00.000.000/0000-00"
                  />
                </label>

                <label>
                  <span>E-mail</span>
                  <input
                    type="email"
                    value={store.email}
                    onChange={(event) => setStore((previous) => ({ ...previous, email: event.target.value }))}
                    placeholder="contato@empresa.com"
                  />
                </label>

                <label>
                  <span>Telefone</span>
                  <input
                    value={store.phone}
                    onChange={(event) => setStore((previous) => ({ ...previous, phone: event.target.value }))}
                    placeholder="(11) 3333-4444"
                  />
                </label>

                <label className="full-width">
                  <span>Endereço</span>
                  <input
                    value={store.address}
                    onChange={(event) => setStore((previous) => ({ ...previous, address: event.target.value }))}
                    placeholder="Rua, número, bairro"
                  />
                </label>

                <label>
                  <span>Cidade</span>
                  <input
                    value={store.city}
                    onChange={(event) => setStore((previous) => ({ ...previous, city: event.target.value }))}
                    placeholder="São Paulo"
                  />
                </label>

                <label>
                  <span>Estado</span>
                  <input
                    value={store.state}
                    onChange={(event) => setStore((previous) => ({ ...previous, state: event.target.value }))}
                    placeholder="SP"
                  />
                </label>
              </div>

              <button type="submit" className="primary-button submit-button">
                Salvar loja
              </button>
            </form>
          </div>
        </main>
      </div>
    )
  }

  if (screen === 'login') {
    return (
      <div className="page-shell login-shell">
        <main className="login-page-wrap">
          <div className="login-panel">
            <div className="brand-block">
              <span className="brand-mark">ERP</span>
              <h1>{store.name}</h1>
              <p>Controle de estoque, pessoas, clientes e financeiro em um único ambiente.</p>
            </div>

            <form className="login-form" onSubmit={handleLogin}>
              <div className="form-header compact-header">
                <div>
                  <p className="eyebrow">Acesso</p>
                  <h2>Login da loja</h2>
                </div>
              </div>

              <label>
                <span>E-mail</span>
                <input
                  type="email"
                  value={loginData.email}
                  onChange={(event) => setLoginData((previous) => ({ ...previous, email: event.target.value }))}
                />
              </label>

              <label>
                <span>Senha</span>
                <input
                  type="password"
                  value={loginData.password}
                  onChange={(event) => setLoginData((previous) => ({ ...previous, password: event.target.value }))}
                />
              </label>

              {loginError && <div className="access-warning">{loginError}</div>}

              <button type="submit" className="primary-button submit-button">
                Entrar no sistema
              </button>

              <button type="button" className="ghost-button full-width-button" onClick={() => setScreen('landing')}>
                Voltar ao início
              </button>
            </form>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <Header
        storeName={store.name}
        userName={employees[0]?.name ?? 'Administrador'}
        role={currentRole}
      />

      <main className="dashboard">
        <section className="welcome-bar">
          <div>
            <p className="eyebrow">Home da loja</p>
            <h1>{store.name}</h1>
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
            <small>{store.city} / {store.state}</small>
          </div>
          <div className="summary-card">
            <span>Contato</span>
            <strong>{store.email}</strong>
            <small>{store.phone}</small>
          </div>
          <div className="summary-card">
            <span>Perfil atual</span>
            <strong>{isAdmin ? 'Administrador' : 'Usuário'}</strong>
            <small>{employees.length} colaboradores</small>
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
          <button type="button" className={activeModule === 'product' ? 'module-button active' : 'module-button'} onClick={() => setActiveModule('product')}>
            Cadastrar produto
          </button>
          <button type="button" className={activeModule === 'manage-products' ? 'module-button active' : 'module-button'} onClick={() => setActiveModule('manage-products')}>
            Gerenciar produtos
          </button>
          <button type="button" className={activeModule === 'client' ? 'module-button active' : 'module-button'} onClick={() => setActiveModule('client')}>
            Cadastrar cliente
          </button>
          <button type="button" className={activeModule === 'clients' ? 'module-button active' : 'module-button'} onClick={() => setActiveModule('clients')}>
            Visualizar cliente
          </button>
          <button type="button" className={activeModule === 'finance' ? 'module-button active' : 'module-button'} onClick={() => setActiveModule('finance')}>
            Financeiro
          </button>
        </section>

        <section className="content-grid">
          {activeModule === 'employee' && (
            <article className="panel large-panel">
              <div className="panel-header">
                <h2>Cadastrar funcionário</h2>
              </div>

              <form className="form-grid" onSubmit={handleEmployeeSubmit}>
                <label>
                  <span>Nome completo</span>
                  <input value={employeeForm.name} onChange={(event) => setEmployeeForm((previous) => ({ ...previous, name: event.target.value }))} />
                </label>

                <label>
                  <span>E-mail</span>
                  <input type="email" value={employeeForm.email} onChange={(event) => setEmployeeForm((previous) => ({ ...previous, email: event.target.value }))} />
                </label>

                <label>
                  <span>Senha</span>
                  <input type="password" value={employeeForm.password} onChange={(event) => setEmployeeForm((previous) => ({ ...previous, password: event.target.value }))} />
                </label>

                <label>
                  <span>Telefone</span>
                  <input value={employeeForm.phone} onChange={(event) => setEmployeeForm((previous) => ({ ...previous, phone: event.target.value }))} />
                </label>

                <label>
                  <span>Data de nascimento</span>
                  <input type="date" value={employeeForm.birthDate} onChange={(event) => setEmployeeForm((previous) => ({ ...previous, birthDate: event.target.value }))} />
                </label>

                <label>
                  <span>Perfil</span>
                  <select value={employeeForm.role} onChange={(event) => setEmployeeForm((previous) => ({ ...previous, role: event.target.value as Role }))}>
                    <option value="admin">Admin</option>
                    <option value="user">Usuário</option>
                  </select>
                </label>

                <button type="submit" className="primary-button submit-button">
                  Salvar funcionário
                </button>
              </form>
            </article>
          )}

          {activeModule === 'product' && (
            <article className="panel large-panel">
              <div className="panel-header">
                <h2>Cadastrar produto</h2>
              </div>

              {isAdmin ? (
                <form className="form-grid" onSubmit={handleProductSubmit}>
                  <label>
                    <span>Nome do produto</span>
                    <input value={productForm.name} onChange={(event) => setProductForm((previous) => ({ ...previous, name: event.target.value }))} />
                  </label>

                  <label>
                    <span>Categoria</span>
                    <input value={productForm.category} onChange={(event) => setProductForm((previous) => ({ ...previous, category: event.target.value }))} />
                  </label>

                  <label>
                    <span>Preço</span>
                    <input type="number" value={productForm.price} onChange={(event) => setProductForm((previous) => ({ ...previous, price: event.target.value }))} />
                  </label>

                  <label>
                    <span>Estoque</span>
                    <input type="number" value={productForm.stock} onChange={(event) => setProductForm((previous) => ({ ...previous, stock: event.target.value }))} />
                  </label>

                  <button type="submit" className="primary-button submit-button">
                    Cadastrar produto
                  </button>
                </form>
              ) : (
                <div className="access-warning">
                  <p>Seu perfil é de usuário e não possui permissão para cadastrar produtos.</p>
                </div>
              )}
            </article>
          )}

          {activeModule === 'manage-products' && (
            <article className="panel large-panel">
              <div className="panel-header">
                <h2>Gerenciar produtos</h2>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th>Categoria</th>
                      <th>Preço</th>
                      <th>Estoque</th>
                      {isAdmin && <th>Ações</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => (
                      <tr key={product.id}>
                        <td>
                          {isAdmin ? (
                            <input value={product.name} onChange={(event) => updateProduct(product.id, 'name', event.target.value)} />
                          ) : (
                            product.name
                          )}
                        </td>
                        <td>
                          {isAdmin ? (
                            <input value={product.category} onChange={(event) => updateProduct(product.id, 'category', event.target.value)} />
                          ) : (
                            product.category
                          )}
                        </td>
                        <td>
                          {isAdmin ? (
                            <input type="number" value={product.price} onChange={(event) => updateProduct(product.id, 'price', Number(event.target.value))} />
                          ) : (
                            `R$ ${product.price.toFixed(2)}`
                          )}
                        </td>
                        <td>
                          {isAdmin ? (
                            <input type="number" value={product.stock} onChange={(event) => updateProduct(product.id, 'stock', Number(event.target.value))} />
                          ) : (
                            product.stock
                          )}
                        </td>
                        {isAdmin && <td><button type="button" className="danger-button" onClick={() => setProducts((previous) => previous.filter((item) => item.id !== product.id))}>Excluir</button></td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          )}

          {activeModule === 'client' && (
            <article className="panel large-panel">
              <div className="panel-header">
                <h2>Cadastrar cliente</h2>
              </div>

              {isAdmin ? (
                <form className="form-grid" onSubmit={handleClientSubmit}>
                  <label>
                    <span>Nome completo</span>
                    <input value={clientForm.name} onChange={(event) => setClientForm((previous) => ({ ...previous, name: event.target.value }))} />
                  </label>

                  <label>
                    <span>E-mail</span>
                    <input type="email" value={clientForm.email} onChange={(event) => setClientForm((previous) => ({ ...previous, email: event.target.value }))} />
                  </label>

                  <label>
                    <span>Telefone</span>
                    <input value={clientForm.phone} onChange={(event) => setClientForm((previous) => ({ ...previous, phone: event.target.value }))} />
                  </label>

                  <label>
                    <span>Cidade</span>
                    <input value={clientForm.city} onChange={(event) => setClientForm((previous) => ({ ...previous, city: event.target.value }))} />
                  </label>

                  <button type="submit" className="primary-button submit-button">
                    Cadastrar cliente
                  </button>
                </form>
              ) : (
                <div className="access-warning">
                  <p>Seu perfil de usuário tem permissão apenas para visualizar clientes.</p>
                </div>
              )}
            </article>
          )}

          {activeModule === 'clients' && (
            <article className="panel large-panel">
              <div className="panel-header">
                <h2>Visualizar clientes</h2>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>E-mail</th>
                      <th>Telefone</th>
                      <th>Cidade</th>
                      {isAdmin && <th>Ações</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((client) => (
                      <tr key={client.id}>
                        <td>
                          {isAdmin ? (
                            <input value={client.name} onChange={(event) => updateClient(client.id, 'name', event.target.value)} />
                          ) : (
                            client.name
                          )}
                        </td>
                        <td>
                          {isAdmin ? (
                            <input value={client.email} onChange={(event) => updateClient(client.id, 'email', event.target.value)} />
                          ) : (
                            client.email
                          )}
                        </td>
                        <td>
                          {isAdmin ? (
                            <input value={client.phone} onChange={(event) => updateClient(client.id, 'phone', event.target.value)} />
                          ) : (
                            client.phone
                          )}
                        </td>
                        <td>
                          {isAdmin ? (
                            <input value={client.city} onChange={(event) => updateClient(client.id, 'city', event.target.value)} />
                          ) : (
                            client.city
                          )}
                        </td>
                        {isAdmin && <td><button type="button" className="danger-button" onClick={() => setClients((previous) => previous.filter((item) => item.id !== client.id))}>Excluir</button></td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          )}

          {activeModule === 'finance' && (
            <article className="panel large-panel">
              <div className="panel-header">
                <h2>Financeiro</h2>
              </div>

              <div className="finance-actions">
                <button type="button" className="primary-button" onClick={() => handleFinanceAction('cupom')}>
                  Emitir cupom eletrônico
                </button>
                <button type="button" className="secondary-button" onClick={() => handleFinanceAction('nfe')}>
                  Emitir nota eletrônica
                </button>
              </div>

              {financeMessage && <div className="success-box">{financeMessage}</div>}

              <div className="finance-summary">
                <div>
                  <span>Caixa</span>
                  <strong>R$ 36.780,00</strong>
                </div>
                <div>
                  <span>Vendas hoje</span>
                  <strong>R$ 8.640,00</strong>
                </div>
                <div>
                  <span>Em aberto</span>
                  <strong>R$ 2.150,00</strong>
                </div>
              </div>
            </article>
          )}
        </section>
      </main>

      <Footer />
    </div>
  )
}