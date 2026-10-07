import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useErp } from '../context/ErpContext'
import '../styles/forms.css'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, isStoreRegistered, store } = useErp()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  if (!isStoreRegistered) {
    return <Navigate to="/" replace />
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    const success = login(email, password)
    if (success) {
      navigate('/dashboard')
      return
    }

    setError('E-mail ou senha incorretos.')
  }

  return (
    <div className="page-shell login-shell">
      <main className="login-page-wrap">
        <div className="login-panel">
          <div className="brand-block">
            <span className="brand-mark">ERP</span>
            <h1>{isStoreRegistered ? store.name : 'ERP Gerencial'}</h1>
            <p>Controle de estoque, pessoas, clientes e financeiro em um único ambiente.</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="form-header compact-header">
              <div>
                <h2>Login da loja</h2>
              </div>
            </div>

            {error && <div className="error-box">{error}</div>}

            <label>
              <span>E-mail</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
              />
            </label>

            <label>
              <span>Senha</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                required
              />
            </label>

            <button type="submit" className="primary-button submit-button">
              Entrar no sistema
            </button>

            <Link to="/" className="ghost-button full-width-button">
              Voltar ao início
            </Link>
          </form>
        </div>
      </main>
    </div>
  )
}
