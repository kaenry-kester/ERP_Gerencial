import { useState, type SubmitEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import BotaoGoogle from '../../components/formulario/BotaoGoogle'
import CampoSenha from '../../components/formulario/CampoSenha'
import CampoTexto from '../../components/formulario/CampoTexto'
import FaixaAviso, { type Aviso } from '../../components/formulario/FaixaAviso'
import {
  IconeCadastro,
  IconeLogin,
  IconeVoltar,
} from '../../components/icones/Icones'
import { useGoogle } from '../../hooks/useGoogle'
import { entrar, ErroApi, mensagemDe, salvarSessao } from '../../services/api'
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
  const navigate = useNavigate()
  // Aviso enviado por outra tela (ex.: sessão expirada)
  const avisoInicial = (useLocation().state as { aviso?: Aviso } | null)?.aviso ?? null
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [aviso, setAviso] = useState<Aviso>(avisoInicial)
  const [enviando, setEnviando] = useState(false)

  // Erros aparecem depois da primeira tentativa e somem assim que o campo é corrigido.
  const erros = enviado ? validar(email, senha) : {}

  const alterar = (setter: (valor: string) => void) => (valor: string) => {
    setter(valor)
    setAviso(null)
  }

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (enviando) return
    setEnviado(true)

    const novos = validar(email, senha)
    const primeiroInvalido = (['email', 'senha'] as const).find((campo) => novos[campo])
    if (primeiroInvalido) {
      document.getElementById(primeiroInvalido)?.focus()
      return
    }

    setEnviando(true)
    setAviso(null)
    try {
      const sessao = await entrar({ email, senha })
      salvarSessao(sessao)
      navigate('/lojas')
    } catch (erro) {
      if (erro instanceof ErroApi && erro.status === 401) document.getElementById('senha')?.focus()
      setAviso({ tipo: 'erro', texto: mensagemDe(erro) })
      setEnviando(false)
    }
  }

  // Entra com o Google (se for a primeira vez, a conta é criada).
  const google = useGoogle(setAviso)

  return (
    <main className="tela-dividida login">
      <aside className="tela-painel">
        <Link to="/" className="tela-logo-link" aria-label="Órion — voltar ao início">
          <img src="/imgs/logo-orion.png" alt="Órion" className="tela-logo" />
        </Link>
        <h1 className="tela-titulo">Acesse sua conta</h1>
        <p className="tela-texto">Seus produtos e clientes estão à um clique de distância.</p>

        {/* Voltar no canto inferior esquerdo do painel (no celular, só a seta, no canto esquerdo da faixa) */}
        <Link to="/" className="ghost-button botao-voltar botao-voltar-painel" aria-label="Voltar">
          <IconeVoltar tamanho={20} />
          <span className="botao-voltar-texto">Voltar</span>
        </Link>
      </aside>

      <section className="tela-area" aria-labelledby="login-titulo">
        <FaixaAviso id="login-titulo" titulo="Entre com seus dados para acessar o sistema:" aviso={aviso} />

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

            <button type="submit" className="primary-button botao-acao" disabled={enviando}>
              <IconeLogin tamanho={22} />
              {enviando ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div className="login-divisor" aria-hidden="true">
            <span>ou</span>
          </div>

          <div className="login-alternativas">
            <BotaoGoogle
              texto={google.enviando ? 'Entrando com o Google...' : 'Continuar com o Google'}
              textoCurto="Google"
              onClick={google.entrar}
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
