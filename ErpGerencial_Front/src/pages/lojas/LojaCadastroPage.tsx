import { useState, type SubmitEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import CampoSenha from '../../components/formulario/CampoSenha'
import CampoTexto from '../../components/formulario/CampoTexto'
import FaixaAviso, { type Aviso } from '../../components/formulario/FaixaAviso'
import RequisitosSenha from '../../components/formulario/RequisitosSenha'
import { IconeLoja, IconeSeta, IconeVoltar } from '../../components/icones/Icones'
import { useSessaoExpirada } from '../../hooks/useSessaoExpirada'
import { criarLoja, ErroApi, lerSessao, mensagemDe } from '../../services/api'
import {
  apenasDigitos,
  celularValido,
  cnpjValido,
  cpfValido,
  emailValido,
  formatarCnpj,
  formatarCpf,
  formatarTelefone,
  normalizarCnpj,
  requisitosSenha,
} from '../../utils/validacao'
import '../../styles/acesso.css'
import '../../styles/tela-dividida.css'
import '../cadastro/cadastro.css'
import './lojas.css'

type Campo =
  | 'razaoSocial'
  | 'nomeFantasia'
  | 'cnpj'
  | 'celular'
  | 'nomeDono'
  | 'cpfDono'
  | 'email'
  | 'senha'
  | 'confirmacao'
type Valores = Record<Campo, string>
type Erros = Partial<Record<Campo, string>>

// Em telas grandes o formulário aparece inteiro; em telas pequenas, em duas etapas
// (mesma media query de lojas.css), para caber na janela sem rolagem.
const ETAPA_EMPRESA: Campo[] = ['razaoSocial', 'nomeFantasia', 'cnpj', 'celular', 'email']
const ETAPA_DONO: Campo[] = ['nomeDono', 'cpfDono', 'senha', 'confirmacao']
const ORDEM_CAMPOS: Campo[] = [...ETAPA_EMPRESA, ...ETAPA_DONO]
const MODO_ETAPAS = '(max-width: 1279px), (max-height: 760px)'

const emEtapas = () => window.matchMedia(MODO_ETAPAS).matches

// Foca depois que a etapa trocada aparecer na tela.
const focarDepois = (id: string) => requestAnimationFrame(() => document.getElementById(id)?.focus())

const MASCARAS: Partial<Record<Campo, (valor: string) => string>> = {
  cnpj: formatarCnpj,
  cpfDono: formatarCpf,
  celular: formatarTelefone,
}

function validarNome(valor: string, vazio: string, minimo = 3) {
  const nome = valor.trim()
  if (!nome) return vazio
  if (nome.length < minimo) return `Mínimo de ${minimo} letras`
  return undefined
}

function validar(v: Valores): Erros {
  const erros: Erros = {
    razaoSocial: validarNome(v.razaoSocial, 'Digite o nome'),
    nomeFantasia: validarNome(v.nomeFantasia, 'Digite o nome', 2),
    nomeDono: validarNome(v.nomeDono, 'Digite o nome'),
  }

  if (!erros.nomeDono && !/\S+\s+\S+/.test(v.nomeDono.trim())) erros.nomeDono = 'Falta o sobrenome'

  const cnpj = normalizarCnpj(v.cnpj)
  if (!cnpj) erros.cnpj = 'Digite o CNPJ'
  else if (cnpj.length < 14) erros.cnpj = 'CNPJ incompleto'
  else if (!cnpjValido(cnpj)) erros.cnpj = 'CNPJ inválido'

  const cpf = apenasDigitos(v.cpfDono)
  if (!cpf) erros.cpfDono = 'Digite o CPF'
  else if (cpf.length < 11) erros.cpfDono = 'CPF incompleto'
  else if (!cpfValido(cpf)) erros.cpfDono = 'CPF inválido'

  if (!v.email.trim()) erros.email = 'Digite o e-mail'
  else if (!emailValido(v.email)) erros.email = 'E-mail inválido'

  const celular = apenasDigitos(v.celular)
  if (!celular) erros.celular = 'Digite com DDD'
  else if (celular.length < 11) erros.celular = 'Número incompleto'
  else if (!celularValido(celular)) erros.celular = 'Celular inválido'

  if (!v.senha) erros.senha = 'Crie uma senha'
  else if (requisitosSenha(v.senha).some((r) => !r.atendido)) erros.senha = 'Faltam requisitos'

  if (!v.confirmacao) erros.confirmacao = 'Digite novamente'
  else if (v.confirmacao !== v.senha) erros.confirmacao = 'Senhas diferentes'

  // Remove as chaves sem erro.
  return Object.fromEntries(Object.entries(erros).filter(([, erro]) => erro)) as Erros
}

export default function LojaCadastroPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const sessaoExpirada = useSessaoExpirada('conta')
  const [sessao] = useState(lerSessao)

  // Nome e e-mail do dono começam com os dados da conta (podem ser trocados).
  const [valores, setValores] = useState<Valores>(() => ({
    razaoSocial: '',
    nomeFantasia: '',
    cnpj: '',
    celular: '',
    nomeDono: sessao?.nome ?? '',
    cpfDono: '',
    email: sessao?.email ?? '',
    senha: '',
    confirmacao: '',
  }))
  const [tocados, setTocados] = useState<Partial<Record<Campo, boolean>>>({})
  const [enviado, setEnviado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [etapa, setEtapa] = useState<1 | 2>(1)
  const [errosServidor, setErrosServidor] = useState<Erros>({})
  // Aviso enviado por outra tela (ex.: conta recém-criada)
  const [aviso, setAviso] = useState<Aviso>((location.state as { aviso?: Aviso } | null)?.aviso ?? null)

  if (!sessao) return <Navigate to="/login" replace />

  const erros: Erros = { ...errosServidor, ...validar(valores) }
  const erroVisivel = (campo: Campo) => (tocados[campo] || enviado ? erros[campo] : undefined)

  const alterar = (campo: Campo) => (valor: string) => {
    const mascara = MASCARAS[campo]
    setValores((atual) => ({ ...atual, [campo]: mascara ? mascara(valor) : valor }))
    setErrosServidor((atual) => ({ ...atual, [campo]: undefined }))
    setAviso(null)
  }

  const tocar = (campo: Campo) => () => setTocados((atual) => ({ ...atual, [campo]: true }))

  // Propriedades comuns de cada campo
  const campo = (id: Campo) => ({
    id,
    valor: valores[id],
    onChange: alterar(id),
    onBlur: tocar(id),
    erro: erroVisivel(id),
  })

  // Etapa 1 → 2: confere só os campos da empresa.
  const avancar = () => {
    setTocados((atual) => ({ ...atual, ...Object.fromEntries(ETAPA_EMPRESA.map((c) => [c, true])) }))
    const invalido = ETAPA_EMPRESA.find((c) => erros[c])
    if (invalido) {
      document.getElementById(invalido)?.focus()
      return
    }
    setEtapa(2)
    focarDepois('nomeDono')
  }

  const voltarEtapa = () => {
    setEtapa(1)
    focarDepois('razaoSocial')
  }

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (enviando) return
    // Enter na primeira etapa equivale a "Continuar".
    if (etapa === 1 && emEtapas()) {
      avancar()
      return
    }
    setEnviado(true)

    const primeiroInvalido = ORDEM_CAMPOS.find((c) => erros[c])
    if (primeiroInvalido) {
      if (ETAPA_EMPRESA.includes(primeiroInvalido)) setEtapa(1)
      focarDepois(primeiroInvalido)
      return
    }

    setEnviando(true)
    setAviso(null)
    try {
      const loja = await criarLoja(sessao.token, {
        razaoSocial: valores.razaoSocial,
        nomeFantasia: valores.nomeFantasia,
        cnpj: normalizarCnpj(valores.cnpj),
        nomeDono: valores.nomeDono,
        cpfDono: apenasDigitos(valores.cpfDono),
        email: valores.email,
        celular: apenasDigitos(valores.celular),
        senha: valores.senha,
      })
      // Loja criada: abre o acesso da loja com o CNPJ já preenchido.
      navigate('/loja/entrar', {
        replace: true,
        state: {
          cnpj: loja.cnpj,
          aviso: { tipo: 'ok', texto: `${loja.nomeFantasia} foi criada! Entre com a senha da loja.` },
        },
      })
    } catch (erro) {
      if (sessaoExpirada(erro)) return
      if (erro instanceof ErroApi && erro.campo === 'cnpj') {
        setErrosServidor({ cnpj: 'Já cadastrado' })
        setEtapa(1)
        focarDepois('cnpj')
      }
      setAviso({ tipo: 'erro', texto: mensagemDe(erro) })
      setEnviando(false)
    }
  }

  return (
    <main className="tela-dividida cadastro loja-cadastro">
      <aside className="tela-painel">
        <Link to="/" className="tela-logo-link" aria-label="Órion — início">
          <img src="/imgs/logo-orion.png" alt="Órion" className="tela-logo" />
        </Link>
        <h1 className="tela-titulo">Cadastre sua loja</h1>
        <p className="tela-texto">
          A loja terá um acesso próprio, com CNPJ e senha, para você cadastrar seus produtos.
        </p>

        <Link to="/lojas" className="ghost-button botao-voltar botao-voltar-painel" aria-label="Voltar">
          <IconeVoltar tamanho={20} />
          <span className="botao-voltar-texto">Voltar</span>
        </Link>
      </aside>

      <section className="tela-area" aria-labelledby="loja-form-titulo">
        <FaixaAviso id="loja-form-titulo" titulo="Preencha os dados da sua loja:" aviso={aviso} />

        <form className={`cadastro-form loja-form etapa-${etapa}`} onSubmit={handleSubmit} noValidate>
          <p className="etapa-indicador largo" aria-live="polite">
            {etapa === 1 ? 'Etapa 1 de 2 · Dados da empresa' : 'Etapa 2 de 2 · Dono e senha de acesso'}
          </p>

          <div className="etapa etapa-empresa">
            <CampoTexto
              {...campo('razaoSocial')}
              rotulo="Nome da companhia"
              autoComplete="organization"
              placeholder="Razão social, como no CNPJ"
            />

            <CampoTexto
              {...campo('nomeFantasia')}
              rotulo="Nome fantasia"
              autoComplete="off"
              placeholder="Como seus clientes conhecem a loja"
            />

            <CampoTexto {...campo('cnpj')} rotulo="CNPJ" autoComplete="off" placeholder="00.000.000/0000-00" />

            <CampoTexto
              {...campo('celular')}
              rotulo="Celular para contato"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="(11) 91234-5678"
            />

            <CampoTexto
              {...campo('email')}
              rotulo="E-mail da loja"
              className="largo"
              type="email"
              autoComplete="email"
              placeholder="contato@sualoja.com"
            />
          </div>

          <div className="etapa etapa-dono">
            <CampoTexto
              {...campo('nomeDono')}
              rotulo="Nome completo do dono"
              autoComplete="name"
              placeholder="Nome e sobrenome"
            />

            <CampoTexto
              {...campo('cpfDono')}
              rotulo="CPF do dono"
              inputMode="numeric"
              autoComplete="off"
              placeholder="000.000.000-00"
            />

            <CampoSenha
              {...campo('senha')}
              rotulo="Senha da loja"
              autoComplete="new-password"
              descricaoId="requisitos-senha"
            />

            <CampoSenha {...campo('confirmacao')} rotulo="Confirme a senha" autoComplete="new-password" />

            <RequisitosSenha id="requisitos-senha" senha={valores.senha} className="largo" />
          </div>

          <div className="loja-acoes largo">
            <button type="button" className="ghost-button botao-acao botao-etapa-voltar" onClick={voltarEtapa}>
              <IconeVoltar tamanho={20} />
              Voltar
            </button>
            <button type="button" className="primary-button botao-acao botao-continuar" onClick={avancar}>
              Continuar
              <IconeSeta tamanho={22} />
            </button>
            <button type="submit" className="primary-button botao-acao botao-cadastrar" disabled={enviando}>
              <IconeLoja tamanho={22} />
              {enviando ? 'Cadastrando loja...' : 'Cadastrar loja'}
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}
