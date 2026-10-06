import { useState, type SubmitEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BotaoGoogle from '../../components/formulario/BotaoGoogle'
import CampoSenha from '../../components/formulario/CampoSenha'
import CampoTexto from '../../components/formulario/CampoTexto'
import FaixaAviso, { type Aviso } from '../../components/formulario/FaixaAviso'
import RequisitosSenha from '../../components/formulario/RequisitosSenha'
import { IconeCadastro, IconeVoltar } from '../../components/icones/Icones'
import { useGoogle } from '../../hooks/useGoogle'
import { cadastrar, ErroApi, mensagemDe, salvarSessao } from '../../services/api'
import {
  emailValido,
  formatarTelefone,
  requisitosSenha,
  telefoneValido,
} from '../../utils/validacao'
import '../../styles/acesso.css'
import '../../styles/tela-dividida.css'
import './cadastro.css'

type Campo = 'nome' | 'email' | 'telefone' | 'senha' | 'confirmacao'
type Valores = Record<Campo, string>
type Erros = Partial<Record<Campo, string>>
const ORDEM_CAMPOS: Campo[] = ['nome', 'email', 'telefone', 'senha', 'confirmacao']

const VALORES_INICIAIS: Valores = {
  nome: '',
  email: '',
  telefone: '',
  senha: '',
  confirmacao: '',
}

function validar(valores: Valores): Erros {
  const erros: Erros = {}

  if (!valores.nome.trim()) {
    erros.nome = 'Digite seu nome'
  } else if (valores.nome.trim().length < 3) {
    erros.nome = 'Mínimo de 3 letras'
  }

  if (!valores.email.trim()) {
    erros.email = 'Digite seu e-mail'
  } else if (!emailValido(valores.email)) {
    erros.email = 'E-mail inválido'
  }

  if (!valores.telefone) {
    erros.telefone = 'Digite com DDD'
  } else if (!telefoneValido(valores.telefone)) {
    erros.telefone = 'Número incompleto'
  }

  if (!valores.senha) {
    erros.senha = 'Crie uma senha'
  } else if (requisitosSenha(valores.senha).some((r) => !r.atendido)) {
    erros.senha = 'Faltam requisitos'
  }

  if (!valores.confirmacao) {
    erros.confirmacao = 'Digite novamente'
  } else if (valores.confirmacao !== valores.senha) {
    erros.confirmacao = 'Senhas diferentes'
  }

  return erros
}

export default function CadastroPage() {
  const navigate = useNavigate()
  const [valores, setValores] = useState<Valores>(VALORES_INICIAIS)
  const [tocados, setTocados] = useState<Partial<Record<Campo, boolean>>>({})
  const [enviado, setEnviado] = useState(false)
  const [aviso, setAviso] = useState<Aviso>(null)
  const [enviando, setEnviando] = useState(false)
  // Erro vindo da API para um campo (ex.: e-mail já cadastrado); some quando o campo muda.
  const [errosServidor, setErrosServidor] = useState<Erros>({})

  const erros: Erros = { ...errosServidor, ...validar(valores) }

  // Erros só aparecem depois que a pessoa sai do campo ou tenta enviar.
  const erroVisivel = (campo: Campo) => (tocados[campo] || enviado ? erros[campo] : undefined)

  const alterar = (campo: Campo) => (valor: string) => {
    setValores((atual) => ({
      ...atual,
      [campo]: campo === 'telefone' ? formatarTelefone(valor) : valor,
    }))
    setErrosServidor((atual) => ({ ...atual, [campo]: undefined }))
    setAviso(null)
  }

  const tocar = (campo: Campo) => () => setTocados((atual) => ({ ...atual, [campo]: true }))

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (enviando) return
    setEnviado(true)

    const primeiroInvalido = ORDEM_CAMPOS.find((campo) => erros[campo])
    if (primeiroInvalido) {
      document.getElementById(primeiroInvalido)?.focus()
      return
    }

    setEnviando(true)
    setAviso(null)
    try {
      const sessao = await cadastrar({
        nome: valores.nome,
        email: valores.email,
        telefone: valores.telefone,
        senha: valores.senha,
      })
      salvarSessao(sessao)
      // Próximo passo: cadastrar a primeira loja.
      navigate('/lojas/nova', {
        state: {
          aviso: { tipo: 'ok', texto: `Conta criada, ${sessao.nome.split(' ')[0]}! Agora cadastre sua loja.` },
        },
      })
    } catch (erro) {
      if (erro instanceof ErroApi && erro.campo === 'email') {
        setErrosServidor({ email: 'Já cadastrado' })
        document.getElementById('email')?.focus()
      }
      setAviso({
        tipo: 'erro',
        texto: mensagemDe(erro),
      })
      setEnviando(false)
    }
  }

  // Cria a conta (ou entra, se ela já existir) com o Google.
  const google = useGoogle(setAviso)
  const textoGoogle = google.enviando ? 'Entrando com o Google...' : 'Cadastre-se com uma conta Google'

  return (
    <main className="tela-dividida cadastro">
      <aside className="tela-painel">
        <Link to="/" className="tela-logo-link" aria-label="Órion — voltar ao início">
          <img src="/imgs/logo-orion.png" alt="Órion" className="tela-logo" />
        </Link>
        <h1 className="tela-titulo">Crie sua conta</h1>
        <p className="tela-texto">Comece hoje a organizar seus produtos e clientes em um só lugar.</p>

        {/* Em telas largas o Google fica aqui, usando o espaço do painel */}
        <div className="tela-painel-extra">
          <BotaoGoogle texto={textoGoogle} onClick={google.entrar} />
        </div>

        {/* Voltar no canto inferior esquerdo do painel (no celular, só a seta, no canto esquerdo da faixa) */}
        <Link to="/" className="ghost-button botao-voltar botao-voltar-painel" aria-label="Voltar">
          <IconeVoltar tamanho={20} />
          <span className="botao-voltar-texto">Voltar</span>
        </Link>
      </aside>

      <section className="tela-area" aria-labelledby="cadastro-form-titulo">
        <FaixaAviso
          id="cadastro-form-titulo"
          titulo="Preencha seus dados para concluir seu cadastro:"
          tituloCurto="Preencha seus dados:"
          aviso={aviso}
        />

        <form className="cadastro-form" onSubmit={handleSubmit} noValidate>
          <CampoTexto
            id="nome"
            rotulo="Nome"
            className="largo"
            autoComplete="name"
            placeholder="Seu nome completo"
            valor={valores.nome}
            onChange={alterar('nome')}
            onBlur={tocar('nome')}
            erro={erroVisivel('nome')}
          />

          <CampoTexto
            id="email"
            rotulo="E-mail"
            type="email"
            autoComplete="email"
            placeholder="nome@empresa.com"
            valor={valores.email}
            onChange={alterar('email')}
            onBlur={tocar('email')}
            erro={erroVisivel('email')}
          />

          <CampoTexto
            id="telefone"
            rotulo="Telefone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="(11) 91234-5678"
            valor={valores.telefone}
            onChange={alterar('telefone')}
            onBlur={tocar('telefone')}
            erro={erroVisivel('telefone')}
          />

          <CampoSenha
            id="senha"
            rotulo="Crie uma senha"
            autoComplete="new-password"
            descricaoId="requisitos-senha"
            valor={valores.senha}
            onChange={alterar('senha')}
            onBlur={tocar('senha')}
            erro={erroVisivel('senha')}
          />

          <CampoSenha
            id="confirmacao"
            rotulo="Confirme a senha"
            autoComplete="new-password"
            valor={valores.confirmacao}
            onChange={alterar('confirmacao')}
            onBlur={tocar('confirmacao')}
            erro={erroVisivel('confirmacao')}
          />

          <RequisitosSenha id="requisitos-senha" senha={valores.senha} className="largo" />

          <div className="cadastro-acoes largo">
            <button type="submit" className="primary-button botao-acao" disabled={enviando}>
              <IconeCadastro tamanho={22} />
              {enviando ? 'Criando conta...' : 'Criar minha conta'}
            </button>
            <BotaoGoogle texto={textoGoogle} onClick={google.entrar} compacto />
          </div>

          <div className="tela-rodape cadastro-rodape largo">
            <p>
              Já tem uma conta?{' '}
              <Link to="/login" className="link-destaque">
                Entrar
              </Link>
            </p>
          </div>
        </form>
      </section>
    </main>
  )
}
