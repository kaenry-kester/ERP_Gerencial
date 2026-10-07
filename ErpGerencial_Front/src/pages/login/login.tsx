import { useEffect, useState, type SubmitEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import CampoSenha from '../../components/formulario/CampoSenha'
import CampoTexto from '../../components/formulario/CampoTexto'
import FaixaAviso, { type Aviso } from '../../components/formulario/FaixaAviso'
import { IconeCadastro, IconeCheck, IconeLogin, IconeVoltar } from '../../components/icones/Icones'
import { IlustracaoConta, IlustracaoEntrar } from '../../components/icones/Ilustracoes'
import {
  destinoDepoisDeEntrar,
  entrar,
  ErroApi,
  esquecerLembrado,
  lerLembrado,
  mensagemDe,
  precisaDeCodigo,
  reenviarCodigo,
  salvarLembrado,
  salvarSessao,
  verificarCodigo,
  type Verificacao,
} from '../../services/api'
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

/*
  Login em duas etapas (segurança):
  1) e-mail e senha → a API envia um código de 6 dígitos para o e-mail;
  2) a pessoa digita o código. "Lembrar de quem sou" faz este navegador não pedir
     o código por 30 dias (e já deixa o e-mail preenchido).
*/
export default function LoginPage() {
  const navigate = useNavigate()
  // Aviso enviado por outra tela (ex.: sessão expirada)
  const avisoInicial = (useLocation().state as { aviso?: Aviso } | null)?.aviso ?? null
  const [lembrado, setLembrado] = useState(lerLembrado)
  const [email, setEmail] = useState(() => lembrado?.email ?? '')
  const [senha, setSenha] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [aviso, setAviso] = useState<Aviso>(avisoInicial)
  const [enviando, setEnviando] = useState(false)

  // 2ª etapa
  const [verificacao, setVerificacao] = useState<Verificacao | null>(null)
  const [codigo, setCodigo] = useState('')
  const [erroCodigo, setErroCodigo] = useState<string>()
  const [lembrar, setLembrar] = useState(false)
  const [esperaReenvio, setEsperaReenvio] = useState(0)

  // Contagem regressiva do "Reenviar código"
  useEffect(() => {
    if (esperaReenvio <= 0) return
    const id = window.setTimeout(() => setEsperaReenvio((s) => s - 1), 1000)
    return () => window.clearTimeout(id)
  }, [esperaReenvio])

  // Erros aparecem depois da primeira tentativa e somem assim que o campo é corrigido.
  const erros = enviado ? validar(email, senha) : {}

  const alterar = (setter: (valor: string) => void) => (valor: string) => {
    setter(valor)
    setAviso(null)
  }

  const iniciarVerificacao = (v: Verificacao) => {
    setVerificacao(v)
    setCodigo('')
    setErroCodigo(undefined)
    setEsperaReenvio(v.reenviarEmSegundos)
    setAviso({ tipo: 'ok', texto: `Enviamos um código de 6 dígitos para ${v.email}.` })
    requestAnimationFrame(() => document.getElementById('codigo')?.focus())
  }

  const voltarParaSenha = (novoAviso: Aviso = null) => {
    setVerificacao(null)
    setSenha('')
    setEnviado(false)
    setAviso(novoAviso)
    requestAnimationFrame(() => document.getElementById('senha')?.focus())
  }

  // 1ª etapa: e-mail e senha
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
      const resposta = await entrar({ email, senha })
      if (precisaDeCodigo(resposta)) {
        iniciarVerificacao(resposta)
        setEnviando(false)
        return
      }
      // Navegador lembrado: entra direto
      salvarSessao(resposta)
      navigate(destinoDepoisDeEntrar(resposta))
    } catch (erro) {
      if (erro instanceof ErroApi && erro.status === 401) document.getElementById('senha')?.focus()
      setAviso({ tipo: 'erro', texto: mensagemDe(erro) })
      setEnviando(false)
    }
  }

  // 2ª etapa: código do e-mail
  const confirmarCodigo = async (valor = codigo) => {
    if (enviando || !verificacao) return
    if (valor.length !== 6) {
      setErroCodigo('Digite os 6 números')
      document.getElementById('codigo')?.focus()
      return
    }

    setEnviando(true)
    setAviso(null)
    try {
      const { dispositivo, ...sessao } = await verificarCodigo({
        desafioId: verificacao.desafioId,
        codigo: valor,
        lembrar,
      })
      salvarSessao(sessao)
      if (dispositivo) salvarLembrado({ email: sessao.usuario.email, token: dispositivo })
      navigate(destinoDepoisDeEntrar(sessao))
    } catch (erro) {
      setEnviando(false)
      const texto = mensagemDe(erro)
      // Código vencido ou tentativas esgotadas: precisa da senha de novo para gerar outro.
      if (texto.includes('Entre de novo')) {
        voltarParaSenha({ tipo: 'erro', texto })
        return
      }
      setErroCodigo(erro instanceof ErroApi && erro.campo === 'codigo' ? 'Confira o código' : undefined)
      setAviso({ tipo: 'erro', texto })
      setCodigo('')
      document.getElementById('codigo')?.focus()
    }
  }

  const alterarCodigo = (valor: string) => {
    const digitos = valor.replace(/\D/g, '').slice(0, 6)
    setCodigo(digitos)
    setErroCodigo(undefined)
    setAviso(null)
    // Com os 6 números, confirma sozinho (como em apps de banco)
    if (digitos.length === 6) confirmarCodigo(digitos)
  }

  const reenviar = async () => {
    if (!verificacao || esperaReenvio > 0) return
    setAviso(null)
    try {
      iniciarVerificacao(await reenviarCodigo(verificacao.desafioId))
    } catch (erro) {
      const texto = mensagemDe(erro)
      if (texto.includes('Entre de novo')) voltarParaSenha({ tipo: 'erro', texto })
      else setAviso({ tipo: 'erro', texto })
    }
  }

  const esquecer = () => {
    esquecerLembrado()
    setLembrado(null)
    setEmail('')
    setAviso({ tipo: 'ok', texto: 'Este computador foi esquecido. O código será pedido no próximo acesso.' })
  }

  return (
    <main className="tela-dividida login">
      <aside className="tela-painel">
        <Link to="/" className="tela-logo-link" aria-label="Órion — voltar ao início">
          <img src="/imgs/logo-orion.png" alt="Órion" className="tela-logo" />
        </Link>
        <h1 className="tela-titulo">{verificacao ? 'Confirme que é você' : 'Acesse sua conta'}</h1>
        <p className="tela-texto">
          {verificacao
            ? 'Para proteger sua conta, pedimos um código enviado ao seu e-mail.'
            : 'Seus produtos e clientes estão a um clique de distância.'}
        </p>

        {/* Ilustração do painel (some no celular, onde o painel vira uma faixa) */}
        <div className="tela-painel-arte" aria-hidden="true">
          {verificacao ? <IlustracaoConta tamanho={200} /> : <IlustracaoEntrar tamanho={200} />}
        </div>

        {/* Voltar no canto inferior esquerdo do painel (no celular, só a seta, no canto esquerdo da faixa) */}
        {verificacao ? (
          <button
            type="button"
            className="ghost-button botao-voltar botao-voltar-painel"
            onClick={() => voltarParaSenha()}
            aria-label="Voltar"
          >
            <IconeVoltar tamanho={20} />
            <span className="botao-voltar-texto">Voltar</span>
          </button>
        ) : (
          <Link to="/" className="ghost-button botao-voltar botao-voltar-painel" aria-label="Voltar">
            <IconeVoltar tamanho={20} />
            <span className="botao-voltar-texto">Voltar</span>
          </Link>
        )}
      </aside>

      <section className="tela-area" aria-labelledby="login-titulo">
        <FaixaAviso
          id="login-titulo"
          titulo={verificacao ? 'Digite o código enviado para o seu e-mail:' : 'Entre com seus dados para acessar o sistema:'}
          aviso={aviso}
        />

        {verificacao ? (
          <div className="login-conteudo">
            <form
              className="login-form"
              onSubmit={(e) => {
                e.preventDefault()
                confirmarCodigo()
              }}
              noValidate
            >
              <CampoTexto
                id="codigo"
                rotulo="Código de 6 números"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                valor={codigo}
                onChange={alterarCodigo}
                erro={erroCodigo}
                className="campo-codigo"
              />

              <label className="login-lembrar">
                <input type="checkbox" checked={lembrar} onChange={(e) => setLembrar(e.target.checked)} />
                <span>
                  <span className="login-lembrar-titulo">Lembrar de quem sou</span>
                  <span className="login-lembrar-texto">
                    Não pedir o código neste computador por 30 dias. Não marque em computadores públicos.
                  </span>
                </span>
              </label>

              <button type="submit" className="primary-button botao-acao" disabled={enviando}>
                <IconeCheck tamanho={22} />
                {enviando ? 'Confirmando...' : 'Confirmar e entrar'}
              </button>
            </form>

            <div className="login-codigo-acoes">
              <button type="button" className="login-link" onClick={reenviar} disabled={esperaReenvio > 0}>
                {esperaReenvio > 0 ? `Reenviar código em ${esperaReenvio}s` : 'Reenviar código'}
              </button>
              <button type="button" className="login-link" onClick={() => voltarParaSenha()}>
                Usar outra conta
              </button>
            </div>
          </div>
        ) : (
          /* Uma coluna centralizada na área branca: e-mail, senha e Entrar; abaixo, "ou" e criar conta */
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

              {lembrado && (
                <p className="login-lembrado">
                  Computador lembrado para {lembrado.email}.{' '}
                  <button type="button" className="login-link" onClick={esquecer}>
                    Esquecer
                  </button>
                </p>
              )}
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
        )}
      </section>
    </main>
  )
}
