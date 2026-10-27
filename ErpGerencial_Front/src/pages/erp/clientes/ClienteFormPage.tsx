import { useEffect, useRef, useState, type SubmitEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { Aviso } from '../../../components/formulario/FaixaAviso'
import { IconeCheck } from '../../../components/icones/Icones'
import { IlustracaoClientes } from '../../../components/icones/Ilustracoes'
import { useSessaoExpirada } from '../../../hooks/useSessaoExpirada'
import {
  buscarCep,
  cancelarEnviosCliente,
  criarCliente,
  editarCliente,
  ErroApi,
  excluirFotoCliente,
  mensagemDe,
  obterCliente,
  salvarFotoCliente,
  urlFotoCliente,
  type Cliente,
  type DadosCliente,
} from '../../../services/api'
import {
  apenasDigitos,
  erroDocumento,
  formatarCep,
  formatarDocumento,
  formatarTelefone,
  normalizarCnpj,
  telefoneValido,
} from '../../../utils/validacao'
import AvisoPagina from '../AvisoPagina'
import { useErp } from '../contexto'
import FaixaPagina from '../FaixaPagina'
import { tem } from '../modulos'
import SemAcesso from '../SemAcesso'
import CampoFicha from '../CampoFicha'
import CalendarioEnvio from './CalendarioEnvio'
import FotoCliente from './FotoCliente'
import {
  formatarCadastro,
  HORA_DO_ENVIO,
  INTERVALO_MAXIMO,
  calcularIntervalo,
  diaDe,
  proximosEnvios,
} from './formatos'
import { avisarSalvo } from '../../../components/aviso-salvo/avisarSalvo'
import '../../../styles/acesso.css'
import './clientes.css'

/** Próximo envio: dia (calendário) e horário, em campos separados. */
type Campo = keyof Omit<DadosCliente, 'envioEm' | 'manterEnvio'> | 'envioDia' | 'envioHora'
type Valores = Record<Campo, string>

const VAZIO: Valores = {
  nome: '',
  celular: '',
  documento: '',
  produto: '',
  rgInscricao: '',
  dataNascimento: '',
  pontoReferencia: '',
  telefoneResidencial: '',
  telefoneComercial: '',
  celular2: '',
  conjuge: '',
  dataCompra: '',
  cep: '',
  logradouro: '',
  numeroEndereco: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
  item: '',
  marca: '',
  modelo: '',
  observacao: '',
  envioDia: '',
  envioHora: '',
}

/** Envios marcados no calendário (dá para navegar pelos meses e ver os seguintes). */
const ENVIOS_NO_CALENDARIO = 24

const dois = (n: number) => String(n).padStart(2, '0')

/** Data local → "2026-10-14" (valor do campo de data). */
const paraCampoDia = (d: Date) => `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`

/** ISO (UTC) → dia e horário dos campos ("2026-10-14" e "14:30", no horário do computador). */
function paraCamposEnvio(iso: string | null) {
  if (!iso) return { envioDia: '', envioHora: '' }
  const d = new Date(iso)
  return { envioDia: paraCampoDia(d), envioHora: `${dois(d.getHours())}:${dois(d.getMinutes())}` }
}

/** Horário sugerido ao escolher o dia: hoje, a próxima meia hora; nos outros dias, HORA_DO_ENVIO. */
function sugerirHora(dia: string) {
  const agora = new Date()
  if (dia !== paraCampoDia(agora)) return HORA_DO_ENVIO
  const proxima = new Date(agora.getTime() + (30 - (agora.getMinutes() % 30)) * 60_000)
  return proxima.getDate() === agora.getDate() ? `${dois(proxima.getHours())}:${dois(proxima.getMinutes())}` : '23:59'
}

/** Dia e horário dos campos → data e hora local (null se faltar algum). */
const envioDosCampos = (v: Valores) => (v.envioDia && v.envioHora ? new Date(`${v.envioDia}T${v.envioHora}`) : null)

/** O envio dos campos é o mesmo já salvo (ao minuto)? Então ele e o intervalo ficam como estão. */
const mesmoEnvio = (v: Valores, salvo: string | null | undefined) => {
  const envio = envioDosCampos(v)
  return !!envio && !!salvo && Math.abs(envio.getTime() - new Date(salvo).getTime()) < 60_000
}

const MASCARAS: Partial<Record<Campo, (v: string) => string>> = {
  celular: formatarTelefone,
  celular2: formatarTelefone,
  telefoneResidencial: formatarTelefone,
  telefoneComercial: formatarTelefone,
  documento: formatarDocumento,
  cep: formatarCep,
  uf: (v) => v.replace(/[^a-z]/gi, '').slice(0, 2).toUpperCase(),
}

/** Ordem dos campos (a da ficha), para levar o cursor ao primeiro com erro. */
const ORDEM: Campo[] = [
  'nome',
  'documento',
  'dataNascimento',
  'dataCompra',
  'celular',
  'celular2',
  'telefoneResidencial',
  'telefoneComercial',
  'cep',
  'uf',
  'envioDia',
  'envioHora',
]

/** Telefones extras da ficha: opcionais, mas completos quando preenchidos. */
const TELEFONES_OPCIONAIS = ['telefoneResidencial', 'telefoneComercial', 'celular2'] as const

const paraFormulario = (c: Cliente): Valores => ({
  nome: c.nome,
  celular: formatarTelefone(c.celular),
  documento: formatarDocumento(c.documento ?? ''),
  produto: c.produto ?? '',
  rgInscricao: c.rgInscricao ?? '',
  dataNascimento: c.dataNascimento ?? '',
  pontoReferencia: c.pontoReferencia ?? '',
  telefoneResidencial: formatarTelefone(c.telefoneResidencial ?? ''),
  telefoneComercial: formatarTelefone(c.telefoneComercial ?? ''),
  celular2: formatarTelefone(c.celular2 ?? ''),
  conjuge: c.conjuge ?? '',
  dataCompra: c.dataCompra ?? '',
  cep: formatarCep(c.cep ?? ''),
  logradouro: c.logradouro ?? '',
  numeroEndereco: c.numeroEndereco ?? '',
  complemento: c.complemento ?? '',
  bairro: c.bairro ?? '',
  cidade: c.cidade ?? '',
  uf: c.uf ?? '',
  item: c.item ?? '',
  marca: c.marca ?? '',
  modelo: c.modelo ?? '',
  observacao: c.observacao ?? '',
  ...paraCamposEnvio(c.envioEm),
})

const paraApi = ({ envioDia, envioHora, ...v }: Valores): DadosCliente => ({
  ...v,
  celular: apenasDigitos(v.celular),
  celular2: apenasDigitos(v.celular2),
  telefoneResidencial: apenasDigitos(v.telefoneResidencial),
  telefoneComercial: apenasDigitos(v.telefoneComercial),
  dataNascimento: v.dataNascimento || null,
  dataCompra: v.dataCompra || null,
  documento: normalizarCnpj(v.documento),
  cep: apenasDigitos(v.cep),
  // O servidor calcula o intervalo pela data: hoje 14/10 e próximo envio 14/12 → a cada 2 meses
  envioEm: envioDosCampos({ envioDia, envioHora } as Valores)?.toISOString() ?? null,
})

/** @param envioSalvo o envio já marcado (na edição): ele não precisa estar no futuro. */
function validar(v: Valores, envioSalvo: string | null | undefined): Partial<Record<Campo, string>> {
  const erros: Partial<Record<Campo, string>> = {}
  if (!v.nome.trim()) erros.nome = 'Obrigatório'
  if (!v.celular) erros.celular = 'Obrigatório'
  else if (!telefoneValido(v.celular)) erros.celular = 'Incompleto'
  for (const c of TELEFONES_OPCIONAIS) if (v[c] && !telefoneValido(v[c])) erros[c] = 'Incompleto'
  const documento = erroDocumento(v.documento)
  if (documento) erros.documento = documento
  const cep = apenasDigitos(v.cep)
  if (cep && cep.length !== 8) erros.cep = 'Incompleto'
  if (v.uf && v.uf.length !== 2) erros.uf = 'Ex.: SP'
  if (v.envioHora && !v.envioDia) erros.envioDia = 'Escolha o dia'
  else if (v.envioDia && !v.envioHora) erros.envioHora = 'Obrigatório'
  else if (v.envioDia && !mesmoEnvio(v, envioSalvo)) {
    if (envioDosCampos(v)!.getTime() <= Date.now()) erros.envioDia = 'Escolha uma data futura'
    else if (envioDosCampos(v)!.getFullYear() > new Date().getFullYear() + INTERVALO_MAXIMO / 12)
      erros.envioDia = 'No máximo 10 anos'
  }
  return erros
}

/** Busca do endereço pelo CEP: o que mostrar logo abaixo do campo. */
type EstadoCep = 'buscando' | 'encontrado' | 'nao-encontrado' | 'sem-conexao' | null

/** Aviso embaixo da ficha (quando o CEP é encontrado, os campos preenchidos ficam mais escuros). */
const TEXTO_CEP: Record<Exclude<EstadoCep, 'encontrado' | null>, string> = {
  buscando: 'Buscando o endereço...',
  'nao-encontrado': 'CEP não encontrado. Preencha o endereço.',
  'sem-conexao': 'Não foi possível buscar o CEP agora. Preencha o endereço.',
}

/** Foto: a salva, uma nova tirada pela webcam (enviada ao salvar) ou removida. */
type Foto = { tipo: 'salva' } | { tipo: 'nova'; arquivo: Blob; url: string } | { tipo: 'removida' }

/** Cadastro (/app/clientes/novo) e edição (/app/clientes/:id/editar) de cliente. */
export default function ClienteFormPage() {
  const { id } = useParams()
  const novo = !id
  const navigate = useNavigate()
  const { sessao } = useErp()
  const sessaoExpirada = useSessaoExpirada()
  const [original, setOriginal] = useState<Cliente | null>(null)
  const [valores, setValores] = useState<Valores>(VAZIO)
  const [foto, setFoto] = useState<Foto>({ tipo: 'salva' })
  const [enviado, setEnviado] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const [erroServidor, setErroServidor] = useState<Partial<Record<Campo | 'foto', string>>>({})
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

  // Foto nova: libera da memória ao trocar ou sair da página
  useEffect(() => {
    if (foto.tipo !== 'nova') return
    return () => URL.revokeObjectURL(foto.url)
  }, [foto])

  // CEP completo: busca o endereço e preenche os campos da ficha.
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

  const erros = { ...erroServidor, ...(enviado ? validar(valores, original?.envioEm) : {}) }

  const campo = (c: Campo) => ({
    id: `cliente-${c}`,
    valor: valores[c],
    erro: erros[c],
    onChange: (v: string) => {
      setValores((atual) => ({
        ...atual,
        [c]: MASCARAS[c]?.(v) ?? v,
        // Escolheu o dia no calendário: já sugere o horário do envio
        ...(c === 'envioDia' && v && !atual.envioHora ? { envioHora: sugerirHora(v) } : {}),
      }))
      setDoCep((lista) => lista.filter((x) => x !== c))
      if (c === 'cep' && apenasDigitos(v).length < 8) setEstadoCep(null)
      setErroServidor({})
      setAviso(null)
    },
  })

  /**
   * Depois de salvar o cadastro: a foto, quando mudou.
   * Devolve o que não deu certo, se houver.
   */
  const salvarExtras = async (clienteId: string) => {
    const falhas: string[] = []
    const tentar = async (oQue: string, acao: () => Promise<unknown>) => {
      try {
        await acao()
      } catch (erro) {
        if (sessaoExpirada(erro)) throw erro
        falhas.push(`${oQue}: ${mensagemDe(erro)}`)
      }
    }
    if (foto.tipo === 'nova') await tentar('a foto', () => salvarFotoCliente(sessao.token, clienteId, foto.arquivo))
    else if (foto.tipo === 'removida' && original?.fotoId)
      await tentar('a foto', () => excluirFotoCliente(sessao.token, clienteId))
    return falhas.length ? falhas.join('; ') : null
  }

  /** A mensagem é a geral, para todos os clientes: leva à página dela (o que não foi salvo aqui se perde). */
  const irParaMensagemGeral = () => {
    const mudou = JSON.stringify(valores) !== JSON.stringify(original ? paraFormulario(original) : VAZIO) || foto.tipo !== 'salva'
    if (mudou && !window.confirm('Ir para a mensagem do WhatsApp? O que você preencheu nesta ficha e ainda não salvou será perdido.'))
      return
    navigate('/app/clientes/mensagem')
  }

  const salvar = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (salvando) return
    setEnviado(true)
    const invalido = ORDEM.find((c) => validar(valores, original?.envioEm)[c])
    if (invalido) {
      document.getElementById(`cliente-${invalido}`)?.focus()
      return
    }
    setSalvando(true)
    setAviso(null)
    try {
      // Calendário intocado: o envio automático pode ter avançado o próximo envio enquanto o cadastro estava aberto
      const intocado = paraCamposEnvio(original?.envioEm ?? null)
      const manterEnvio = valores.envioDia === intocado.envioDia && valores.envioHora === intocado.envioHora
      const cliente = novo
        ? await criarCliente(sessao.token, paraApi(valores))
        : await editarCliente(sessao.token, id!, { ...paraApi(valores), manterEnvio })
      const falhas = await salvarExtras(cliente.id)
      if (falhas) {
        // O cadastro foi salvo; só a foto não: mostra o aviso na ficha do cliente
        navigate(`/app/clientes/${cliente.id}`, {
          state: { aviso: { tipo: 'erro', texto: `Cliente salvo, mas não foi possível salvar ${falhas}` } },
        })
      } else if (novo) {
        // Volta para a lista, onde o cliente novo aparece no topo
        avisarSalvo('Cliente cadastrado com sucesso')
        navigate('/app/clientes')
      } else {
        // Volta para a ficha do cliente
        avisarSalvo('Alterações feitas com sucesso', 'Cliente')
        navigate(`/app/clientes/${id}`)
      }
    } catch (erro) {
      if (sessaoExpirada(erro)) return
      if (erro instanceof ErroApi && erro.campo) {
        const c = (erro.campo === 'envioEm' ? 'envioDia' : erro.campo) as Campo
        setErroServidor({ [c]: erro.message })
        document.getElementById(`cliente-${c}`)?.focus()
      }
      setAviso({ tipo: 'erro', texto: mensagemDe(erro) })
      setSalvando(false)
    }
  }

  /**
   * "Cancelar envios automáticos". Na edição de um cliente com envio marcado, cancela na hora (nada mais é enviado);
   * no cadastro novo (ou se o envio ainda não foi salvo), só limpa a data.
   */
  const cancelarEnvios = async () => {
    setErroServidor({})
    setAviso(null)
    if (novo || !original?.envioEm) {
      setValores((atual) => ({ ...atual, envioDia: '', envioHora: '' }))
      return
    }
    setCancelando(true)
    try {
      const atualizado = await cancelarEnviosCliente(sessao.token, id!)
      setOriginal(atualizado)
      setValores((atual) => ({ ...atual, envioDia: '', envioHora: '' }))
      avisarSalvo('Alterações feitas com sucesso', 'Envios automáticos cancelados')
    } catch (erro) {
      if (!sessaoExpirada(erro)) setAviso({ tipo: 'erro', texto: mensagemDe(erro) })
    } finally {
      setCancelando(false)
    }
  }

  // Colunas da grade + "do-cep" (fundo mais escuro) nos campos preenchidos pelo CEP
  const colunas = (c: Campo, base: string) => (doCep.includes(c) ? `${base} do-cep` : base)

  const voltar = novo ? '/app/clientes' : `/app/clientes/${id}`
  const urlFoto =
    foto.tipo === 'nova' ? foto.url : foto.tipo === 'salva' && original?.fotoId ? urlFotoCliente(original.fotoId) : null

  // Envios agendados: o próximo (escolhido no calendário) e os seguintes, a cada intervalo.
  // Intervalo = a diferença entre agora e o próximo envio (ou o já salvo, se o envio não mudou).
  const diaValido = /^\d{4}-\d{2}-\d{2}$/.test(valores.envioDia)
  const envio = diaValido ? envioDosCampos({ ...valores, envioHora: valores.envioHora || HORA_DO_ENVIO }) : null
  const intervalo =
    envio && mesmoEnvio(valores, original?.envioEm) && original?.intervaloQuantidade
      ? { quantidade: original.intervaloQuantidade, unidade: original.intervaloUnidade }
      : envio && envio.getTime() > Date.now()
        ? calcularIntervalo(envio)
        : null
  // Dias marcados no calendário (com intervalos de minutos ou horas, só os dias em que cai algum envio)
  const agendados = envio
    ? [...new Set((intervalo ? proximosEnvios(envio, intervalo, ENVIOS_NO_CALENDARIO) : [envio]).map(diaDe))]
    : []

  return (
    <div className="pagina tema-clientes">
      <FaixaPagina
        Ilustracao={IlustracaoClientes}
        titulo={novo ? 'Cadastrar cliente' : 'Editar cliente'}
        subtitulo={novo ? undefined : `ID ${original!.numero} · cadastrado em ${formatarCadastro(original!.criadoEm)}`}
        voltar={{ para: voltar, rotulo: novo ? 'Clientes' : original!.nome }}
      />

      {/* Ficha do cliente (como o registro em papel), centralizada e compacta: cabe na tela sem rolar */}
      <form className="ficha-pagina" onSubmit={salvar} noValidate>
        <div className="ficha-area">
          <div className="ficha" role="group" aria-label="Registro de cliente">
            {/* Foto no canto de cima, ao lado dos dados pessoais e dos telefones */}
            <div className="ficha-topo c12">
              <FotoCliente
                url={urlFoto}
                erro={erroServidor.foto}
                onEscolher={(arquivo) => setFoto({ tipo: 'nova', arquivo, url: URL.createObjectURL(arquivo) })}
                onRemover={() => setFoto({ tipo: 'removida' })}
              />
              <div className="ficha-grade">
                <CampoFicha {...campo('nome')} rotulo="Nome completo" obrigatorio maxLength={200} className="c9" />
                <CampoFicha {...campo('documento')} rotulo="CPF / CNPJ" placeholder="000.000.000-00" className="c3" />

                <CampoFicha {...campo('dataNascimento')} rotulo="Data de nascimento" type="date" className="c3" />
                <CampoFicha {...campo('conjuge')} rotulo="Cônjuge" maxLength={200} className="c6" />
                <CampoFicha {...campo('dataCompra')} rotulo="Data da compra" type="date" className="c3" />

                <CampoFicha {...campo('celular')} rotulo="Celular" obrigatorio type="tel" inputMode="numeric" icone="/imgs/whatsapp.png" className="c3" />
                <CampoFicha {...campo('celular2')} rotulo="Celular 2" type="tel" inputMode="numeric" icone="/imgs/whatsapp.png" className="c3" />
                <CampoFicha {...campo('telefoneResidencial')} rotulo="Fone residencial" type="tel" inputMode="numeric" className="c3" />
                <CampoFicha {...campo('telefoneComercial')} rotulo="Fone comercial" type="tel" inputMode="numeric" className="c3" />
              </div>
            </div>

            {/* Aparelho do cliente: item, marca, modelo e uma observação livre */}
            <div className="ficha-aparelho c12">
              <div className="ficha-grade">
                <CampoFicha {...campo('item')} rotulo="Item" maxLength={120} placeholder="Ex.: Purificador" className="c3" />
                <CampoFicha {...campo('marca')} rotulo="Marca" maxLength={80} className="c2" />
                <CampoFicha {...campo('modelo')} rotulo="Modelo" maxLength={80} className="c2" />
                <CampoFicha {...campo('observacao')} rotulo="Observação" maxLength={2000} className="c5" />
              </div>
            </div>

            {/* Embaixo: endereço à esquerda e o envio automático no canto direito */}
            <div className="ficha-base c12">
              <div className="ficha-grade">
                <CampoFicha {...campo('cep')} rotulo="CEP" inputMode="numeric" placeholder="00000-000" className="c4" />
                <CampoFicha {...campo('logradouro')} rotulo="Endereço" maxLength={150} className={colunas('logradouro', 'c8')} />

                <CampoFicha {...campo('numeroEndereco')} rotulo="Número" maxLength={20} className="c3" />
                <CampoFicha {...campo('complemento')} rotulo="Complemento" maxLength={100} placeholder="Apto, bloco..." className="c4" />
                <CampoFicha {...campo('bairro')} rotulo="Bairro" maxLength={100} className={colunas('bairro', 'c5')} />

                <CampoFicha {...campo('cidade')} rotulo="Cidade" maxLength={100} className={colunas('cidade', 'c5')} />
                <CampoFicha {...campo('uf')} rotulo="UF" placeholder="SP" className={colunas('uf', 'c2')} />
                <CampoFicha {...campo('pontoReferencia')} rotulo="Ponto de referência" maxLength={200} className="c5" />

                {/* Nota no espaço livre embaixo do endereço: sobra altura para o calendário */}
                <p className="ficha-nota c12">
                  <span aria-hidden="true">*</span> Obrigatório. O celular recebe a mensagem automática.
                  {estadoCep && estadoCep !== 'encontrado' && (
                    <strong className={estadoCep === 'buscando' ? 'ficha-cep' : 'ficha-cep erro'} role="status">
                      {TEXTO_CEP[estadoCep]}
                    </strong>
                  )}
                </p>
              </div>

              {/* Calendário: clicar num dia marca o próximo envio da mensagem; os seguintes saem a cada N meses */}
              <section className="ficha-envio" aria-labelledby="cliente-envio-titulo">
                <h2 id="cliente-envio-titulo" className="ficha-topico">
                  Calendário
                </h2>
                <div className="ficha-envio-corpo">
                  <CalendarioEnvio
                    id="cliente-envioDia"
                    dia={valores.envioDia}
                    agendados={agendados}
                    mesesMaximo={INTERVALO_MAXIMO}
                    erro={erros.envioDia}
                    onEscolher={campo('envioDia').onChange}
                  />

                  {/* Horário e os envios já agendados: o robô manda cada um e marca o seguinte */}
                  <div className="ficha-envio-agenda" aria-live="polite">
                    <CampoFicha {...campo('envioHora')} rotulo="Selecione o horário do envio" type="time" />
                    {/* O intervalo e as datas seguintes são salvos, mas não aparecem aqui (só marcados no calendário) */}
                    {!diaValido && (
                      <p className="ficha-envio-vazio">
                        Clique no dia do próximo envio. Os seguintes saem no mesmo intervalo.
                      </p>
                    )}
                    {(diaValido || original?.envioEm) && (
                      <button type="button" className="ficha-envio-cancelar" onClick={cancelarEnvios} disabled={cancelando}>
                        {cancelando ? 'Cancelando...' : 'Cancelar envios automáticos'}
                      </button>
                    )}
                    {/* A mensagem que sai nas datas do calendário é a mesma para todos os clientes */}
                    <button type="button" className="ficha-envio-mensagem" onClick={irParaMensagemGeral}>
                      <img src="/imgs/whatsapp.png" alt="" aria-hidden="true" />
                      Mensagem do WhatsApp
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </div>

        </div>

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
