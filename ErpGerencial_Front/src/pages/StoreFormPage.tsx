import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useErp } from '../context/ErpContext'
import { emptyStore } from '../types'
import '../styles/forms.css'

export default function StoreFormPage() {
  const navigate = useNavigate()
  const { registerStore } = useErp()

  const [store, setStore] = useState(emptyStore())
  const [storePassword, setStorePassword] = useState('')
  const [storePasswordConfirm, setStorePasswordConfirm] = useState('')
  const [admin, setAdmin] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    birthDate: '',
  })
  const [error, setError] = useState('')

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    if (!store.name || !store.cnpj || !store.email) {
      setError('Preencha nome, CNPJ e e-mail da loja.')
      return
    }

    if (!storePassword || !storePasswordConfirm) {
      setError('Preencha a senha e a confirmação da senha da loja.')
      return
    }

    if (storePassword.length < 6) {
      setError('A senha da loja deve ter pelo menos 6 caracteres.')
      return
    }

    if (storePassword !== storePasswordConfirm) {
      setError('A senha da loja e a confirmação devem ser iguais.')
      return
    }

    if (!admin.name || !admin.email || !admin.password || !admin.confirmPassword) {
      setError('Preencha nome, e-mail, senha e confirmação de senha do administrador.')
      return
    }

    if (admin.password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      return
    }

    if (admin.password !== admin.confirmPassword) {
      setError('A senha e a confirmação da senha devem ser iguais.')
      return
    }

    registerStore({ ...store, password: storePassword }, {
      name: admin.name,
      email: admin.email,
      password: admin.password,
      phone: admin.phone,
      birthDate: admin.birthDate,
    })
    navigate('/login')
  }

  return (
    <div className="page-shell">
      <main className="form-page">
        <div className="form-card wide-card">
          <div className="form-header">
            <div>
              <h2>Cadastre sua empresa</h2>
              <p className="form-subtitle">
                Informe os dados da loja e do administrador responsável pelo acesso inicial.
              </p>
            </div>
            <Link to="/" className="primary-button">
              Voltar
            </Link>
          </div>

          {error && <div className="error-box">{error}</div>}

          <form className="store-form" onSubmit={handleSubmit}>
            <h3 className="form-section-title">Dados da loja</h3>
            <div className="form-grid two-columns">
              <label>
                <span>Nome da loja *</span>
                <input
                  value={store.name}
                  onChange={(e) => setStore((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Ex: Loja Nova Era"
                  required
                />
              </label>

              <label>
                <span>Nome fantasia</span>
                <input
                  value={store.tradeName}
                  onChange={(e) => setStore((p) => ({ ...p, tradeName: e.target.value }))}
                  placeholder="Nome comercial"
                />
              </label>

              <label>
                <span>CNPJ *</span>
                <input
                  value={store.cnpj}
                  onChange={(e) => setStore((p) => ({ ...p, cnpj: e.target.value }))}
                  placeholder="00.000.000/0000-00"
                  required
                />
              </label>

              <label>
                <span>E-mail da empresa*</span>
                <input
                  type="email"
                  value={store.email}
                  onChange={(e) => setStore((p) => ({ ...p, email: e.target.value }))}
                  placeholder="contato@empresa.com"
                  required
                />
              </label>

              <label>
                <span>Senha da loja *</span>
                <input
                  type="password"
                  value={storePassword}
                  onChange={(e) => setStorePassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                  required
                />
              </label>

              <label>
                <span>Confirmar senha da loja *</span>
                <input
                  type="password"
                  value={storePasswordConfirm}
                  onChange={(e) => setStorePasswordConfirm(e.target.value)}
                  placeholder="Repita a senha da loja"
                  minLength={6}
                  required
                />
              </label>

              <label>
                <span>Telefone</span>
                <input
                  value={store.phone}
                  onChange={(e) => setStore((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="(11) 3333-4444"
                />
              </label>

              <label>
                <span>CEP</span>
                <input
                  value={store.zipCode}
                  onChange={(e) => setStore((p) => ({ ...p, zipCode: e.target.value }))}
                  placeholder="00000-000"
                />
              </label>

              <label className="full-width">
                <span>Endereço</span>
                <input
                  value={store.address}
                  onChange={(e) => setStore((p) => ({ ...p, address: e.target.value }))}
                  placeholder="Rua, número, bairro"
                />
              </label>

              <label>
                <span>Cidade</span>
                <input
                  value={store.city}
                  onChange={(e) => setStore((p) => ({ ...p, city: e.target.value }))}
                  placeholder="São Paulo"
                />
              </label>

              <label>
                <span>Estado</span>
                <input
                  value={store.state}
                  onChange={(e) => setStore((p) => ({ ...p, state: e.target.value }))}
                  placeholder="SP"
                  maxLength={2}
                />
              </label>
            </div>

            <h3 className="form-section-title">Administrador da loja</h3>
            <p className="form-hint">
              Este será o primeiro usuário com perfil Admin, responsável por cadastrar produtos e clientes.
            </p>

            <div className="form-grid two-columns">
              <label>
                <span>Nome completo *</span>
                <input
                  value={admin.name}
                  onChange={(e) => setAdmin((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Nome do administrador"
                  required
                />
              </label>

              <label>
                <span>E-mail de acesso do admin *</span>
                <input
                  type="email"
                  value={admin.email}
                  onChange={(e) => setAdmin((p) => ({ ...p, email: e.target.value }))}
                  placeholder="admin@empresa.com"
                  required
                />
              </label>

              <label>
                <span>Senha *</span>
                <input
                  type="password"
                  value={admin.password}
                  onChange={(e) => setAdmin((p) => ({ ...p, password: e.target.value }))}
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                  required
                />
              </label>

              <label>
                <span>Confirmar senha *</span>
                <input
                  type="password"
                  value={admin.confirmPassword}
                  onChange={(e) => setAdmin((p) => ({ ...p, confirmPassword: e.target.value }))}
                  placeholder="Repita a senha"
                  minLength={6}
                  required
                />
              </label>

              <label>
                <span>Telefone</span>
                <input
                  value={admin.phone}
                  onChange={(e) => setAdmin((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="(11) 98765-4321"
                />
              </label>

              <label>
                <span>Data de nascimento</span>
                <input
                  type="date"
                  value={admin.birthDate}
                  onChange={(e) => setAdmin((p) => ({ ...p, birthDate: e.target.value }))}
                />
              </label>
            </div>

            <button type="submit" className="primary-button submit-button">
              Salvar loja e criar acesso
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
