import { useEffect, useState, type SubmitEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import CampoSenha from '../../components/formulario/CampoSenha'
import CampoTexto from '../../components/formulario/CampoTexto'
import FaixaAviso, { type Aviso } from '../../components/formulario/FaixaAviso'
import { IconeLogin, IconeLoja, IconeVoltar } from '../../components/icones/Icones'
import { entrarNaLoja, ErroApi, lerSessao, mensagemDe, salvarSessaoLoja } from '../../services/api'
import { cnpjValido, formatarCnpj, normalizarCnpj } from '../../utils/validacao'
import '../../styles/acesso.css'
import '../../styles/tela-dividida.css'
import '../login/login.css'
import './lojas.css'

type Erros = {
  cnpj?: string
  senha?: string
}

type Estado = { cnpj?: string; aviso?: Aviso } | null

function validar(cnpj: string, senha: string): Erros {
  const erros: Erros = {}
  const c = normalizarCnpj(cnpj)
  if (!c) erros.cnpj = 'Digite o CNPJ'
  else if (c.length < 14) erros.cnpj = 'CNPJ incompleto'
  else if (!cnpjValido(c)) erros.cnpj = 'CNPJ inválido'
  if (!senha) erros.senha = 'Digite a senha'
  return erros
}

// Acesso à loja com CNPJ e senha. Chega com o CNPJ preenchido quando vem da lista de lojas
// ou logo depois do cadastro da loja.
export default function LojaLoginPage() {
  const navigate = useNavigate()
  const estado = useLocation().state as Estado
  const [temConta] = useState(() => lerSessao() !== null)
  const [cnpj, setCnpj] = useState(() => formatarCnpj(estado?.cnpj ?? ''))
  const [senha, setSenha] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  // Aviso enviado por outra tela (loja criada, sessão expirada)
  const [aviso, setAviso] = useState<Aviso>(estado?.aviso ?? null)

  // Com o CNPJ já preenchido, o cursor vai direto para a senha.
  useEffect(() => {
    document.getElementById(estado?.cnpj ? 'senha' : 'cnpj')?.focus()
  }, [estado?.cnpj])

  const erros = enviado ? validar(cnpj, senha) : {}

  const alterar = (setter: (valor: string) => void) => (valor: string) => {
    setter(valor)
    setAviso(null)
  }

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (enviando) return
    setEnviado(true)

    const novos = validar(cnpj, senha)
    const primeiroInvalido = (['cnpj', 'senha'] as const).find((campo) => novos[campo])
    if (primeiroInvalido) {
      document.getElementById(primeiroInvalido)?.focus()
      return
    }

    setEnviando(true)
    setAviso(null)
    try {
      const sessao = await entrarNaLoja({ cnpj: normalizarCnpj(cnpj), senha })
      salvarSessaoLoja(sessao)
      navigate('/loja', { replace: true })
    } catch (erro) {
      if (erro instanceof ErroApi && erro.status === 401) document.getElementById('senha')?.focus()
      setAviso({ tipo: 'erro', texto: mensagemDe(erro) })
      setEnviando(false)
    }
  }

  return (
    <main className="tela-dividida login loja-login">
      <aside className="tela-painel">
        <Link to="/" className="tela-logo-link" aria-label="Órion — início">
          <img src="/imgs/logo-orion.png" alt="Órion" className="tela-logo" />
        </Link>
        <h1 className="tela-titulo">Entre na sua loja</h1>
        <p className="tela-texto">Use o CNPJ e a senha da loja para cuidar dos seus produtos.</p>

        <Link
          to={temConta ? '/lojas' : '/'}
          className="ghost-button botao-voltar botao-voltar-painel"
          aria-label="Voltar"
        >
          <IconeVoltar tamanho={20} />
          <span className="botao-voltar-texto">Voltar</span>
        </Link>
      </aside>

      <section className="tela-area" aria-labelledby="loja-login-titulo">
        <FaixaAviso id="loja-login-titulo" titulo="Digite o CNPJ e a senha da loja:" aviso={aviso} />

        <div className="login-conteudo">
          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <CampoTexto
              id="cnpj"
              rotulo="CNPJ"
              autoComplete="username"
              placeholder="00.000.000/0000-00"
              valor={cnpj}
              onChange={alterar((valor) => setCnpj(formatarCnpj(valor)))}
              erro={erros.cnpj}
            />

            <CampoSenha
              id="senha"
              rotulo="Senha da loja"
              autoComplete="current-password"
              valor={senha}
              onChange={alterar(setSenha)}
              erro={erros.senha}
            />

            <button type="submit" className="primary-button botao-acao" disabled={enviando}>
              <IconeLogin tamanho={22} />
              {enviando ? 'Entrando...' : 'Entrar na loja'}
            </button>
          </form>

          <div className="login-divisor" aria-hidden="true">
            <span>ou</span>
          </div>

          <div className="login-alternativas unica">
            <Link to="/lojas/nova" className="ghost-button login-botao-cadastro">
              <IconeLoja tamanho={20} />
              Cadastrar nova loja
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
