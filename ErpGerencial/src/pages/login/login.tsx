import { type FormEvent } from 'react'
import './login.css'

type LoginPageProps = {
    onLogin: () => void
}

export default function LoginPage({ onLogin }: LoginPageProps) {
    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        onLogin()
    }

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="brand-block">
                    <span className="brand-tag">ERP</span>
                    <h1>Gerencial</h1>
                    <p>Controle financeiro, comercial e operacional em um único painel.</p>
                </div>

                <form className="login-form" onSubmit={handleSubmit}>
                    <label>
                        <span>E-mail</span>
                        <input type="email" placeholder="seu@email.com" defaultValue="admin@erp.com" />
                    </label>

                    <label>
                        <span>Senha</span>
                        <input type="password" placeholder="••••••••" defaultValue="123456" />
                    </label>

                    <div className="login-options">
                        <label className="remember-me">
                            <input type="checkbox" defaultChecked />
                            Lembrar-me
                        </label>
                        <a href="#">Esqueci a senha</a>
                    </div>

                    <button type="submit" className="primary-button login-button">
                        Entrar no sistema
                    </button>
                </form>
            </div>
        </div>
    )
}
