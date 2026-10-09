import { useEffect, useRef, useState, type SubmitEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import CampoTexto from '../../../components/formulario/CampoTexto'
import type { Aviso } from '../../../components/formulario/FaixaAviso'
import { IconeCheck } from '../../../components/icones/Icones'
import { IlustracaoClientes } from '../../../components/icones/Ilustracoes'
import { useSessaoExpirada } from '../../../hooks/useSessaoExpirada'
import {
  buscarCep,
  criarCliente,
  editarCliente,
  ErroApi,
  mensagemDe,
  obterCliente,
  type Cliente,
  type DadosCliente,
} from '../../../services/api'
import { apenasDigitos, formatarCep, formatarTelefone, telefoneValido } from '../../../utils/validacao'
import AvisoPagina from '../AvisoPagina'
import { useErp } from '../contexto'
import FaixaPagina from '../FaixaPagina'
import { tem } from '../modulos'
import SecaoPagina from '../SecaoPagina'
import SemAcesso from '../SemAcesso'
import { formatarCadastro, formatarDia, INTERVALO_MAXIMO, somarMeses } from './formatos'
import '../../../styles/acesso.css'
import './clientes.css'

type Campo = keyof Omit<DadosCliente, 'intervaloManutencaoMeses' | 'envioEm'> | 'intervalo' | 'envio'
type Valores = Record<Campo, string>

const VAZIO: Valores = {
  nome: '',
  celular: '',
  cep: '',
  logradouro: '',
  numeroEndereco: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
  intervalo: '',
  envio: '',
}

/** ISO (UTC) → valor do campo de data e hora ("2026-10-08T14:30", no horário do computador). */
function paraCampoDataHora(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const dois = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}T${dois(d.getHours())}:${dois(d.getMinutes())}`
}

const MASCARAS: Partial<Record<Campo, (v: string) => string>> = {
  celular: formatarTelefone,
  cep: formatarCep,
  uf: (v) => v.replace(/[^a-z]/gi, '').slice(0, 2).toUpperCase(),
  intervalo: (v) => apenasDigitos(v).slice(0, 3),
}

/** Ordem dos campos, para levar o cursor ao primeiro com erro. */
const ORDEM: Campo[] = ['nome', 'celular', 'cep', 'uf', 'intervalo']

const paraFormulario = (c: Cliente): Valores => ({
  nome: c.nome,
  celular: formatarTelefone(c.celular),
  cep: formatarCep(c.cep ?? ''),
  logradouro: c.logradouro ?? '',
  numeroEndereco: c.numeroEndereco ?? '',
  complemento: c.complemento ?? '',
  bairro: c.bairro ?? '',
  cidade: c.cidade ?? '',
  uf: c.uf ?? '',
  intervalo: String(c.intervaloManutencaoMeses),
  envio: paraCampoDataHora(c.envioEm),
})

const paraApi = ({ intervalo, envio, ...v }: Valores): DadosCliente => ({
  ...v,
  celular: apenasDigitos(v.celular),
  cep: apenasDigitos(v.cep),
  intervaloManutencaoMeses: intervalo ? Number(intervalo) : null,
  envioEm: envio ? new Date(envio).toISOString() : null,
})

function validar(v: Valores): Partial<Record<Campo, string>> {
  const erros: Partial<Record<Campo, string>> = {}
  if (!v.nome.trim()) erros.nome = 'Obrigatório'
  if (!v.celular) erros.celular = 'Obrigatório'
  else if (!telefoneValido(v.celular)) erros.celular = 'Incompleto'
  const cep = apenasDigitos(v.cep)
  if (cep && cep.length !== 8) erros.cep = 'Incompleto'
  if (v.uf && v.uf.length !== 2) erros.uf = 'Ex.: SP'
  const meses = Number(v.intervalo)
  if (!v.intervalo) erros.intervalo = 'Obrigatório'
  else if (meses < 1 || meses > INTERVALO_MAXIMO) erros.intervalo = `De 1 a ${INTERVALO_MAXIMO}`
  return erros
}

/** Busca do endereço pelo CEP: o que mostrar logo abaixo do campo. */
type EstadoCep = 'buscando' | 'encontrado' | 'nao-encontrado' | 'sem-conexao' | null

/** Aviso embaixo do título "Endereço" (quando o CEP é encontrado, os campos preenchidos ficam mais escuros). */
const TEXTO_CEP: Record<Exclude<EstadoCep, 'encontrado' | null>, string> = {
  buscando: 'Buscando o endereço...',
  'nao-encontrado': 'CEP não encontrado. Preencha o endereço.',
  'sem-conexao': 'Não foi possível buscar o CEP agora. Preencha o endereço.',
}

/** Cadastro (/app/clientes/novo) e edição (/app/clientes/:id/editar) de cliente. */
export default function ClienteFormPage() {
  const { id } = useParams()
  const novo = !id
  const navigate = useNavigate()
  const { sessao } = useErp()
  const sessaoExpirada = useSessaoExpirada()
  const [original, setOriginal] = useState<Cliente | null>(null)
  const [valores, setValores] = useState<Valores>(VAZIO)
  const [enviado, setEnviado] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erroServidor, setErroServidor] = useState<Partial<Record<Campo, string>>>({})
  const [aviso, setAviso] = useState<Aviso>(null)
  const [estadoCep, setEstadoCep] = useState<EstadoCep>(null)
  // Campos preenchidos pelo CEP (ficam mais escuros até a pessoa mexer neles).
  const [doCep, setDoCep] = useState<Campo[]>([])
  // Último CEP buscado: não busca de novo o mesmo (nem o CEP que veio do cadastro, ao editar).
  const cepBuscado = useRef('')

  const permitido = tem(sessao.usuario, novo ? 'clientes-cadastrar' : 'clientes-editar')

  useEffect(() => {
    if (novo || !permitido) return
    let ativo = true
    obterCliente(sessao.token, id!)
      .then((c) => {
        if (!ativo) return
        cepBuscado.current = c.cep ?? ''
        setOriginal(c)
        setValores(paraFormulario(c))
      })
      .catch((e) => ativo && !sessaoExpirada(e) && setAviso({ tipo: 'erro', texto: mensagemDe(e) }))
    return () => {
      ativo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, sessao.token, permitido])

  // CEP completo: busca o endereço e preenche os campos logo abaixo.
  const cep = apenasDigitos(valores.cep)
  useEffect(() => {
    if (cep.length !== 8 || cep === cepBuscado.current) return
    cepBuscado.current = cep
    let ativo = true
    setEstadoCep('buscando')
    setDoCep([])
    buscarCep(cep)
      .then((endereco) => {
        if (!ativo) return
        if (!endereco) {
          setEstadoCep('nao-encontrado')
          return
        }
        setValores((atual) => ({
          ...atual,
          logradouro: endereco.logradouro || atual.logradouro,
          bairro: endereco.bairro || atual.bairro,
          cidade: endereco.cidade || atual.cidade,
          uf: endereco.uf || atual.uf,
        }))
        setDoCep((['logradouro', 'bairro', 'cidade', 'uf'] as const).filter((c) => endereco[c]))
        setEstadoCep('encontrado')
        document.getElementById('cliente-numeroEndereco')?.focus()
      })
      .catch(() => ativo && setEstadoCep('sem-conexao'))
    return () => {
      ativo = false
    }
  }, [cep])

  if (!permitido) return <div className="erp-pagina"><SemAcesso /></div>
  if (!novo && !original) {
    return (
      <div className="erp-pagina">
        {aviso ? <AvisoPagina aviso={aviso} /> : <p className="erp-carregando">Carregando...</p>}
      </div>
    )
  }

  const erros = { ...erroServidor, ...(enviado ? validar(valores) : {}) }

  const campo = (c: Campo) => ({
    id: `cliente-${c}`,
    valor: valores[c],
    erro: erros[c],
    onChange: (v: string) => {
      setValores((atual) => ({ ...atual, [c]: MASCARAS[c]?.(v) ?? v }))
      setDoCep((lista) => lista.filter((x) => x !== c))
      if (c === 'cep' && apenasDigitos(v).length < 8) setEstadoCep(null)
      setErroServidor({})
      setAviso(null)
    },
  })

  const salvar = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (salvando) return
    setEnviado(true)
    const invalido = ORDEM.find((c) => validar(valores)[c])
    if (invalido) {
      document.getElementById(`cliente-${invalido}`)?.focus()
      return
    }
    setSalvando(true)
    setAviso(null)
    try {
      if (novo) {
        // Volta para a lista, onde o cliente novo aparece no topo (sem aviso)
        await criarCliente(sessao.token, paraApi(valores))
        navigate('/app/clientes')
      } else {
        await editarCliente(sessao.token, id!, paraApi(valores))
        // Volta para a ficha do cliente (sem aviso)
        navigate(`/app/clientes/${id}`)
      }
    } catch (erro) {
      if (sessaoExpirada(erro)) return
      if (erro instanceof ErroApi && erro.campo) {
        const c = (erro.campo === 'intervaloManutencaoMeses' ? 'intervalo' : erro.campo) as Campo
        setErroServidor({ [c]: erro.message })
        document.getElementById(`cliente-${c}`)?.focus()
      }
      setAviso({ tipo: 'erro', texto: mensagemDe(erro) })
      setSalvando(false)
    }
  }

  // Colunas da grade + "do-cep" (fundo mais escuro) nos campos preenchidos pelo CEP
  const colunas = (c: Campo, base: string) => (doCep.includes(c) ? `${base} do-cep` : base)

  const voltar = novo ? '/app/clientes' : `/app/clientes/${id}`
  const meses = Number(valores.intervalo)
  // Próxima manutenção: dia do cadastro (hoje, para um cliente novo) + o intervalo.
  const previa =
    meses >= 1 && meses <= INTERVALO_MAXIMO
      ? formatarDia(somarMeses(original ? new Date(original.criadoEm) : new Date(), meses))
      : null

  return (
    <div className="pagina tema-clientes cliente-cadastro">
      <FaixaPagina
        Ilustracao={IlustracaoClientes}
        titulo={novo ? 'Cadastrar cliente' : 'Editar cliente'}
        subtitulo={novo ? undefined : `ID ${original!.numero} · cadastrado em ${formatarCadastro(original!.criadoEm)}`}
        voltar={{ para: voltar, rotulo: novo ? 'Clientes' : original!.nome }}
      />

      {/* Tudo numa tela só: campos lado a lado (grade de 12 colunas) e seções compactas */}
      <form className="pagina-secoes" onSubmit={salvar} noValidate>
        <SecaoPagina id="cliente-identificacao" numero={1} titulo="Identificação">
          <div className="erp-form cliente-grade">
            <CampoTexto {...campo('nome')} rotulo="Nome" maxLength={200} autoComplete="off" className="c8" />
            <CampoTexto
              {...campo('celular')}
              rotulo="Celular"
              type="tel"
              inputMode="numeric"
              placeholder="(11) 91234-5678"
              autoComplete="off"
              className="c4"
            />
          </div>
        </SecaoPagina>

        <SecaoPagina
          id="cliente-endereco"
          numero={2}
          titulo="Endereço"
          extra={
            estadoCep &&
            estadoCep !== 'encontrado' && (
              <p
                className={estadoCep === 'nao-encontrado' || estadoCep === 'sem-conexao' ? 'clientes-cep-status erro' : 'clientes-cep-status'}
                role="status"
              >
                {TEXTO_CEP[estadoCep]}
              </p>
            )
          }
        >
          <div className="erp-form cliente-grade">
            <CampoTexto {...campo('cep')} rotulo="CEP" inputMode="numeric" placeholder="00000-000" autoComplete="off" className="c3" />
            <CampoTexto {...campo('logradouro')} rotulo="Rua" maxLength={150} autoComplete="off" className={colunas('logradouro', 'c7 linha-toda')} />
            <CampoTexto {...campo('numeroEndereco')} rotulo="Número" maxLength={20} autoComplete="off" className="c2" />
            <CampoTexto {...campo('complemento')} rotulo="Complemento" maxLength={100} placeholder="Apto, bloco, fundos..." autoComplete="off" className="c3" />
            <CampoTexto {...campo('bairro')} rotulo="Bairro" maxLength={100} autoComplete="off" className={colunas('bairro', 'c3')} />
            <CampoTexto {...campo('cidade')} rotulo="Cidade" maxLength={100} autoComplete="off" className={colunas('cidade', 'c4')} />
            <CampoTexto {...campo('uf')} rotulo="UF" placeholder="SP" autoComplete="off" className={colunas('uf', 'c2')} />
          </div>
        </SecaoPagina>

        <SecaoPagina id="cliente-manutencao" numero={3} titulo="Manutenção e envio">
          <div className="erp-form cliente-grade">
            <CampoTexto
              {...campo('intervalo')}
              rotulo="Intervalo para manutenção (meses)"
              inputMode="numeric"
              placeholder="Ex.: 6"
              autoComplete="off"
              className="c4"
            />
            <p className="clientes-previa c4" aria-live="polite">
              {previa ? (
                <>
                  Próxima manutenção: <strong>{previa}</strong>
                </>
              ) : (
                'De quantos em quantos meses o cliente precisa de manutenção.'
              )}
            </p>
            {/* O robô envia a mensagem de WhatsApp nesta data e hora */}
            <CampoTexto {...campo('envio')} rotulo="Data e horário do envio" type="datetime-local" className="c4" />
          </div>
        </SecaoPagina>

        <div className="pagina-barra">
          <button type="submit" className="pagina-botao" disabled={salvando}>
            <IconeCheck tamanho={20} />
            {salvando ? 'Salvando...' : novo ? 'Cadastrar cliente' : 'Salvar alterações'}
          </button>
          <Link to={voltar} className="pagina-botao neutro">
            Cancelar
          </Link>
          {aviso && <AvisoPagina aviso={aviso} />}
        </div>
      </form>
    </div>
  )
}
