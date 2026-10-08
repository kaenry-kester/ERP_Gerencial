import { useEffect, useState, type SubmitEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import CampoSenha from '../../components/formulario/CampoSenha'
import CampoTexto from '../../components/formulario/CampoTexto'
import type { Aviso } from '../../components/formulario/FaixaAviso'
import RequisitosSenha from '../../components/formulario/RequisitosSenha'
import { IconeCheck, IconeVoltar } from '../../components/icones/Icones'
import { useSessaoExpirada } from '../../hooks/useSessaoExpirada'
import {
  criarUsuario,
  editarUsuario,
  ErroApi,
  listarUsuarios,
  mensagemDe,
  type Usuario,
} from '../../services/api'
import { emailValido, requisitosSenha } from '../../utils/validacao'
import AvisoPagina from './AvisoPagina'
import { useErp } from './contexto'
import { MODULOS_PRINCIPAIS, PERMISSOES } from './modulos'
import SemAcesso from './SemAcesso'
import '../../styles/acesso.css'

type Campo = 'nome' | 'email' | 'senha'

/**
 * Novo usuário (/app/usuarios/novo) ou edição (/app/usuarios/:id).
 * Como no Bling: o administrador define o login (e-mail e senha) e marca os módulos
 * que a pessoa pode usar; "Administrador" acessa tudo.
 */
export default function UsuarioFormPage() {
  const { id } = useParams()
  const novo = !id
  const navigate = useNavigate()
  const { sessao } = useErp()
  const sessaoExpirada = useSessaoExpirada()

  const [original, setOriginal] = useState<Usuario | null>(null)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [administrador, setAdministrador] = useState(false)
  const [permissoes, setPermissoes] = useState<string[]>([])
  const [ativo, setAtivo] = useState(true)
  const [enviado, setEnviado] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erroServidor, setErroServidor] = useState<Partial<Record<Campo, string>>>({})
  const [aviso, setAviso] = useState<Aviso>(null)

  const admin = sessao.usuario.administrador
  const euMesmo = id === sessao.usuario.id

  // Edição: carrega o usuário (da lista da empresa).
  useEffect(() => {
    if (novo || !admin) return
    let ativoEfeito = true
    listarUsuarios(sessao.token)
      .then((lista) => {
        if (!ativoEfeito) return
        const u = lista.find((x) => x.id === id)
        if (!u) {
          navigate('/app/usuarios', { replace: true })
          return
        }
        setOriginal(u)
        setNome(u.nome)
        setEmail(u.email)
        setAdministrador(u.administrador)
        setPermissoes(u.permissoes)
        setAtivo(u.ativo)
      })
      .catch((erro) => ativoEfeito && !sessaoExpirada(erro) && setAviso({ tipo: 'erro', texto: mensagemDe(erro) }))
    return () => {
      ativoEfeito = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, sessao.token, admin])

  if (!admin) return <div className="erp-pagina"><SemAcesso /></div>
  if (!novo && !original) {
    return (
      <div className="erp-pagina">
        {aviso ? <AvisoPagina aviso={aviso} /> : <p className="erp-carregando">Carregando...</p>}
      </div>
    )
  }

  const validar = () => {
    const erros: Partial<Record<Campo, string>> = {}
    if (!nome.trim()) erros.nome = 'Digite o nome'
    else if (nome.trim().length < 3) erros.nome = 'Mínimo de 3 letras'
    if (novo) {
      if (!email.trim()) erros.email = 'Digite o e-mail'
      else if (!emailValido(email)) erros.email = 'E-mail inválido'
      if (!senha) erros.senha = 'Crie uma senha'
      else if (requisitosSenha(senha).some((r) => !r.atendido)) erros.senha = 'Faltam requisitos'
    }
    return erros
  }
  const erros = { ...erroServidor, ...(enviado ? validar() : {}) }

  // Cadastrar/editar incluem "ver"; tirar "ver" tira também cadastrar/editar do mesmo módulo.
  const alternarPermissao = (id: string) =>
    setPermissoes((atual) => {
      const modulo = id.split('-')[0]
      if (atual.includes(id)) {
        return id === modulo ? atual.filter((p) => p.split('-')[0] !== modulo) : atual.filter((p) => p !== id)
      }
      return [...new Set([...atual, id, modulo])]
    })


  const salvar = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (salvando) return
    setEnviado(true)
    const novos = validar()
    const invalido = (['nome', 'email', 'senha'] as const).find((c) => novos[c])
    if (invalido) {
      document.getElementById(invalido)?.focus()
      return
    }

    setSalvando(true)
    setAviso(null)
    try {
      if (novo) {
        await criarUsuario(sessao.token, { nome, email, senha, administrador, permissoes })
      } else {
        await editarUsuario(sessao.token, id!, { nome, administrador, permissoes, ativo })
      }
      const texto = novo ? 'Usuário criado.' : 'Usuário atualizado.'
      navigate('/app/usuarios', { state: { aviso: { tipo: 'ok', texto } } })
    } catch (erro) {
      if (sessaoExpirada(erro)) return
      if (erro instanceof ErroApi && erro.campo === 'email') {
        setErroServidor({ email: 'Já tem conta' })
        document.getElementById('email')?.focus()
      }
      setAviso({ tipo: 'erro', texto: mensagemDe(erro) })
      setSalvando(false)
    }
  }

  return (
    <div className="erp-pagina erp-pagina-estreita">
      <header className="erp-pagina-cabecalho">
        <Link to="/app/usuarios" className="erp-voltar">
          <IconeVoltar tamanho={18} />
          Usuários e permissões
        </Link>
        <h1 className="erp-pagina-titulo">{novo ? 'Novo usuário' : original!.nome}</h1>
        <p className="erp-pagina-subtitulo">
          {novo
            ? 'Login com e-mail e senha.'
            : `${original!.email} · cadastrado em ${new Date(original!.criadoEm).toLocaleDateString('pt-BR')}`}
        </p>
      </header>

      <form className="erp-form" onSubmit={salvar} noValidate>
        <CampoTexto
          id="nome"
          rotulo="Nome"
          autoComplete="off"
          placeholder="Nome e sobrenome"
          valor={nome}
          onChange={(v) => {
            setNome(v)
            setAviso(null)
          }}
          erro={erros.nome}
          className={novo ? undefined : 'largo'}
        />

        {novo && (
          <>
            <CampoTexto
              id="email"
              rotulo="E-mail"
              type="email"
              autoComplete="off"
              placeholder="nome@empresa.com"
              valor={email}
              onChange={(v) => {
                setEmail(v)
                setErroServidor({})
                setAviso(null)
              }}
              erro={erros.email}
            />
            <CampoSenha
              id="senha"
              rotulo="Senha"
              autoComplete="new-password"
              descricaoId="requisitos-senha"
              valor={senha}
              onChange={setSenha}
              erro={erros.senha}
            />
            <RequisitosSenha id="requisitos-senha" senha={senha} />
          </>
        )}

        {/* Tipo de acesso */}
        <fieldset className="erp-acesso largo" disabled={euMesmo}>
          <legend className="erp-secao-titulo">Acesso</legend>
          {euMesmo && <p className="erp-nota">Seu próprio acesso não pode ser alterado.</p>}
          <div className="erp-opcoes">
            <label className={administrador ? 'erp-opcao marcada' : 'erp-opcao'}>
              <input type="radio" name="tipo" checked={administrador} onChange={() => setAdministrador(true)} />
              <span>
                <span className="erp-opcao-titulo">Administrador</span>
                <span className="erp-opcao-texto">Acesso total.</span>
              </span>
            </label>
            <label className={!administrador ? 'erp-opcao marcada' : 'erp-opcao'}>
              <input type="radio" name="tipo" checked={!administrador} onChange={() => setAdministrador(false)} />
              <span>
                <span className="erp-opcao-titulo">Personalizado</span>
                <span className="erp-opcao-texto">Escolha os módulos.</span>
              </span>
            </label>
          </div>
        </fieldset>

        {!administrador && (
          <fieldset className="erp-permissoes largo">
            <legend className="erp-secao-titulo">Módulos</legend>
            <div className="erp-permissoes-modulos">
              {PERMISSOES.map((grupo) => {
                const modulo = MODULOS_PRINCIPAIS.find((m) => m.id === grupo.modulo)!
                const { Ilustracao } = modulo
                return (
                  <div key={grupo.modulo} className={`erp-permissoes-modulo tema-${grupo.modulo}`}>
                    <div className="erp-permissoes-modulo-topo">
                      {Ilustracao && <Ilustracao tamanho={44} />}
                      <span className="erp-permissoes-modulo-nome">{modulo.rotulo}</span>
                    </div>
                    {grupo.itens.map((item) => (
                      <label key={item.id} className="erp-permissao">
                        <input
                          type="checkbox"
                          checked={permissoes.includes(item.id)}
                          onChange={() => alternarPermissao(item.id)}
                        />
                        <span>
                          {item.rotulo}
                          {item.dica && <span className="erp-permissao-dica">{item.dica}</span>}
                        </span>
                      </label>
                    ))}
                  </div>
                )
              })}
            </div>
          </fieldset>
        )}

        {!novo && !euMesmo && (
          <label className="erp-permissao erp-ativo largo">
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
            Usuário ativo
          </label>
        )}

        <div className="erp-form-acoes largo">
          <button type="submit" className="primary-button erp-botao" disabled={salvando}>
            <IconeCheck tamanho={20} />
            {salvando ? 'Salvando...' : novo ? 'Criar usuário' : 'Salvar'}
          </button>
          <Link to="/app/usuarios" className="ghost-button erp-botao">
            Cancelar
          </Link>
          {aviso && <AvisoPagina aviso={aviso} />}
        </div>
      </form>
    </div>
  )
}
