import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { avisarSalvo } from '../../../components/aviso-salvo/avisarSalvo'
import CampoTexto from '../../../components/formulario/CampoTexto'
import type { Aviso } from '../../../components/formulario/FaixaAviso'
import { IconeAlerta, IconeMais } from '../../../components/icones/Icones'
import { IlustracaoCupomFiscal } from '../../../components/icones/Ilustracoes'
import { useSessaoExpirada } from '../../../hooks/useSessaoExpirada'
import { cancelarCupom, mensagemDe, obterCupom, rotuloPagamento, type Cupom } from '../../../services/api'
import { formatarMoeda } from '../../../utils/validacao'
import AvisoPagina from '../AvisoPagina'
import FaixaPagina from '../FaixaPagina'
import { useErp } from '../contexto'
import { MODULOS, podeAcessar } from '../modulos'
import SemAcesso from '../SemAcesso'
import { CupomTermico, ReciboA4 } from './ImpressaoCupom'
import { numeroCupom } from './numero'
import { useImpressao, type FormatoImpressao } from './useImpressao'
import '../../../styles/acesso.css'
import './cupons.css'

const MODULO = MODULOS.find((m) => m.id === 'cupom-fiscal')!

const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

// Cupom emitido: pré-visualização do papel, imprimir (80 mm ou recibo A4) e cancelar.
export default function CupomPage() {
  const { id } = useParams()
  const { sessao } = useErp()
  const sessaoExpirada = useSessaoExpirada()
  const [cupom, setCupom] = useState<Cupom | null>(null)
  const [aviso, setAviso] = useState<Aviso>(null)
  const [previa, setPrevia] = useState<FormatoImpressao>('cupom')
  const [cancelando, setCancelando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [erroMotivo, setErroMotivo] = useState<string>()
  const [enviandoCancelamento, setEnviandoCancelamento] = useState(false)
  const { imprimir, imprimindo, elemento } = useImpressao(cupom)
  const podeVer = podeAcessar(sessao.usuario, MODULO)

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

  const acoes = (
    <Link to="/app/cupom-fiscal/novo" className="pagina-botao marrom">
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
          {/* Imprimir: botões grandes, cada um com o desenho do papel */}
          <section className="cupom-imprimir" aria-label="Imprimir">
            <h2 className="detalhe-titulo">Imprimir</h2>
            <button
              type="button"
              className={previa === 'cupom' ? 'cupom-formato marcado' : 'cupom-formato'}
              onClick={() => setPrevia('cupom')}
              aria-pressed={previa === 'cupom'}
            >
              <span className="cupom-formato-emoji" aria-hidden="true">🧾</span>
              <span className="cupom-formato-textos">
                <strong>Cupom 80 mm</strong>
                <span>Impressora térmica (bobina)</span>
              </span>
            </button>
            <button
              type="button"
              className={previa === 'recibo' ? 'cupom-formato marcado' : 'cupom-formato'}
              onClick={() => setPrevia('recibo')}
              aria-pressed={previa === 'recibo'}
            >
              <span className="cupom-formato-emoji" aria-hidden="true">📄</span>
              <span className="cupom-formato-textos">
                <strong>Recibo A4</strong>
                <span>Duas vias numa folha, para assinar</span>
              </span>
            </button>
            <button
              type="button"
              className="pagina-botao cupom-botao-imprimir"
              onClick={() => imprimir(previa)}
              disabled={imprimindo}
            >
              <span aria-hidden="true">🖨️</span>
              {previa === 'cupom' ? 'Imprimir cupom' : 'Imprimir recibo'}
            </button>

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
          <section className={`cupom-papel cupom-papel-${previa}`} aria-label="Pré-visualização">
            {previa === 'cupom' ? <CupomTermico cupom={cupom} /> : <ReciboA4 cupom={cupom} />}
          </section>
        </div>
      </div>

      {elemento}
    </div>
  )
}
