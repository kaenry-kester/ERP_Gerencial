import { useState, type SubmitEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import CampoSenha from '../../components/formulario/CampoSenha'
import CampoTexto from '../../components/formulario/CampoTexto'
import FaixaAviso, { type Aviso } from '../../components/formulario/FaixaAviso'
import { IconeCadastro, IconeLogin, IconeVoltar } from '../../components/icones/Icones'
import { IlustracaoEntrar } from '../../components/icones/Ilustracoes'
import { entrar, ErroApi, mensagemDe, salvarSessao } from '../../services/api'
import { emailValido, telefoneValido } from '../../utils/validacao'
import '../../styles/acesso.css'
import '../../styles/tela-dividida.css'
import './login.css'

type Erros = {
  acesso?: string
  senha?: string
}

/** Um campo só: com "@" ou letras é e-mail; só números é o celular (o mesmo cadastrado em Minha conta), com ou sem +55. */
const ehEmail = (acesso: string) => /[@a-z]/i.test(acesso)
const celularDe = (acesso: string) => {
  const digitos = acesso.replace(/\D/g, '')
  return digitos.length > 11 && digitos.startsWith('55') ? digitos.slice(2) : digitos
}

function validar(acesso: string, senha: string): Erros {
  const erros: Erros = {}
  if (!acesso.trim()) erros.acesso = 'Digite seu e-mail ou celular'
  else if (ehEmail(acesso) ? !emailValido(acesso) : !telefoneValido(celularDe(acesso)))
    erros.acesso = ehEmail(acesso) ? 'E-mail inválido' : 'Celular inválido'
  if (!senha) erros.senha = 'Digite sua senha'
  return erros
}

/* Login: e-mail ou celular (um campo só) e a senha. Senha certa → entra direto (sem código de verificação). */

export default function LoginPage() {
  const navigate = useNavigate()
  // Aviso enviado por outra tela (ex.: sessão expirada)
  const avisoInicial = (useLocation().state as { aviso?: Aviso } | null)?.aviso ?? null
  // E-mail ou número de celular
  const [acesso, setAcesso] = useState('')
  const [senha, setSenha] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [aviso, setAviso] = useState<Aviso>(avisoInicial)
  const [enviando, setEnviando] = useState(false)

  // Erros aparecem depois da primeira tentativa e somem assim que o campo é corrigido.
  const erros = enviado ? validar(acesso, senha) : {}

  const alterar = (setter: (valor: string) => void) => (valor: string) => {
    setter(valor)
    setAviso(null)
  }

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (enviando) return
    setEnviado(true)

    const novos = validar(acesso, senha)
    const primeiroInvalido = (['acesso', 'senha'] as const).find((campo) => novos[campo])
    if (primeiroInvalido) {
      document.getElementById(primeiroInvalido)?.focus()
      return
    }

    setEnviando(true)
    setAviso(null)
    try {
      salvarSessao(await entrar(ehEmail(acesso) ? { email: acesso, senha } : { telefone: celularDe(acesso), senha }))
      navigate('/app')
    } catch (erro) {
      if (erro instanceof ErroApi && erro.status === 401) document.getElementById('senha')?.focus()
      setAviso({ tipo: 'erro', texto: mensagemDe(erro) })
      setEnviando(false)
    }
  }

  return (
    <main className="tela-dividida login">
      <aside className="tela-painel">
        <Link to="/" className="tela-logo-link" aria-label="Órion — voltar ao início">
          <img src="/imgs/logo-orion.png" alt="Órion" className="tela-logo" />
        </Link>
        <h1 className="tela-titulo">Acesse sua conta</h1>
        <p className="tela-texto">Seus produtos e clientes estão a um clique de distância.</p>

        {/* Ilustração do painel (some no celular, onde o painel vira uma faixa) */}
        <div className="tela-painel-arte" aria-hidden="true">
          <IlustracaoEntrar tamanho={200} />
        </div>

        {/* Voltar no canto inferior esquerdo do painel (no celular, só a seta, no canto esquerdo da faixa) */}
        <Link to="/" className="ghost-button botao-voltar botao-voltar-painel" aria-label="Voltar">
          <IconeVoltar tamanho={20} />
          <span className="botao-voltar-texto">Voltar</span>
        </Link>
      </aside>

      <section className="tela-area" aria-labelledby="login-titulo">
        <FaixaAviso id="login-titulo" titulo="Entre com seus dados para acessar o sistema:" aviso={aviso} />

        {/* Uma coluna centralizada na área branca: e-mail ou celular, senha e Entrar; abaixo, "ou" e criar conta */}
        <div className="login-conteudo">
          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <CampoTexto
              id="acesso"
              rotulo="E-mail ou número de celular"
              autoComplete="username"
              placeholder="nome@empresa.com ou (00) 00000-0000"
              valor={acesso}
              onChange={alterar(setAcesso)}
              erro={erros.acesso}
            />

            <CampoSenha
              id="senha"
              rotulo="Senha"
              autoComplete="current-password"
              valor={senha}
              onChange={alterar(setSenha)}
              erro={erros.senha}
            />
            <p className="login-esqueci">
              <Link to="/recuperar-senha" className="login-link">
                Esqueci minha senha
              </Link>
            </p>

            <button type="submit" className="primary-button botao-acao" disabled={enviando}>
              <IconeLogin tamanho={22} />
              {enviando ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div className="login-divisor" aria-hidden="true">
            <span>ou</span>
          </div>

          {/* Criar conta: centralizado, abaixo do "ou" */}
          <div className="login-alternativas">
            <Link to="/cadastro" className="ghost-button login-botao-cadastro">
              <IconeCadastro tamanho={20} />
              Criar minha conta
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
