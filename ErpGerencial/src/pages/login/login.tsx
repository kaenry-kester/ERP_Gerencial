import { useState, type SubmitEvent } from 'react'
import { Link } from 'react-router-dom'
import BotaoGoogle from '../../components/formulario/BotaoGoogle'
import CampoSenha from '../../components/formulario/CampoSenha'
import CampoTexto from '../../components/formulario/CampoTexto'
import { IconeCadastro, IconeCheck, IconeLogin, IconeVoltar } from '../../components/icones/Icones'
import { emailValido } from '../../utils/validacao'
import '../../styles/acesso.css'
import '../../styles/tela-dividida.css'
import './login.css'

type Erros = {
  email?: string
  senha?: string
}

function validar(email: string, senha: string): Erros {
  const erros: Erros = {}
  if (!email.trim()) {
    erros.email = 'Digite seu e-mail'
  } else if (!emailValido(email)) {
    erros.email = 'E-mail inválido'
  }
  if (!senha) {
    erros.senha = 'Digite sua senha'
  }
  return erros
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [aviso, setAviso] = useState('')

  // Erros aparecem depois da primeira tentativa e somem assim que o campo é corrigido.
  const erros = enviado ? validar(email, senha) : {}

  const alterar = (setter: (valor: string) => void) => (valor: string) => {
    setter(valor)
    setAviso('')
  }

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    setEnviado(true)

    const novos = validar(email, senha)
    const primeiroInvalido = (['email', 'senha'] as const).find((campo) => novos[campo])
    if (primeiroInvalido) {
      document.getElementById(primeiroInvalido)?.focus()
      return
    }

    // TODO: enviar para a API ASP.NET quando o back-end estiver pronto.
    setAviso('Dados conferidos! O acesso será ligado ao servidor na próxima etapa.')
  }

  // TODO: ligar ao Google Identity Services + validação do token na API ASP.NET.
  const entrarComGoogle = () =>
    setAviso('O acesso com o Google será ligado ao servidor na próxima etapa.')

  return (
    <main className="tela-dividida login">
      <aside className="tela-painel">
        <Link to="/" className="tela-logo-link" aria-label="Órion — voltar ao início">
          <img src="/imgs/logo-orion.png" alt="Órion" className="tela-logo" />
        </Link>
        <h1 className="tela-titulo">Acesse sua conta</h1>
        <p className="tela-texto">Seus produtos e clientes estão a um clique de distância.</p>

        {/* Voltar no canto inferior esquerdo do painel (no celular, só a seta, no canto esquerdo da faixa) */}
        <Link to="/" className="ghost-button botao-voltar botao-voltar-painel" aria-label="Voltar">
          <IconeVoltar tamanho={20} />
          <span className="botao-voltar-texto">Voltar</span>
        </Link>
      </aside>

      <section className="tela-area" aria-labelledby="login-titulo">
        {/* Faixa cinza de largura total; o aviso aparece no lugar da frase */}
        <div className="tela-faixa">
          <h2 id="login-titulo" className={aviso ? 'tela-faixa-titulo sr-only' : 'tela-faixa-titulo'}>
            Entre com seus dados para acessar o sistema:
          </h2>
          <p className="tela-status" role="status">
            {aviso && (
              <>
                <IconeCheck tamanho={16} />
                {aviso}
              </>
            )}
          </p>
        </div>

        {/* Uma coluna centralizada na área branca: e-mail, senha e Entrar; abaixo, "ou" e as alternativas */}
        <div className="login-conteudo">
          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <CampoTexto
              id="email"
              rotulo="E-mail"
              type="email"
              autoComplete="email"
              placeholder="nome@empresa.com"
              valor={email}
              onChange={alterar(setEmail)}
              erro={erros.email}
            />

            <CampoSenha
              id="senha"
              rotulo="Senha"
              autoComplete="current-password"
              valor={senha}
              onChange={alterar(setSenha)}
              erro={erros.senha}
            />

            <button type="submit" className="primary-button botao-acao">
              <IconeLogin tamanho={22} />
              Entrar
            </button>
          </form>

          <div className="login-divisor" aria-hidden="true">
            <span>ou</span>
          </div>

          <div className="login-alternativas">
            <BotaoGoogle
              texto="Continuar com o Google"
              textoCurto="Google"
              onClick={entrarComGoogle}
            />
            <Link
              to="/cadastro"
              className="ghost-button login-botao-cadastro"
              aria-label="Criar minha conta"
            >
              <IconeCadastro tamanho={20} />
              <span className="texto-longo">Criar minha conta</span>
              <span className="texto-curto" aria-hidden="true">
                Criar conta
              </span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
