import { useState, type SubmitEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import CampoTexto from '../../components/formulario/CampoTexto'
import FaixaAviso, { type Aviso } from '../../components/formulario/FaixaAviso'
import { IconeLoja, IconeSair } from '../../components/icones/Icones'
import { IlustracaoEmpresa } from '../../components/icones/Ilustracoes'
import { useSessaoExpirada } from '../../hooks/useSessaoExpirada'
import { criarEmpresa, ErroApi, lerSessao, mensagemDe, sair, salvarSessao } from '../../services/api'
import { erroDocumento, formatarDocumento, normalizarCnpj } from '../../utils/validacao'
import '../../styles/acesso.css'
import '../../styles/tela-dividida.css'
import './empresa-nova.css'

type Campo = 'nome' | 'documento'

function validar(nome: string, documento: string): Partial<Record<Campo, string>> {
  const erros: Partial<Record<Campo, string>> = {}
  if (!nome.trim()) erros.nome = 'Digite o nome'
  else if (nome.trim().length < 2) erros.nome = 'Mínimo de 2 letras'
  const doc = erroDocumento(documento)
  if (doc) erros.documento = doc
  return erros
}

// Quem entrou pelo Google ainda não tem empresa: aqui ela é criada (só o nome é obrigatório).
export default function EmpresaNovaPage() {
  const navigate = useNavigate()
  const sessaoExpirada = useSessaoExpirada()
  const [sessao] = useState(lerSessao)
  const [nome, setNome] = useState('')
  const [documento, setDocumento] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erroServidor, setErroServidor] = useState<Partial<Record<Campo, string>>>({})
  const [aviso, setAviso] = useState<Aviso>((useLocation().state as { aviso?: Aviso } | null)?.aviso ?? null)

  if (!sessao) return <Navigate to="/login" replace />
  if (sessao.empresa) return <Navigate to="/app" replace />

  const erros = enviado ? { ...erroServidor, ...validar(nome, documento) } : erroServidor

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (enviando) return
    setEnviado(true)
    const novos = validar(nome, documento)
    const invalido = (['nome', 'documento'] as const).find((c) => novos[c])
    if (invalido) {
      document.getElementById(invalido)?.focus()
      return
    }

    setEnviando(true)
    setAviso(null)
    try {
      const nova = await criarEmpresa(sessao.token, { nome, documento: normalizarCnpj(documento) })
      salvarSessao(nova)
      navigate('/app', { replace: true })
    } catch (erro) {
      if (sessaoExpirada(erro)) return
      if (erro instanceof ErroApi && erro.campo === 'documento') {
        setErroServidor({ documento: 'Já cadastrado' })
        document.getElementById('documento')?.focus()
      }
      setAviso({ tipo: 'erro', texto: mensagemDe(erro) })
      setEnviando(false)
    }
  }

  const sairDaConta = () => {
    sair()
    navigate('/', { replace: true })
  }

  return (
    <main className="tela-dividida login empresa-nova">
      <aside className="tela-painel">
        <img src="/imgs/logo-orion.png" alt="Órion" className="tela-logo" />
        <h1 className="tela-titulo">Falta pouco</h1>
        <p className="tela-texto">Diga o nome da sua empresa para começar a usar o Órion.</p>

        {/* Ilustração do painel (some no celular, onde o painel vira uma faixa) */}
        <div className="tela-painel-arte" aria-hidden="true">
          <IlustracaoEmpresa tamanho={200} />
        </div>

        <button type="button" className="ghost-button botao-voltar botao-voltar-painel" onClick={sairDaConta}>
          <IconeSair tamanho={20} />
          <span className="botao-voltar-texto">Sair</span>
        </button>
      </aside>

      <section className="tela-area" aria-labelledby="empresa-nova-titulo">
        <FaixaAviso id="empresa-nova-titulo" titulo="Dados da sua empresa:" aviso={aviso} />

        <div className="login-conteudo">
          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <CampoTexto
              id="nome"
              rotulo="Nome da empresa"
              autoComplete="organization"
              placeholder="Como seus clientes conhecem"
              valor={nome}
              onChange={(v) => {
                setNome(v)
                setAviso(null)
              }}
              erro={erros.nome}
            />

            <CampoTexto
              id="documento"
              rotulo="CNPJ ou CPF (opcional)"
              autoComplete="off"
              placeholder="Pode preencher depois"
              valor={documento}
              onChange={(v) => {
                setDocumento(formatarDocumento(v))
                setErroServidor({})
                setAviso(null)
              }}
              erro={erros.documento}
            />

            <button type="submit" className="primary-button botao-acao" disabled={enviando}>
              <IconeLoja tamanho={22} />
              {enviando ? 'Criando empresa...' : 'Começar a usar'}
            </button>
          </form>
        </div>
      </section>
    </main>
  )
}
