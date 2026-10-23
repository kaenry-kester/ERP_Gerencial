import { useEffect, useRef, useState } from 'react'
import { avisarSalvo } from '../../../components/aviso-salvo/avisarSalvo'
import { useSessaoExpirada } from '../../../hooks/useSessaoExpirada'
import { conectarWhatsapp, mensagemDe, obterConexaoWhatsapp, type ConexaoWhatsapp as Conexao } from '../../../services/api'
import { apenasDigitos, formatarTelefone } from '../../../utils/validacao'
import { useErp } from '../contexto'

/** O QR Code do WhatsApp vale ~20 segundos: pede um novo antes de vencer. */
const RENOVAR_QR_MS = 18_000
/** Confere a cada 3 segundos se o celular já leu o QR Code. */
const CONFERIR_MS = 3_000
/** Depois de 5 minutos sem conectar, para e pede para tentar de novo. */
const LIMITE_MS = 5 * 60_000

const TEXTO: Record<Conexao['estado'], { emoji: string; texto: string }> = {
  conectado: { emoji: '✅', texto: 'Conectado: as mensagens saem por este número' },
  aguardando: { emoji: '⏳', texto: 'Aguardando o celular ler o QR Code' },
  desconectado: { emoji: '⚠️', texto: 'Desconectado: as mensagens não saem até conectar' },
  indisponivel: { emoji: '⚠️', texto: 'O serviço do WhatsApp não respondeu' },
  'sem-numero': { emoji: 'ℹ️', texto: 'Digite e salve o número para conectar' },
}

/**
 * Conexão do WhatsApp que envia: mostra se o número salvo está conectado e, ao clicar em "Conectar",
 * o QR Code (e o código de 8 letras) para ler no celular. O QR se renova sozinho até conectar.
 */
export default function ConexaoWhatsapp({ salvo, digitado }: { salvo: string | null; digitado: string }) {
  const { sessao } = useErp()
  const sessaoExpirada = useSessaoExpirada()
  const [conexao, setConexao] = useState<Conexao | null>(null)
  const [conectando, setConectando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const inicio = useRef(0)

  // Situação do número salvo (de novo sempre que o número salvo muda)
  useEffect(() => {
    let ativo = true
    obterConexaoWhatsapp(sessao.token)
      .then((c) => ativo && setConexao(c))
      .catch((e) => ativo && !sessaoExpirada(e) && setErro(mensagemDe(e)))
    return () => {
      ativo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessao.token, salvo])

  // Enquanto conecta: confere a situação e renova o QR Code até o celular conectar (ou dar o tempo)
  useEffect(() => {
    if (!conectando) return
    let ativo = true
    const conferir = window.setInterval(() => {
      if (Date.now() - inicio.current > LIMITE_MS) {
        setConectando(false)
        setErro('O celular não foi conectado a tempo. Clique em "Conectar" de novo.')
        return
      }
      obterConexaoWhatsapp(sessao.token)
        .then((c) => {
          if (!ativo || c.estado !== 'conectado') return
          setConexao(c)
          setConectando(false)
          avisarSalvo('WhatsApp conectado com sucesso', formatarTelefone(c.remetente ?? ''))
        })
        .catch(() => {})
    }, CONFERIR_MS)
    const renovar = window.setInterval(() => {
      conectarWhatsapp(sessao.token)
        .then((c) => {
          if (!ativo) return
          setConexao(c)
          if (c.estado === 'conectado') setConectando(false)
        })
        .catch(() => {})
    }, RENOVAR_QR_MS)
    return () => {
      ativo = false
      window.clearInterval(conferir)
      window.clearInterval(renovar)
    }
  }, [conectando, sessao.token])

  const conectar = async () => {
    setErro(null)
    try {
      const c = await conectarWhatsapp(sessao.token)
      setConexao(c)
      if (c.estado === 'aguardando') {
        inicio.current = Date.now()
        setConectando(true)
      }
    } catch (e) {
      if (!sessaoExpirada(e)) setErro(mensagemDe(e))
    }
  }

  const naoSalvo = apenasDigitos(digitado) !== (salvo ?? '')
  // Fora da janela do QR Code, "tentando conectar" é o mesmo que desconectado para quem usa
  const estado = conexao?.estado === 'aguardando' && !conectando ? 'desconectado' : conexao?.estado
  const situacao = estado && TEXTO[estado]
  const qr = conectando && conexao?.qrCode
  const codigo = conectando && conexao?.codigo

  return (
    <div className={`whatsapp-conexao ${estado ?? ''}`} aria-live="polite">
      {naoSalvo && digitado ? (
        <p className="whatsapp-conexao-situacao">
          <span aria-hidden="true">💾</span> Salve o número novo (botão Salvar, no pé da página) para conectar o WhatsApp dele.
        </p>
      ) : (
        situacao && (
          <p className="whatsapp-conexao-situacao">
            <span aria-hidden="true">{situacao.emoji}</span>
            {situacao.texto}
            {estado === 'indisponivel' && conexao?.mensagem && <small>{conexao.mensagem}</small>}
          </p>
        )
      )}

      {!naoSalvo && salvo && estado !== 'conectado' && !conectando && (
        <button type="button" className="pagina-botao whatsapp-conectar" onClick={() => void conectar()}>
          <img src="/imgs/whatsapp.png" alt="" aria-hidden="true" />
          Conectar este WhatsApp
        </button>
      )}

      {conectando && (
        <div className="whatsapp-qr">
          <div className="whatsapp-qr-imagem">
            {qr ? <img src={qr} alt="QR Code para conectar o WhatsApp" /> : <span>Gerando o QR Code...</span>}
          </div>
          <ol className="whatsapp-qr-passos">
            <li>
              No celular <strong>{formatarTelefone(salvo ?? '')}</strong>, abra o <strong>WhatsApp</strong>.
            </li>
            <li>
              Toque em <strong>⋮ (ou Configurações) → Aparelhos conectados → Conectar um aparelho</strong>.
            </li>
            <li>Aponte a câmera para o QR Code ao lado. Ele se renova sozinho.</li>
            {codigo && (
              <li>
                Ou toque em <strong>"Conectar com número de telefone"</strong> e digite:{' '}
                <strong className="whatsapp-qr-codigo">
                  {codigo.slice(0, 4)}-{codigo.slice(4)}
                </strong>
              </li>
            )}
          </ol>
          <button type="button" className="pagina-botao neutro" onClick={() => setConectando(false)}>
            Cancelar
          </button>
        </div>
      )}

      {erro && <p className="whatsapp-conexao-erro">{erro}</p>}
    </div>
  )
}
