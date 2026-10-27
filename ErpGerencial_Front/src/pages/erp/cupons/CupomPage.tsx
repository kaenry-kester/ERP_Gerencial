import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { avisarSalvo } from '../../../components/aviso-salvo/avisarSalvo'
import CampoTexto from '../../../components/formulario/CampoTexto'
import type { Aviso } from '../../../components/formulario/FaixaAviso'
import { IconeAlerta, IconeMais } from '../../../components/icones/Icones'
import { IlustracaoCupomFiscal } from '../../../components/icones/Ilustracoes'
import { useSessaoExpirada } from '../../../hooks/useSessaoExpirada'
import {
  cancelarCupom,
  enviarCupomWhatsapp,
  mensagemDe,
  obterCliente,
  obterCupom,
  rotuloPagamento,
  type Cupom,
} from '../../../services/api'
import { formatarMoeda, formatarTelefone, telefoneValido } from '../../../utils/validacao'
import AvisoPagina from '../AvisoPagina'
import FaixaPagina from '../FaixaPagina'
import { useErp } from '../contexto'
import { MODULOS, podeAcessar } from '../modulos'
import SemAcesso from '../SemAcesso'
import { CupomTermico } from './ImpressaoCupom'
import NotaGov from './NotaGov'
import { LOGO_HORIZONTAL } from '../logoLoja'
import { numeroCupom } from './numero'
import { baixarArquivo, gerarPdfCupom } from './pdfCupom'
import { useImpressao } from './useImpressao'
import '../../../styles/acesso.css'
import './cupons.css'

const MODULO = MODULOS.find((m) => m.id === 'cupom-fiscal')!

const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

// Cupom emitido: pré-visualização do papel, imprimir (80 mm), baixar em PDF, encaminhar pelo WhatsApp e cancelar.
export default function CupomPage() {
  const { id } = useParams()
  const { sessao } = useErp()
  const sessaoExpirada = useSessaoExpirada()
  const [cupom, setCupom] = useState<Cupom | null>(null)
  const [aviso, setAviso] = useState<Aviso>(null)
  const [cancelando, setCancelando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [erroMotivo, setErroMotivo] = useState<string>()
  const [enviandoCancelamento, setEnviandoCancelamento] = useState(false)
  // Logo da loja no topo do cupom
  const { imprimir, imprimindo, elemento } = useImpressao(cupom, LOGO_HORIZONTAL)
  const podeVer = podeAcessar(sessao.usuario, MODULO)
  // PDF: o cupom montado fora da tela (mesmo desenho do impresso) é fotografado e vira o arquivo
  const papelPdf = useRef<HTMLDivElement>(null)
  const [gerandoPdf, setGerandoPdf] = useState(false)
  const [whatsappAberto, setWhatsappAberto] = useState(false)
  const [numeroWhatsapp, setNumeroWhatsapp] = useState('')
  const [erroWhatsapp, setErroWhatsapp] = useState<string>()
  // Erro do envio (WhatsApp desconectado, número sem WhatsApp...): aparece embaixo do campo, com espaço para o texto
  const [falhaEnvio, setFalhaEnvio] = useState<string>()
  const [enviandoWhatsapp, setEnviandoWhatsapp] = useState(false)

  useEffect(() => {
    if (!podeVer) return
    let ativo = true
    obterCupom(sessao.token, id!)
      .then((c) => ativo && setCupom(c))
      .catch((e) => ativo && !sessaoExpirada(e) && setAviso({ tipo: 'erro', texto: mensagemDe(e) }))
    return () => {
      ativo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, sessao.token, podeVer])

  if (!podeVer) return <div className="erp-pagina"><SemAcesso /></div>

  const faixaCarregando = (
    <FaixaPagina
      Ilustracao={IlustracaoCupomFiscal}
      titulo="Cupom"
      voltar={{ para: '/app/cupom-fiscal', rotulo: MODULO.rotulo }}
    />
  )

  if (!cupom) {
    return (
      <div className="pagina tema-cupom">
        {faixaCarregando}
        <div className="pagina-corpo">
          {aviso ? <AvisoPagina aviso={aviso} /> : <p className="erp-carregando">Carregando...</p>}
        </div>
      </div>
    )
  }

  const confirmarCancelamento = async () => {
    if (!motivo.trim()) {
      setErroMotivo('Digite o motivo')
      document.getElementById('cupom-motivo')?.focus()
      return
    }
    setEnviandoCancelamento(true)
    setAviso(null)
    try {
      const atualizado = await cancelarCupom(sessao.token, cupom.id, motivo.trim())
      setCupom(atualizado)
      setCancelando(false)
      avisarSalvo('Cupom cancelado com sucesso', 'Os produtos voltaram ao estoque')
    } catch (erro) {
      if (!sessaoExpirada(erro)) setAviso({ tipo: 'erro', texto: mensagemDe(erro) })
    } finally {
      setEnviandoCancelamento(false)
    }
  }

  const montarPdf = async () => {
    if (!papelPdf.current) throw new Error('sem cupom')
    return gerarPdfCupom(papelPdf.current)
  }

  const baixarPdf = async () => {
    setGerandoPdf(true)
    setAviso(null)
    try {
      const { arquivo } = await montarPdf()
      baixarArquivo(arquivo, `cupom-${numeroCupom(cupom.numero)}.pdf`)
    } catch {
      setAviso({ tipo: 'erro', texto: 'Não foi possível gerar o PDF. Tente de novo.' })
    } finally {
      setGerandoPdf(false)
    }
  }

  /** Abre o campo do número já com o celular do cliente do cupom (quando tem). */
  const abrirWhatsapp = () => {
    setWhatsappAberto(true)
    setErroWhatsapp(undefined)
    setFalhaEnvio(undefined)
    if (cupom.clienteId && !numeroWhatsapp)
      obterCliente(sessao.token, cupom.clienteId)
        .then((c) => setNumeroWhatsapp((atual) => atual || formatarTelefone(c.celular)))
        .catch(() => {})
  }

  /** Sem número: a API manda para o celular do cliente do cupom. Se der errado, abre o campo com o aviso. */
  const enviarPdf = async (numero: string | null) => {
    setEnviandoWhatsapp(true)
    setErroWhatsapp(undefined)
    setFalhaEnvio(undefined)
    try {
      const { base64 } = await montarPdf()
      const enviado = await enviarCupomWhatsapp(sessao.token, cupom.id, base64, numero)
      setWhatsappAberto(false)
      avisarSalvo('Cupom enviado pelo WhatsApp', `PDF enviado para ${formatarTelefone(enviado.numero)}`)
    } catch (erro) {
      if (sessaoExpirada(erro)) return
      if (!numero) abrirWhatsapp()
      setFalhaEnvio(erro instanceof Error && !('status' in erro) ? 'Não foi possível gerar o PDF.' : mensagemDe(erro))
    } finally {
      setEnviandoWhatsapp(false)
    }
  }

  /** Cupom com cliente: um clique já envia para o celular dele. Sem cliente: pede o número. */
  const encaminharWhatsapp = () => {
    if (whatsappAberto) setWhatsappAberto(false)
    else if (cupom.clienteId) void enviarPdf(null)
    else abrirWhatsapp()
  }

  const enviarWhatsapp = () => {
    if (!telefoneValido(numeroWhatsapp)) {
      setErroWhatsapp(numeroWhatsapp ? 'Número incompleto' : 'Digite o WhatsApp do cliente')
      document.getElementById('cupom-whatsapp')?.focus()
      return
    }
    void enviarPdf(numeroWhatsapp)
  }

  const acoes = (
    <Link to="/app/cupom-fiscal/novo" className="pagina-botao marinho">
      <IconeMais tamanho={20} />
      Emitir outro
    </Link>
  )

  return (
    <div className="pagina tema-cupom">
      <FaixaPagina
        Ilustracao={IlustracaoCupomFiscal}
        titulo={`Cupom Nº ${numeroCupom(cupom.numero)}`}
        subtitulo={`${dataHora(cupom.emitidoEm)} · ${cupom.clienteNome ?? 'Consumidor'} · ${formatarMoeda(cupom.total)}`}
        voltar={{ para: '/app/cupom-fiscal', rotulo: MODULO.rotulo }}
        acoes={acoes}
      />

      <div className="pagina-corpo cupom-detalhe">
        {aviso && <AvisoPagina aviso={aviso} />}

        {cupom.canceladoEm && (
          <p className="cupom-cancelado-faixa" role="status">
            <span aria-hidden="true">⛔</span>
            Cancelado em {dataHora(cupom.canceladoEm)}. Motivo: {cupom.motivoCancelamento}
          </p>
        )}

        <div className="cupom-detalhe-grade">
          {/* Imprimir: só o cupom fiscal (impressora térmica de 80 mm) */}
          <section className="cupom-imprimir" aria-label="Imprimir">
            <h2 className="detalhe-titulo">Imprimir</h2>
            <button type="button" className="pagina-botao cupom-botao-imprimir" onClick={imprimir} disabled={imprimindo}>
              <span aria-hidden="true">🖨️</span>
              Imprimir cupom fiscal
            </button>

            {/* PDF do cupom: baixar no computador ou mandar para o cliente pelo WhatsApp da loja */}
            <div className="cupom-pdf-botoes">
              <button type="button" className="pagina-botao neutro" onClick={() => void baixarPdf()} disabled={gerandoPdf}>
                <span aria-hidden="true">📄</span>
                {gerandoPdf ? 'Gerando PDF...' : 'Baixar PDF'}
              </button>
              <button
                type="button"
                className="pagina-botao cupom-botao-whatsapp"
                onClick={encaminharWhatsapp}
                disabled={enviandoWhatsapp}
                aria-expanded={whatsappAberto}
              >
                <img src="/imgs/whatsapp.png" alt="" aria-hidden="true" />
                {enviandoWhatsapp && !whatsappAberto ? 'Enviando...' : 'Encaminhar para o WhatsApp'}
              </button>
            </div>
            {whatsappAberto && (
              <div className="cupom-whatsapp">
                <CampoTexto
                  id="cupom-whatsapp"
                  rotulo="WhatsApp do cliente"
                  type="tel"
                  inputMode="numeric"
                  placeholder="(16) 99999-9999"
                  valor={numeroWhatsapp}
                  onChange={(v) => {
                    setNumeroWhatsapp(formatarTelefone(v))
                    setErroWhatsapp(undefined)
                  }}
                  erro={erroWhatsapp}
                />
                {falhaEnvio && (
                  <p className="cupom-whatsapp-erro" role="alert">
                    {falhaEnvio}
                  </p>
                )}
                <div className="cupom-cancelamento-botoes">
                  <button
                    type="button"
                    className="pagina-botao cupom-botao-whatsapp"
                    onClick={enviarWhatsapp}
                    disabled={enviandoWhatsapp}
                  >
                    <img src="/imgs/whatsapp.png" alt="" aria-hidden="true" />
                    {enviandoWhatsapp ? 'Enviando...' : 'Enviar PDF'}
                  </button>
                  <button type="button" className="pagina-botao neutro" onClick={() => setWhatsappAberto(false)}>
                    Voltar
                  </button>
                </div>
              </div>
            )}

            {/* Nota fiscal: emitida no site do governo (gov.br); aqui fica anotado o número */}
            <NotaGov cupom={cupom} />

            <dl className="cupom-detalhe-dados">
              <div>
                <dt>Pagamento</dt>
                <dd>
                  {rotuloPagamento(cupom.formaPagamento)}
                  {cupom.formaPagamento2 && ` + ${rotuloPagamento(cupom.formaPagamento2)}`}
                </dd>
              </div>
              {cupom.troco !== null && (
                <div>
                  <dt>Troco</dt>
                  <dd>{formatarMoeda(cupom.troco)}</dd>
                </div>
              )}
              <div>
                <dt>Vendedor</dt>
                <dd>{cupom.vendedorNome ?? cupom.emitidoPor}</dd>
              </div>
            </dl>

            {!cupom.canceladoEm &&
              (!cancelando ? (
                <button type="button" className="pagina-botao neutro cupom-cancelar" onClick={() => setCancelando(true)}>
                  <IconeAlerta tamanho={20} />
                  Cancelar cupom
                </button>
              ) : (
                <div className="cupom-cancelamento">
                  <p>O cupom fica registrado como cancelado e os produtos voltam ao estoque.</p>
                  <CampoTexto
                    id="cupom-motivo"
                    rotulo="Motivo do cancelamento"
                    valor={motivo}
                    onChange={(v) => {
                      setMotivo(v)
                      setErroMotivo(undefined)
                    }}
                    erro={erroMotivo}
                    maxLength={300}
                  />
                  <div className="cupom-cancelamento-botoes">
                    <button
                      type="button"
                      className="pagina-botao perigo"
                      onClick={confirmarCancelamento}
                      disabled={enviandoCancelamento}
                    >
                      {enviandoCancelamento ? 'Cancelando...' : 'Confirmar cancelamento'}
                    </button>
                    <button type="button" className="pagina-botao neutro" onClick={() => setCancelando(false)}>
                      Voltar
                    </button>
                  </div>
                </div>
              ))}
          </section>

          {/* Como vai sair no papel */}
          <section className="cupom-papel cupom-papel-cupom" aria-label="Pré-visualização">
            <CupomTermico cupom={cupom} logoUrl={LOGO_HORIZONTAL} />
          </section>
        </div>
      </div>

      {elemento}

      {/* Cupom para o PDF: fora da tela, com margem branca em volta */}
      <div className="impressao" aria-hidden="true">
        <div ref={papelPdf} className="cupom-pdf-papel">
          <CupomTermico cupom={cupom} logoUrl={LOGO_HORIZONTAL} />
        </div>
      </div>
    </div>
  )
}
