import { useEffect, useState, type ReactNode, type SubmitEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import CampoSenha from '../../components/formulario/CampoSenha'
import CampoTexto from '../../components/formulario/CampoTexto'
import type { Aviso } from '../../components/formulario/FaixaAviso'
import RequisitosSenha from '../../components/formulario/RequisitosSenha'
import { IconeCheck, IconeLixeira } from '../../components/icones/Icones'
import { useSessaoExpirada } from '../../hooks/useSessaoExpirada'
import {
  confirmarTrocaDeEmail,
  editarConta,
  ErroApi,
  esquecerDispositivo,
  esquecerLembrado,
  esquecerTodosDispositivos,
  excluirConta,
  lerLembrado,
  listarDispositivos,
  mensagemDe,
  obterConta,
  pedirTrocaDeEmail,
  reenviarCodigoDoEmail,
  sair,
  trocarSenha,
  type Conta,
  type Dispositivo,
  type Verificacao,
} from '../../services/api'
import { emailValido, formatarTelefone, requisitosSenha, telefoneValido } from '../../utils/validacao'
import AvisoPagina from './AvisoPagina'
import CabecalhoModulo from './CabecalhoModulo'
import { useErp } from './contexto'
import { MODULOS } from './modulos'
import '../../styles/acesso.css'

const MODULO = MODULOS.find((m) => m.id === 'conta')!

const formatarData = (iso: string) => new Date(iso).toLocaleDateString('pt-BR')

/** "Mozilla/5.0 (Windows NT 10.0...) Chrome/..." → "Chrome · Windows" */
function descreverDispositivo(ua: string | null) {
  if (!ua) return 'Navegador'
  const navegador =
    [['Edg/', 'Edge'], ['OPR/', 'Opera'], ['Chrome/', 'Chrome'], ['Firefox/', 'Firefox'], ['Safari/', 'Safari']].find(
      ([marca]) => ua.includes(marca),
    )?.[1] ?? 'Navegador'
  const sistema =
    [['Android', 'Android'], ['iPhone', 'iPhone'], ['iPad', 'iPad'], ['Windows', 'Windows'], ['Mac OS X', 'Mac'], ['Linux', 'Linux']].find(
      ([marca]) => ua.includes(marca),
    )?.[1] ?? ''
  return sistema ? `${navegador} · ${sistema}` : navegador
}

function Secao({ titulo, perigo, children }: { titulo: string; perigo?: boolean; children: ReactNode }) {
  const id = 'secao-' + titulo.toLowerCase().replace(/\W+/g, '-')
  return (
    <section className={perigo ? 'erp-secao perigo' : 'erp-secao'} aria-labelledby={id}>
      <h2 id={id} className="erp-secao-titulo">
        {titulo}
      </h2>
      <div className="erp-secao-conteudo">{children}</div>
    </section>
  )
}

// Minha conta: dados, e-mail, senha, dispositivos lembrados e exclusão.
export default function ContaPage() {
  const { sessao, atualizarSessao } = useErp()
  const sessaoExpirada = useSessaoExpirada()
  const [conta, setConta] = useState<Conta | null>(null)
  const [erro, setErro] = useState<Aviso>(null)
  // Ao trocar a senha, a lista de dispositivos é recarregada.
  const [versaoDispositivos, setVersaoDispositivos] = useState(0)

  useEffect(() => {
    let ativo = true
    obterConta(sessao.token)
      .then((c) => ativo && setConta(c))
      .catch((e) => ativo && !sessaoExpirada(e) && setErro({ tipo: 'erro', texto: mensagemDe(e) }))
    return () => {
      ativo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessao.token])

  // Nome e e-mail aparecem no topo do ERP: a sessão acompanha as mudanças.
  const aoAtualizar = (c: Conta) => {
    setConta(c)
    atualizarSessao({ ...sessao, usuario: { ...sessao.usuario, nome: c.nome, email: c.email } })
  }

  return (
    <div className="erp-pagina erp-pagina-estreita">
      <CabecalhoModulo modulo={MODULO} />
      {!conta ? (
        erro ? <AvisoPagina aviso={erro} /> : <p className="erp-carregando">Carregando...</p>
      ) : (
        <>
          <SecaoDados conta={conta} aoAtualizar={aoAtualizar} />
          <SecaoEmail conta={conta} aoAtualizar={aoAtualizar} />
          <SecaoSenha
            conta={conta}
            aoAtualizar={(c) => {
              aoAtualizar(c)
              setVersaoDispositivos((v) => v + 1)
            }}
          />
          <SecaoDispositivos versao={versaoDispositivos} />
          <SecaoExcluir conta={conta} />
        </>
      )}
    </div>
  )
}

type PropsSecao = { conta: Conta; aoAtualizar: (c: Conta) => void }

// ---------- Dados ----------

function SecaoDados({ conta, aoAtualizar }: PropsSecao) {
  const { sessao } = useErp()
  const sessaoExpirada = useSessaoExpirada()
  const [nome, setNome] = useState(conta.nome)
  const [telefone, setTelefone] = useState(formatarTelefone(conta.telefone ?? ''))
  const [enviado, setEnviado] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState<Aviso>(null)

  const erros = !enviado
    ? {}
    : {
        nome: !nome.trim() ? 'Obrigatório' : nome.trim().length < 3 ? 'Mínimo de 3 letras' : undefined,
        telefone: telefone && !telefoneValido(telefone) ? 'Incompleto' : undefined,
      }

  const mudou = (setter: (v: string) => void, mascara?: (v: string) => string) => (v: string) => {
    setter(mascara ? mascara(v) : v)
    setAviso(null)
  }

  const salvar = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    setEnviado(true)
    if (nome.trim().length < 3 || (telefone && !telefoneValido(telefone))) return
    setSalvando(true)
    try {
      aoAtualizar(await editarConta(sessao.token, { nome, telefone }))
      setEnviado(false)
      setAviso({ tipo: 'ok', texto: 'Salvo.' })
    } catch (erro) {
      if (!sessaoExpirada(erro)) setAviso({ tipo: 'erro', texto: mensagemDe(erro) })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Secao titulo="Dados">
      <form className="erp-form" onSubmit={salvar} noValidate>
        <CampoTexto id="conta-nome" rotulo="Nome" autoComplete="name" valor={nome} onChange={mudou(setNome)} erro={erros.nome} />
        <CampoTexto
          id="conta-telefone"
          rotulo="Telefone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="(11) 91234-5678"
          valor={telefone}
          onChange={mudou(setTelefone, formatarTelefone)}
          erro={erros.telefone}
        />
        <div className="erp-form-acoes largo">
          <button type="submit" className="primary-button erp-botao" disabled={salvando}>
            <IconeCheck tamanho={20} />
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
          {aviso && <AvisoPagina aviso={aviso} />}
        </div>
      </form>
    </Secao>
  )
}

// ---------- E-mail (troca confirmada por código no e-mail novo) ----------

function SecaoEmail({ conta, aoAtualizar }: PropsSecao) {
  const { sessao } = useErp()
  const sessaoExpirada = useSessaoExpirada()
  const [aberto, setAberto] = useState(false)
  const [novoEmail, setNovoEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [codigo, setCodigo] = useState('')
  const [verificacao, setVerificacao] = useState<Verificacao | null>(null)
  const [espera, setEspera] = useState(0)
  const [erros, setErros] = useState<{ novoEmail?: string; senha?: string; codigo?: string }>({})
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState<Aviso>(null)

  useEffect(() => {
    if (espera <= 0) return
    const id = window.setTimeout(() => setEspera((s) => s - 1), 1000)
    return () => window.clearTimeout(id)
  }, [espera])

  const fechar = () => {
    setAberto(false)
    setNovoEmail('')
    setSenha('')
    setCodigo('')
    setVerificacao(null)
    setErros({})
  }

  const tratarErro = (erro: unknown) => {
    if (sessaoExpirada(erro)) return
    if (erro instanceof ErroApi && erro.campo) setErros({ [erro.campo]: 'Confira' })
    setAviso({ tipo: 'erro', texto: mensagemDe(erro) })
  }

  const enviarCodigo = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    const novos = {
      novoEmail: !novoEmail.trim() ? 'Obrigatório' : !emailValido(novoEmail) ? 'Inválido' : undefined,
      senha: !senha ? 'Obrigatório' : undefined,
    }
    setErros(novos)
    if (novos.novoEmail || novos.senha) return
    setEnviando(true)
    setAviso(null)
    try {
      const v = await pedirTrocaDeEmail(sessao.token, { novoEmail, senha })
      setVerificacao(v)
      setEspera(v.reenviarEmSegundos)
      setAviso({ tipo: 'ok', texto: `Código enviado para ${v.email}.` })
      requestAnimationFrame(() => document.getElementById('conta-codigo')?.focus())
    } catch (erro) {
      tratarErro(erro)
    } finally {
      setEnviando(false)
    }
  }

  const confirmar = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!verificacao) return
    if (codigo.length !== 6) {
      setErros({ codigo: '6 números' })
      return
    }
    setEnviando(true)
    setAviso(null)
    try {
      const atualizada = await confirmarTrocaDeEmail(sessao.token, { desafioId: verificacao.desafioId, codigo })
      aoAtualizar(atualizada)
      // O "Lembrar de quem sou" guardava o e-mail antigo para preencher o login.
      if (lerLembrado()?.email === conta.email) esquecerLembrado()
      fechar()
      setAviso({ tipo: 'ok', texto: 'E-mail alterado.' })
    } catch (erro) {
      setCodigo('')
      tratarErro(erro)
    } finally {
      setEnviando(false)
    }
  }

  const reenviar = async () => {
    if (!verificacao || espera > 0) return
    try {
      const v = await reenviarCodigoDoEmail(sessao.token, verificacao.desafioId)
      setVerificacao(v)
      setEspera(v.reenviarEmSegundos)
      setAviso({ tipo: 'ok', texto: 'Novo código enviado.' })
    } catch (erro) {
      tratarErro(erro)
    }
  }

  return (
    <Secao titulo="E-mail">
      {!aberto ? (
        <div className="erp-linha-valor">
          <span className="erp-valor">{conta.email}</span>
          <button
            type="button"
            className="ghost-button erp-botao"
            onClick={() => {
              setAberto(true)
              setAviso(null)
              requestAnimationFrame(() => document.getElementById('conta-novo-email')?.focus())
            }}
            disabled={!conta.temSenha}
            title={conta.temSenha ? undefined : 'Crie uma senha primeiro'}
          >
            Alterar
          </button>
          {aviso && <AvisoPagina aviso={aviso} />}
        </div>
      ) : !verificacao ? (
        <form className="erp-form" onSubmit={enviarCodigo} noValidate>
          <CampoTexto
            id="conta-novo-email"
            rotulo="Novo e-mail"
            type="email"
            autoComplete="email"
            valor={novoEmail}
            onChange={(v) => {
              setNovoEmail(v)
              setErros({})
              setAviso(null)
            }}
            erro={erros.novoEmail}
          />
          <CampoSenha
            id="conta-senha-email"
            rotulo="Senha"
            autoComplete="current-password"
            valor={senha}
            onChange={(v) => {
              setSenha(v)
              setErros({})
              setAviso(null)
            }}
            erro={erros.senha}
          />
          <div className="erp-form-acoes largo">
            <button type="submit" className="primary-button erp-botao" disabled={enviando}>
              {enviando ? 'Enviando...' : 'Enviar código'}
            </button>
            <button type="button" className="ghost-button erp-botao" onClick={fechar}>
              Cancelar
            </button>
            {aviso && <AvisoPagina aviso={aviso} />}
          </div>
        </form>
      ) : (
        <form className="erp-form" onSubmit={confirmar} noValidate>
          <CampoTexto
            id="conta-codigo"
            rotulo="Código"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            valor={codigo}
            onChange={(v) => {
              setCodigo(v.replace(/\D/g, '').slice(0, 6))
              setErros({})
              setAviso(null)
            }}
            erro={erros.codigo}
            className="largo campo-codigo-conta"
          />
          <div className="erp-form-acoes largo">
            <button type="submit" className="primary-button erp-botao" disabled={enviando}>
              <IconeCheck tamanho={20} />
              {enviando ? 'Confirmando...' : 'Confirmar'}
            </button>
            <button type="button" className="ghost-button erp-botao" onClick={reenviar} disabled={espera > 0}>
              {espera > 0 ? `Reenviar (${espera}s)` : 'Reenviar'}
            </button>
            <button type="button" className="ghost-button erp-botao" onClick={fechar}>
              Cancelar
            </button>
            {aviso && <AvisoPagina aviso={aviso} />}
          </div>
        </form>
      )}
    </Secao>
  )
}

// ---------- Senha ----------

function SecaoSenha({ conta, aoAtualizar }: PropsSecao) {
  const { sessao } = useErp()
  const sessaoExpirada = useSessaoExpirada()
  const [atual, setAtual] = useState('')
  const [nova, setNova] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [erroAtual, setErroAtual] = useState<string>()
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState<Aviso>(null)

  const erros = !enviado
    ? { atual: erroAtual }
    : {
        atual: erroAtual ?? (conta.temSenha && !atual ? 'Obrigatório' : undefined),
        nova: !nova ? 'Obrigatório' : requisitosSenha(nova).some((r) => !r.atendido) ? 'Faltam requisitos' : undefined,
        confirmacao: !confirmacao ? 'Obrigatório' : confirmacao !== nova ? 'Diferente' : undefined,
      }

  const limpar = () => {
    setAviso(null)
    setErroAtual(undefined)
  }

  const salvar = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    setEnviado(true)
    if ((conta.temSenha && !atual) || !nova || requisitosSenha(nova).some((r) => !r.atendido) || confirmacao !== nova)
      return
    setSalvando(true)
    try {
      const atualizada = await trocarSenha(sessao.token, { senhaAtual: atual, novaSenha: nova })
      // A API esqueceu todos os dispositivos lembrados, inclusive este.
      esquecerLembrado()
      aoAtualizar(atualizada)
      setAtual('')
      setNova('')
      setConfirmacao('')
      setEnviado(false)
      setAviso({ tipo: 'ok', texto: 'Senha alterada.' })
    } catch (erro) {
      if (sessaoExpirada(erro)) return
      if (erro instanceof ErroApi && erro.campo === 'senhaAtual') setErroAtual('Incorreta')
      setAviso({ tipo: 'erro', texto: mensagemDe(erro) })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Secao titulo="Senha">
      <form className="erp-form" onSubmit={salvar} noValidate>
        {conta.temSenha && (
          <CampoSenha
            id="conta-senha-atual"
            rotulo="Senha atual"
            autoComplete="current-password"
            valor={atual}
            onChange={(v) => {
              setAtual(v)
              limpar()
            }}
            erro={erros.atual}
            className="largo"
          />
        )}
        <CampoSenha
          id="conta-senha-nova"
          rotulo="Nova senha"
          autoComplete="new-password"
          descricaoId="conta-requisitos"
          valor={nova}
          onChange={(v) => {
            setNova(v)
            limpar()
          }}
          erro={erros.nova}
        />
        <CampoSenha
          id="conta-senha-confirmacao"
          rotulo="Confirmar senha"
          autoComplete="new-password"
          valor={confirmacao}
          onChange={(v) => {
            setConfirmacao(v)
            limpar()
          }}
          erro={erros.confirmacao}
        />
        {nova && <RequisitosSenha id="conta-requisitos" senha={nova} className="largo" />}
        <div className="erp-form-acoes largo">
          <button type="submit" className="primary-button erp-botao" disabled={salvando}>
            <IconeCheck tamanho={20} />
            {salvando ? 'Salvando...' : conta.temSenha ? 'Alterar senha' : 'Criar senha'}
          </button>
          {aviso && <AvisoPagina aviso={aviso} />}
        </div>
      </form>
    </Secao>
  )
}

// ---------- Dispositivos lembrados ----------

function SecaoDispositivos({ versao }: { versao: number }) {
  const { sessao } = useErp()
  const sessaoExpirada = useSessaoExpirada()
  const [dispositivos, setDispositivos] = useState<Dispositivo[] | null>(null)
  const [aviso, setAviso] = useState<Aviso>(null)

  useEffect(() => {
    let ativo = true
    listarDispositivos(sessao.token)
      .then((lista) => ativo && setDispositivos(lista))
      .catch((e) => ativo && !sessaoExpirada(e) && setAviso({ tipo: 'erro', texto: mensagemDe(e) }))
    return () => {
      ativo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessao.token, versao])

  const esquecer = async (d: Dispositivo | 'todos') => {
    try {
      if (d === 'todos') await esquecerTodosDispositivos(sessao.token)
      else await esquecerDispositivo(sessao.token, d.id)
      if (d === 'todos' || d.atual) esquecerLembrado()
      setDispositivos((lista) => (d === 'todos' ? [] : (lista ?? []).filter((x) => x.id !== d.id)))
      setAviso(null)
    } catch (erro) {
      if (!sessaoExpirada(erro)) setAviso({ tipo: 'erro', texto: mensagemDe(erro) })
    }
  }

  return (
    <Secao titulo="Dispositivos lembrados">
      {!dispositivos ? (
        !aviso && <p className="erp-carregando">Carregando...</p>
      ) : dispositivos.length === 0 ? (
        <p className="erp-nota">Nenhum dispositivo.</p>
      ) : (
        <ul className="erp-lista">
          {dispositivos.map((d) => (
            <li key={d.id} className="erp-linha estatica">
              <span className="erp-linha-textos">
                <span className="erp-linha-titulo">
                  {descreverDispositivo(d.descricao)}
                  {d.atual && <span className="erp-etiqueta">Este</span>}
                </span>
                <span className="erp-linha-texto">Último acesso {formatarData(d.ultimoUsoEm)}</span>
              </span>
              <button type="button" className="ghost-button erp-botao-pequeno" onClick={() => esquecer(d)}>
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}
      {((dispositivos && dispositivos.length > 1) || aviso) && (
        <div className="erp-form-acoes">
          {dispositivos && dispositivos.length > 1 && (
            <button type="button" className="ghost-button erp-botao" onClick={() => esquecer('todos')}>
              Remover todos
            </button>
          )}
          {aviso && <AvisoPagina aviso={aviso} />}
        </div>
      )}
    </Secao>
  )
}

// ---------- Excluir conta ----------

function SecaoExcluir({ conta }: { conta: Conta }) {
  const { sessao } = useErp()
  const navigate = useNavigate()
  const sessaoExpirada = useSessaoExpirada()
  const [aberto, setAberto] = useState(false)
  const [senha, setSenha] = useState('')
  const [erroSenha, setErroSenha] = useState<string>()
  const [excluindo, setExcluindo] = useState(false)
  const [aviso, setAviso] = useState<Aviso>(null)

  const nota = {
    conta: 'Sua conta será excluída permanentemente.',
    'conta-e-empresa': 'Sua conta e a empresa, com todos os usuários, serão excluídas permanentemente.',
  }[conta.exclusao]

  const excluir = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (conta.temSenha && !senha) {
      setErroSenha('Obrigatório')
      return
    }
    setExcluindo(true)
    setAviso(null)
    try {
      // A confirmação "EXCLUIR" é a própria escolha da pessoa neste formulário.
      await excluirConta(sessao.token, { senha, confirmacao: 'EXCLUIR' })
      sair()
      esquecerLembrado()
      navigate('/login', { replace: true, state: { aviso: { tipo: 'ok', texto: 'Conta excluída.' } } })
    } catch (erro) {
      if (sessaoExpirada(erro)) return
      if (erro instanceof ErroApi && erro.campo === 'senha') setErroSenha('Incorreta')
      setAviso({ tipo: 'erro', texto: mensagemDe(erro) })
      setExcluindo(false)
    }
  }

  return (
    <Secao titulo="Excluir conta" perigo>
      <p className="erp-nota">{nota}</p>
      {!aberto ? (
        <button type="button" className="erp-botao-perigo forte" onClick={() => setAberto(true)}>
          <IconeLixeira tamanho={20} />
          Excluir conta
        </button>
      ) : (
        <form className="erp-form" onSubmit={excluir} noValidate>
          {conta.temSenha && (
            <CampoSenha
              id="conta-senha-excluir"
              rotulo="Confirme sua senha"
              autoComplete="current-password"
              valor={senha}
              onChange={(v) => {
                setSenha(v)
                setErroSenha(undefined)
              }}
              erro={erroSenha}
            />
          )}
          <div className="erp-form-acoes largo">
            <button type="submit" className="erp-botao-perigo forte" disabled={excluindo}>
              <IconeLixeira tamanho={20} />
              {excluindo ? 'Excluindo...' : 'Confirmar exclusão'}
            </button>
            <button
              type="button"
              className="ghost-button erp-botao"
              onClick={() => {
                setAberto(false)
                setSenha('')
                setErroSenha(undefined)
              }}
            >
              Cancelar
            </button>
            {aviso && <AvisoPagina aviso={aviso} />}
          </div>
        </form>
      )}
    </Secao>
  )
}
