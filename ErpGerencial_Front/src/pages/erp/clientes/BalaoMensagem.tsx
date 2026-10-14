type Props = {
  /** Texto com os trechos {nome}, {data} e {empresa} (trocados como o envio automático faz). */
  texto: string
  imagemUrl: string | null
  /** Nome do cliente (só o primeiro nome entra na mensagem). */
  nome: string
  empresa: string
  /** Dia e hora do envio ({data} e o horário no balão); sem: agora. */
  envio?: Date | null
}

/** Monta a mensagem como o cliente recebe: {nome} (primeiro nome), {data} (dia do envio) e {empresa}. */
function montarMensagem(texto: string, nome: string, empresa: string, envio: Date) {
  const primeiroNome = nome.trim().split(/\s+/)[0] ?? nome
  return texto
    .replace(/\{nome\}/gi, primeiroNome)
    .replace(/\{data\}/gi, envio.toLocaleDateString('pt-BR'))
    .replace(/\{empresa\}/gi, empresa)
    .trim()
}

/** Prévia da mensagem no estilo do WhatsApp: a imagem (se houver), o texto de legenda e o horário do envio. */
export default function BalaoMensagem({ texto, imagemUrl, nome, empresa, envio }: Props) {
  const quando = envio ?? new Date()
  const mensagem = montarMensagem(texto, nome, empresa, quando)
  return (
    <div className="whatsapp-conversa">
      {mensagem || imagemUrl ? (
        <div className="whatsapp-balao">
          {imagemUrl && <img src={imagemUrl} alt="Imagem enviada com a mensagem" />}
          {mensagem && <p>{mensagem}</p>}
          <span className="whatsapp-hora" aria-hidden="true">
            {quando.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} ✓✓
          </span>
        </div>
      ) : (
        <p className="whatsapp-vazio">Nenhuma mensagem escrita ainda.</p>
      )}
    </div>
  )
}
