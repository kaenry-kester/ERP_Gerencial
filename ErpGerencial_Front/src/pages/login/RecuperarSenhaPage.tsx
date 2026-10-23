import { useEffect, useState, type SubmitEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { avisarSalvo } from '../../components/aviso-salvo/avisarSalvo'
import CampoSenha from '../../components/formulario/CampoSenha'
import CampoTexto from '../../components/formulario/CampoTexto'
import FaixaAviso, { type Aviso } from '../../components/formulario/FaixaAviso'
import RequisitosSenha from '../../components/formulario/RequisitosSenha'
import { IconeCheck, IconeEmail, IconeVoltar } from '../../components/icones/Icones'
import { IlustracaoEntrar } from '../../components/icones/Ilustracoes'
import { mensagemDe, pedirCodigoDeSenha, redefinirSenha, reenviarCodigoDeSenha, salvarSessao } from '../../services/api'
import { emailValido, requisitosSenha, telefoneValido } from '../../utils/validacao'
import '../../styles/acesso.css'
import '../../styles/tela-dividida.css'
import './login.css'

const ehEmail = (acesso: string) => /[@a-z]/i.test(acesso)
const celularDe = (acesso: string) => {
  const digitos = acesso.replace(/\D/g, '')
  return digitos.length > 11 && digitos.startsWith('55') ? digitos.slice(2) : digitos
}

/*
  Esqueci minha senha, em duas etapas:
  1. e-mail ou celular da conta → um código de 6 números vai para o e-mail cadastrado;
  2. o código e a senha nova → a senha muda e a pessoa já entra no sistema.
*/
export default function RecuperarSenhaPage() {
  const navigate = useNavigate()
  const [acesso, setAcesso] = useState('')
  const [desafioId, setDesafioId] = useState<string | null>(null)
  const [codigo, setCodigo] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [espera, setEspera] = useState(0)
  const [aviso, setAviso] = useState<Aviso>(null)

  // Contagem para poder pedir outro código
  useEffect(() => {
    if (espera <= 0) return
    const id = window.setTimeout(() => setEspera((s) => s - 1), 1000)
    return () => window.clearTimeout(id)
  }, [espera])

  const erroAcesso = !acesso.trim()
    ? 'Digite seu e-mail ou celular'
    : (ehEmail(acesso) ? !emailValido(acesso) : !telefoneValido(celularDe(acesso)))
      ? ehEmail(acesso) ? 'E-mail inválido' : 'Celular inválido'
      : undefined

  const pedir = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (enviando) return
    setEnviado(true)
    if (erroAcesso) {
      document.getElementById('acesso')?.focus()
      return
    }
    setEnviando(true)
    setAviso(null)
    try {
      const r = await pedirCodigoDeSenha(ehEmail(acesso) ? { email: acesso.trim() } : { telefone: celularDe(acesso) })
      setDesafioId(r.desafioId)
      setEspera(r.reenviarEmSegundos)
      setEnviado(false)
      setAviso({ tipo: 'ok', texto: 'Se houver uma conta com esses dados, o código chegou no e-mail dela.' })
      window.setTimeout(() => document.getElementById('codigo')?.focus(), 0)
    } catch (erro) {
      setAviso({ tipo: 'erro', texto: mensagemDe(erro) })
    } finally {
      setEnviando(false)
    }
  }

  const reenviar = async () => {
    if (!desafioId || espera > 0) return
    try {
      const r = await reenviarCodigoDeSenha(desafioId)
      setEspera(r.reenviarEmSegundos)
      setAviso({ tipo: 'ok', texto: 'Enviamos um código novo.' })
    } catch (erro) {
      setAviso({ tipo: 'erro', texto: mensagemDe(erro) })
    }
  }

  const errosSenha = {
    codigo: codigo.length !== 6 ? '6 números' : undefined,
    senha: requisitosSenha(senha).some((r) => !r.atendido) ? 'Veja os requisitos' : undefined,
    confirmacao: confirmacao !== senha ? 'As senhas não são iguais' : undefined,
  }

  const trocar = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (enviando || !desafioId) return
    setEnviado(true)
    const invalido = (['codigo', 'senha', 'confirmacao'] as const).find((c) => errosSenha[c])
    if (invalido) {
      document.getElementById(invalido)?.focus()
      return
    }
    setEnviando(true)
    setAviso(null)
    try {
      salvarSessao(await redefinirSenha({ desafioId, codigo, novaSenha: senha }))
      avisarSalvo('Senha criada com sucesso', 'Você já entrou no sistema')
      navigate('/app')
    } catch (erro) {
      setCodigo('')
      setAviso({ tipo: 'erro', texto: mensagemDe(erro) })
      document.getElementById('codigo')?.focus()
      setEnviando(false)
    }
  }

  return (
    <main className="tela-dividida login">
      <aside className="tela-painel">
        <Link to="/" className="tela-logo-link" aria-label="Órion — voltar ao início">
          <img src="/imgs/logo-orion.png" alt="Órion" className="tela-logo" />
        </Link>
        <h1 className="tela-titulo">Esqueceu a senha?</h1>
        <p className="tela-texto">Sem problema: mandamos um código para o seu e-mail e você cria uma senha nova.</p>
        <div className="tela-painel-arte" aria-hidden="true">
          <IlustracaoEntrar tamanho={200} />
        </div>
        <Link to="/login" className="ghost-button botao-voltar botao-voltar-painel" aria-label="Voltar para o login">
          <IconeVoltar tamanho={20} />
          <span className="botao-voltar-texto">Voltar</span>
        </Link>
      </aside>

      <section className="tela-area" aria-labelledby="recuperar-titulo">
        <FaixaAviso
          id="recuperar-titulo"
          titulo={desafioId ? 'Digite o código que chegou no seu e-mail e a senha nova:' : 'Digite o e-mail ou o celular da sua conta:'}
          aviso={aviso}
        />
        <div className="login-conteudo">
          {!desafioId ? (
            <form className="login-form" onSubmit={pedir} noValidate>
              <CampoTexto
                id="acesso"
                rotulo="E-mail ou número de celular"
                autoComplete="username"
                valor={acesso}
                onChange={(v) => {
                  setAcesso(v)
                  setAviso(null)
                }}
                erro={enviado ? erroAcesso : undefined}
              />
              <button type="submit" className="primary-button botao-acao" disabled={enviando}>
                <IconeEmail tamanho={22} />
                {enviando ? 'Enviando...' : 'Enviar código'}
              </button>
            </form>
          ) : (
            <form className="login-form" onSubmit={trocar} noValidate>
              <CampoTexto
                id="codigo"
                rotulo="Código de 6 números"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                valor={codigo}
                onChange={(v) => {
                  setCodigo(v.replace(/\D/g, '').slice(0, 6))
                  setAviso(null)
                }}
                erro={enviado ? errosSenha.codigo : undefined}
              />
              <CampoSenha
                id="senha"
                rotulo="Senha nova"
                autoComplete="new-password"
                valor={senha}
                onChange={setSenha}
                erro={enviado ? errosSenha.senha : undefined}
              />
              {senha && <RequisitosSenha id="senha-requisitos" senha={senha} />}
              <CampoSenha
                id="confirmacao"
                rotulo="Repita a senha nova"
                autoComplete="new-password"
                valor={confirmacao}
                onChange={setConfirmacao}
                erro={enviado ? errosSenha.confirmacao : undefined}
              />
              <button type="submit" className="primary-button botao-acao" disabled={enviando}>
                <IconeCheck tamanho={22} />
                {enviando ? 'Salvando...' : 'Criar senha nova e entrar'}
              </button>
              <p className="login-esqueci">
                <button type="button" className="login-link" disabled={espera > 0} onClick={() => void reenviar()}>
                  {espera > 0 ? `Pedir outro código em ${espera}s` : 'Não chegou? Pedir outro código'}
                </button>
              </p>
            </form>
          )}
          <div className="login-alternativas">
            <Link to="/login" className="login-link">
              Lembrei a senha: voltar para o login
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
