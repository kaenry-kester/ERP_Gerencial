import { useEffect, useState, type SubmitEvent } from 'react'
import CampoTexto from '../../components/formulario/CampoTexto'
import type { Aviso } from '../../components/formulario/FaixaAviso'
import { IconeCheck } from '../../components/icones/Icones'
import { useSessaoExpirada } from '../../hooks/useSessaoExpirada'
import { editarEmpresa, ErroApi, mensagemDe, obterEmpresa, type DadosEmpresa, type Empresa } from '../../services/api'
import {
  emailValido,
  erroDocumento,
  formatarDocumento,
  formatarTelefone,
  normalizarCnpj,
  telefoneValido,
} from '../../utils/validacao'
import AvisoPagina from './AvisoPagina'
import FaixaPagina from './FaixaPagina'
import SecaoPagina from './SecaoPagina'
import { useErp } from './contexto'
import { MODULOS } from './modulos'
import '../../styles/acesso.css'

type Campo = keyof DadosEmpresa
const ORDEM: Campo[] = ['nome', 'razaoSocial', 'documento', 'email', 'telefone']

const MODULO = MODULOS.find((m) => m.id === 'empresa')!

const faixa = (
  <FaixaPagina
    titulo={MODULO.rotulo}
    subtitulo={MODULO.descricao}
    Ilustracao={MODULO.Ilustracao}
  />
)

/** Dados em blocos (consulta de quem não é administrador). */
const Dados = ({ itens }: { itens: [string, string][] }) => (
  <dl className="erp-dados">
    {itens.map(([rotulo, valor]) => (
      <div key={rotulo} className="erp-dado">
        <dt>{rotulo}</dt>
        <dd>{valor}</dd>
      </div>
    ))}
  </dl>
)

const formatarData = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

const paraFormulario = (e: Empresa): DadosEmpresa => ({
  nome: e.nome,
  razaoSocial: e.razaoSocial ?? '',
  documento: formatarDocumento(e.documento ?? ''),
  email: e.email ?? '',
  telefone: formatarTelefone(e.telefone ?? ''),
})

function validar(v: DadosEmpresa): Partial<Record<Campo, string>> {
  const erros: Partial<Record<Campo, string>> = {}
  if (!v.nome.trim()) erros.nome = 'Digite o nome'
  else if (v.nome.trim().length < 2) erros.nome = 'Mínimo de 2 letras'
  const doc = erroDocumento(v.documento)
  if (doc) erros.documento = doc
  if (v.email.trim() && !emailValido(v.email)) erros.email = 'E-mail inválido'
  if (v.telefone && !telefoneValido(v.telefone)) erros.telefone = 'Número incompleto'
  return erros
}

// "Dados da empresa": o administrador edita; os outros usuários só consultam.
export default function EmpresaPage() {
  const { sessao, atualizarSessao } = useErp()
  const sessaoExpirada = useSessaoExpirada()
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [valores, setValores] = useState<DadosEmpresa | null>(null)
  const [enviado, setEnviado] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erroServidor, setErroServidor] = useState<Partial<Record<Campo, string>>>({})
  const [aviso, setAviso] = useState<Aviso>(null)

  useEffect(() => {
    let ativo = true
    obterEmpresa(sessao.token)
      .then((e) => {
        if (!ativo) return
        setEmpresa(e)
        setValores(paraFormulario(e))
      })
      .catch((erro) => ativo && !sessaoExpirada(erro) && setAviso({ tipo: 'erro', texto: mensagemDe(erro) }))
    return () => {
      ativo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessao.token])

  const admin = sessao.usuario.administrador

  if (!empresa || !valores) {
    return (
      <div className="pagina tema-preferencias">
        {faixa}
        <div className="pagina-corpo">
          {aviso ? <AvisoPagina aviso={aviso} /> : <p className="erp-carregando">Carregando...</p>}
        </div>
      </div>
    )
  }

  // Quem não é administrador só consulta
  if (!admin) {
    return (
      <div className="pagina tema-preferencias">
        {faixa}
        <div className="pagina-secoes">
          <SecaoPagina id="empresa-identificacao" numero={1} titulo="Identificação">
            <Dados
              itens={[
                ['Nome', empresa.nome],
                ['Razão social', empresa.razaoSocial ?? '—'],
                ['CNPJ ou CPF', empresa.documento ? formatarDocumento(empresa.documento) : '—'],
                ['Cadastro', formatarData(empresa.criadoEm)],
              ]}
            />
          </SecaoPagina>
          <SecaoPagina id="empresa-contato" numero={2} titulo="Contato">
            <Dados
              itens={[
                ['E-mail', empresa.email ?? '—'],
                ['Telefone', empresa.telefone ? formatarTelefone(empresa.telefone) : '—'],
              ]}
            />
          </SecaoPagina>
        </div>
      </div>
    )
  }

  const erros = { ...erroServidor, ...(enviado ? validar(valores) : {}) }
  const mascaras: Partial<Record<Campo, (v: string) => string>> = {
    documento: formatarDocumento,
    telefone: formatarTelefone,
  }

  const campo = (id: Campo) => ({
    id,
    valor: valores[id],
    erro: erros[id],
    onChange: (v: string) => {
      setValores({ ...valores, [id]: mascaras[id]?.(v) ?? v })
      setErroServidor({})
      setAviso(null)
    },
  })

  const salvar = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (salvando) return
    setEnviado(true)
    const novos = validar(valores)
    const invalido = ORDEM.find((c) => novos[c])
    if (invalido) {
      document.getElementById(invalido)?.focus()
      return
    }

    setSalvando(true)
    try {
      const salva = await editarEmpresa(sessao.token, { ...valores, documento: normalizarCnpj(valores.documento) })
      setEmpresa(salva)
      setValores(paraFormulario(salva))
      setEnviado(false)
      // O nome aparece na barra de navegação: atualiza a sessão também.
      atualizarSessao({ ...sessao, empresa: { id: salva.id, nome: salva.nome } })
      setAviso({ tipo: 'ok', texto: 'Salvo.' })
    } catch (erro) {
      if (sessaoExpirada(erro)) return
      if (erro instanceof ErroApi && erro.campo === 'documento') setErroServidor({ documento: 'Já cadastrado' })
      setAviso({ tipo: 'erro', texto: mensagemDe(erro) })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="pagina tema-preferencias">
      {faixa}

      <form className="pagina-secoes" onSubmit={salvar} noValidate>
        <SecaoPagina id="empresa-identificacao" numero={1} titulo="Identificação">
          <div className="erp-form">
            <CampoTexto {...campo('nome')} rotulo="Nome da empresa" autoComplete="organization" />
            <CampoTexto {...campo('razaoSocial')} rotulo="Razão social" placeholder="Como no CNPJ" autoComplete="off" />
            <CampoTexto
              {...campo('documento')}
              rotulo="CNPJ ou CPF"
              placeholder="00.000.000/0000-00"
              autoComplete="off"
            />
          </div>
        </SecaoPagina>

        <SecaoPagina id="empresa-contato" numero={2} titulo="Contato">
          <div className="erp-form">
            <CampoTexto
              {...campo('telefone')}
              rotulo="Telefone"
              type="tel"
              inputMode="numeric"
              placeholder="(11) 91234-5678"
              autoComplete="tel-national"
            />
            <CampoTexto
              {...campo('email')}
              rotulo="E-mail da empresa"
              type="email"
              placeholder="contato@suaempresa.com"
              autoComplete="email"
            />
          </div>
        </SecaoPagina>

        <div className="pagina-barra">
          <button type="submit" className="pagina-botao" disabled={salvando}>
            <IconeCheck tamanho={20} />
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
          {aviso && <AvisoPagina aviso={aviso} />}
        </div>
      </form>
    </div>
  )
}
