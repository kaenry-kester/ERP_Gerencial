import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { IconeLogin, IconeOlho, IconeOlhoFechado, IconeVoltar } from '../../components/icones/Icones'
import '../../styles/acesso.css'

type Erros = {
  email?: string
  senha?: string
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [erros, setErros] = useState<Erros>({})
  const [aviso, setAviso] = useState('')

  const validar = (): Erros => {
    const novos: Erros = {}
    if (!email.trim()) {
      novos.email = 'Digite o seu e-mail.'
    } else if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      novos.email = 'Este e-mail não parece correto. Exemplo: nome@empresa.com'
    }
    if (!senha) {
      novos.senha = 'Digite a sua senha.'
    }
    return novos
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const novos = validar()
    setErros(novos)
    setAviso('')

    if (Object.keys(novos).length > 0) return

    // TODO: enviar para a API ASP.NET quando o back-end estiver pronto.
    setAviso('Dados conferidos. A conexão com o servidor será feita na próxima etapa.')
  }

  return (
    <div className="acesso-pagina">
      <main className="acesso-cartao estreito">
        <h1 className="acesso-titulo">Acesse seu painel</h1>
        <p className="acesso-texto">Seus produtos e clientes estão a um clique de distância.</p>

        <form className="formulario" onSubmit={handleSubmit} noValidate>
          {aviso && (
            <div className="aviso info" role="status">
              {aviso}
            </div>
          )}

          <div className="campo">
            <label htmlFor="email" className="campo-rotulo">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="nome@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!erros.email}
              aria-describedby={erros.email ? 'email-erro' : undefined}
            />
            {erros.email && (
              <p id="email-erro" className="campo-erro">
                {erros.email}
              </p>
            )}
          </div>

          <div className="campo">
            <label htmlFor="senha" className="campo-rotulo">
              Senha
            </label>
            <div className="campo-entrada">
              <input
                id="senha"
                className="com-botao"
                type={mostrarSenha ? 'text' : 'password'}
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                aria-invalid={!!erros.senha}
                aria-describedby={erros.senha ? 'senha-erro' : undefined}
              />
              <button
                type="button"
                className="botao-mostrar-senha"
                onClick={() => setMostrarSenha((v) => !v)}
                aria-pressed={mostrarSenha}
              >
                {mostrarSenha ? <IconeOlhoFechado tamanho={18} /> : <IconeOlho tamanho={18} />}
                {mostrarSenha ? 'Esconder' : 'Mostrar'}
              </button>
            </div>
            {erros.senha && (
              <p id="senha-erro" className="campo-erro">
                {erros.senha}
              </p>
            )}
          </div>

          <button type="submit" className="primary-button botao-acao">
            <IconeLogin tamanho={22} />
            Entrar
          </button>
        </form>

        <div className="acesso-rodape-form">
          <Link to="/" className="ghost-button botao-voltar">
            <IconeVoltar tamanho={20} />
            Voltar
          </Link>
          <p>
            Não tem conta?{' '}
            <Link to="/cadastro" className="link-destaque">
              Cadastre-se
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
