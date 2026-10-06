import { useState, type SubmitEvent } from 'react'
import { Link } from 'react-router-dom'
import BotaoGoogle from '../../components/formulario/BotaoGoogle'
import CampoSenha from '../../components/formulario/CampoSenha'
import CampoTexto from '../../components/formulario/CampoTexto'
import { IconeCadastro, IconeCheck, IconePendente, IconeVoltar } from '../../components/icones/Icones'
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
  const [valores, setValores] = useState<Valores>(VALORES_INICIAIS)
  const [tocados, setTocados] = useState<Partial<Record<Campo, boolean>>>({})
  const [enviado, setEnviado] = useState(false)
  const [aviso, setAviso] = useState('')

  const erros = validar(valores)
  const requisitos = requisitosSenha(valores.senha)

  // Erros só aparecem depois que a pessoa sai do campo ou tenta enviar.
  const erroVisivel = (campo: Campo) => (tocados[campo] || enviado ? erros[campo] : undefined)

  const alterar = (campo: Campo) => (valor: string) => {
    setValores((atual) => ({
      ...atual,
      [campo]: campo === 'telefone' ? formatarTelefone(valor) : valor,
    }))
    setAviso('')
  }

  const tocar = (campo: Campo) => () => setTocados((atual) => ({ ...atual, [campo]: true }))

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    setEnviado(true)

    const primeiroInvalido = ORDEM_CAMPOS.find((campo) => erros[campo])
    if (primeiroInvalido) {
      document.getElementById(primeiroInvalido)?.focus()
      return
    }

    // TODO: enviar para a API ASP.NET quando o back-end estiver pronto.
    setAviso('Dados corretos! A criação da conta chega na próxima etapa.')
  }

  // TODO: ligar ao Google Identity Services + validação do token na API ASP.NET.
  const cadastrarComGoogle = () =>
    setAviso('O cadastro com o Google será ligado ao servidor na próxima etapa.')

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
          <BotaoGoogle texto="Cadastre-se com uma conta Google" onClick={cadastrarComGoogle} />
        </div>

        {/* Voltar no canto inferior esquerdo do painel (no celular, só a seta, no canto esquerdo da faixa) */}
        <Link to="/" className="ghost-button botao-voltar botao-voltar-painel" aria-label="Voltar">
          <IconeVoltar tamanho={20} />
          <span className="botao-voltar-texto">Voltar</span>
        </Link>
      </aside>

      <section className="tela-area" aria-labelledby="cadastro-form-titulo">
        {/* Faixa cinza de largura total; o aviso aparece no lugar da frase */}
        <div className="tela-faixa">
          <h2
            id="cadastro-form-titulo"
            className={aviso ? 'tela-faixa-titulo sr-only' : 'tela-faixa-titulo'}
          >
            Preencha seus dados para concluir seu cadastro:
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

          <div className="requisitos largo" id="requisitos-senha">
            <p className="requisitos-titulo">A senha precisa ter:</p>
            <ul className="requisitos-lista">
              {requisitos.map((requisito) => (
                <li
                  key={requisito.id}
                  className={requisito.atendido ? 'requisito atendido' : 'requisito'}
                >
                  <span className="requisito-icone">
                    {requisito.atendido ? <IconeCheck tamanho={14} /> : <IconePendente tamanho={14} />}
                  </span>
                  <span className="requisito-texto">{requisito.texto}</span>
                  <span className="requisito-texto-curto" aria-hidden="true">
                    {requisito.textoCurto}
                  </span>
                  <span className="sr-only">{requisito.atendido ? ' — ok' : ' — pendente'}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="cadastro-acoes largo">
            <button type="submit" className="primary-button botao-acao">
              <IconeCadastro tamanho={22} />
              Criar minha conta
            </button>
            <BotaoGoogle
              texto="Cadastre-se com uma conta Google"
              onClick={cadastrarComGoogle}
              compacto
            />
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
