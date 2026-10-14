import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { EnvioWhatsapp } from '../../../services/api'
import { formatarTelefone } from '../../../utils/validacao'
import { formatarDia } from './formatos'

/** Mensagens maiores que isso aparecem em 3 linhas, com "ver mensagem inteira". */
const MENSAGEM_CURTA = 160

const STATUS = {
  enviado: { texto: 'Enviada', classe: 'lista-etiqueta' },
  teste: { texto: 'Teste', classe: 'lista-etiqueta atencao' },
  erro: { texto: 'Não enviada', classe: 'lista-etiqueta alerta' },
}

type Props = {
  aberto: boolean
  titulo: string
  /** Frase curta embaixo do título. */
  dica: string
  /** null enquanto carrega. */
  envios: EnvioWhatsapp[] | null
  erro?: string
  /** Últimos envios (vários clientes): mostra o nome de cada um, com link. */
  mostrarCliente?: boolean
  /** Histórico de um cliente: mostra o texto que foi enviado em cada vez. */
  mostrarMensagem?: boolean
  onFechar: () => void
}

/** Janela por cima da tela, com rolagem, listando envios da mensagem automática (mais novos primeiro). */
export default function JanelaEnvios({ aberto, titulo, dica, envios, erro, mostrarCliente, mostrarMensagem, onFechar }: Props) {
  const janela = useRef<HTMLDialogElement>(null)
  const [abertas, setAbertas] = useState<Set<string>>(new Set())

  useEffect(() => {
    const d = janela.current
    if (!d) return
    if (aberto && !d.open) d.showModal()
    else if (!aberto && d.open) d.close()
  }, [aberto])

  return (
    // Esc, o botão de fechar ou clicar fora da janela fecham
    <dialog
      ref={janela}
      className="janela-envios tema-clientes"
      aria-labelledby="janela-envios-titulo"
      onCancel={(e) => {
        e.preventDefault()
        onFechar()
      }}
      onClick={(e) => e.target === janela.current && onFechar()}
    >
      <header className="janela-envios-topo">
        <div>
          <h2 id="janela-envios-titulo">{titulo}</h2>
          <p>{dica}</p>
        </div>
        <button type="button" className="janela-envios-fechar" onClick={onFechar} aria-label="Fechar">
          ×
        </button>
      </header>

      <div className="janela-envios-corpo">
        {erro ? (
          <p className="mensagem-envio-erro">{erro}</p>
        ) : !envios ? (
          <p className="erp-carregando">Carregando...</p>
        ) : envios.length === 0 ? (
          <p className="erp-nota">Nenhuma mensagem enviada ainda.</p>
        ) : (
          <ul className="mensagem-envios">
            {envios.map((e) => (
              <li key={e.id} className="mensagem-envio">
                <span className={STATUS[e.status].classe}>{STATUS[e.status].texto}</span>
                <span className="mensagem-envio-textos">
                  {mostrarCliente && (
                    <Link to={`/app/clientes/${e.clienteId}`} className="lista-nome" onClick={onFechar}>
                      {e.clienteNome}
                    </Link>
                  )}
                  <span className="mensagem-envio-detalhe">
                    {new Date(e.criadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} ·{' '}
                    {formatarTelefone(e.telefone)} ·{' '}
                    {e.tipo === 'agendado' ? `envio de ${formatarDia(e.dataReferencia)}` : `manutenção de ${formatarDia(e.dataReferencia)}`}
                  </span>
                  {mostrarMensagem && (
                    <>
                      <span className={abertas.has(e.id) ? 'mensagem-envio-texto' : 'mensagem-envio-texto curto'}>{e.mensagem}</span>
                      {e.mensagem.length > MENSAGEM_CURTA && (
                        <button
                          type="button"
                          className="mensagem-envio-mais"
                          onClick={() =>
                            setAbertas((atual) => {
                              const nova = new Set(atual)
                              if (!nova.delete(e.id)) nova.add(e.id)
                              return nova
                            })
                          }
                        >
                          {abertas.has(e.id) ? 'ver menos' : 'ver mensagem inteira'}
                        </button>
                      )}
                    </>
                  )}
                  {e.erro && <span className="mensagem-envio-erro">{e.erro}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </dialog>
  )
}
