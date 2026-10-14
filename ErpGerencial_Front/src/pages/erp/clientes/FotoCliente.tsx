import { useEffect, useRef, useState } from 'react'

/** Tamanho da foto salva (retrato 3×4): pequena, para a ficha e a lista carregarem rápido. */
const LARGURA = 360
const ALTURA = 480

type Props = {
  /** Foto atual (salva ou recém-escolhida); null: sem foto. */
  url: string | null
  /** Foto tirada pela webcam ou enviada do computador, já recortada em 3×4 (JPEG). */
  onEscolher: (foto: Blob) => void
  onRemover: () => void
  erro?: string
}

/** Recorta o meio da imagem (ou do vídeo) em retrato 3×4 e reduz para LARGURA×ALTURA, em JPEG. */
function recortar(origem: CanvasImageSource, largura: number, altura: number): Promise<Blob | null> {
  const escala = Math.min(largura / LARGURA, altura / ALTURA)
  const l = LARGURA * escala
  const a = ALTURA * escala
  const canvas = document.createElement('canvas')
  canvas.width = LARGURA
  canvas.height = ALTURA
  canvas.getContext('2d')!.drawImage(origem, (largura - l) / 2, (altura - a) / 2, l, a, 0, 0, LARGURA, ALTURA)
  return new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', 0.85))
}

/**
 * Quadro da foto do cliente, no canto da ficha (como no registro em papel). Clicar no quadro abre uma janela com
 * "Tirar foto" (webcam, ali mesmo) e "Fazer upload" (arquivo do computador). A foto é enviada ao salvar o cadastro.
 */
export default function FotoCliente({ url, onEscolher, onRemover, erro }: Props) {
  const janela = useRef<HTMLDialogElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const arquivo = useRef<HTMLInputElement>(null)
  const [aberta, setAberta] = useState(false)
  const [camera, setCamera] = useState<MediaStream | null>(null)
  const [ligando, setLigando] = useState(false)
  const [aviso, setAviso] = useState<string>()
  // Webcams do computador (para escolher, quando há mais de uma) e a que está ligada
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const [cameraId, setCameraId] = useState('')

  useEffect(() => {
    const d = janela.current
    if (!d) return
    if (aberta && !d.open) d.showModal()
    else if (!aberta && d.open) d.close()
  }, [aberta])

  // Liga o vídeo na tela; desliga a webcam ao fechar (ou ao sair da página)
  useEffect(() => {
    if (!camera) return
    if (video.current) video.current.srcObject = camera
    return () => camera.getTracks().forEach((t) => t.stop())
  }, [camera])

  const abrir = () => {
    setAviso(undefined)
    setAberta(true)
  }

  const fechar = () => {
    setCamera(null)
    setAberta(false)
  }

  /** Abre uma webcam: a escolhida (id) ou a padrão do computador. */
  const abrirCamera = (id?: string) =>
    navigator.mediaDevices.getUserMedia({
      audio: false,
      video: id ? { deviceId: { exact: id } } : { width: { ideal: 1280 }, height: { ideal: 720 } },
    })

  const listarCameras = async () =>
    (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput' && d.deviceId)

  /**
   * Liga a webcam escolhida (ou a padrão). Se ela não abrir (ocupada, câmera virtual sem imagem...), tenta as outras
   * webcams do computador, uma por uma, e fica com a primeira que funcionar.
   */
  const ligarCamera = async (id?: string) => {
    setAviso(undefined)
    if (!navigator.mediaDevices?.getUserMedia) {
      setAviso('Este navegador não acessa a webcam. Use "Fazer upload".')
      return
    }
    setLigando(true)
    setCamera(null)
    let imagem: MediaStream | null = null
    let falha: unknown = null
    try {
      imagem = await abrirCamera(id)
    } catch (e) {
      falha = e
      // Sem permissão não adianta tentar as outras
      if (!(e instanceof DOMException && e.name === 'NotAllowedError')) {
        for (const outra of (await listarCameras().catch(() => [])).filter((d) => d.deviceId !== id)) {
          try {
            imagem = await abrirCamera(outra.deviceId)
            break
          } catch (e2) {
            falha = e2
          }
        }
      }
    }

    if (imagem) {
      setCamera(imagem)
      setCameraId(imagem.getVideoTracks()[0]?.getSettings().deviceId ?? '')
      setCameras(await listarCameras().catch(() => []))
    } else {
      const nome = falha instanceof DOMException ? falha.name : 'erro'
      setAviso(
        nome === 'NotAllowedError'
          ? 'O navegador está bloqueando a câmera. Clique no ícone da câmera na barra de endereço, escolha "Permitir" e tente de novo.'
          : nome === 'NotFoundError'
            ? 'Nenhuma webcam encontrada. Confira o cabo/USB da webcam ou use "Fazer upload".'
            : `A webcam não abriu (${nome}). Feche programas que possam estar usando a câmera (Teams, Zoom, Skype, app ` +
              'Câmera, OBS) e tente de novo. No Windows, confira também Configurações > Privacidade e segurança > Câmera ' +
              '("Permitir que aplicativos da área de trabalho acessem a câmera").',
      )
    }
    setLigando(false)
  }

  const escolher = (foto: Blob | null) => {
    if (!foto) {
      setAviso('Não foi possível usar esta imagem.')
      return
    }
    onEscolher(foto)
    fechar()
  }

  const capturar = async () => {
    const v = video.current
    if (!v?.videoWidth) return
    escolher(await recortar(v, v.videoWidth, v.videoHeight))
  }

  const enviarArquivo = async (lista: FileList | null) => {
    const f = lista?.[0]
    if (arquivo.current) arquivo.current.value = '' // permite escolher o mesmo arquivo de novo
    if (!f) return
    if (!f.type.startsWith('image/')) {
      setAviso('Escolha uma imagem (JPG, PNG ou WEBP).')
      return
    }
    try {
      const imagem = await createImageBitmap(f)
      escolher(await recortar(imagem, imagem.width, imagem.height))
      imagem.close()
    } catch {
      setAviso('Não foi possível abrir esta imagem. Tente um arquivo JPG ou PNG.')
    }
  }

  return (
    <div className={erro ? 'foto-cliente com-erro' : 'foto-cliente'}>
      <button
        type="button"
        className="foto-cliente-quadro"
        onClick={abrir}
        aria-label={url ? 'Trocar a foto do cliente' : 'Adicionar foto do cliente'}
      >
        {url ? (
          <img src={url} alt="Foto do cliente" />
        ) : (
          <span className="foto-cliente-vazio">
            <IconeCamera tamanho={34} />
            Adicionar foto
          </span>
        )}
        {url && <span className="foto-cliente-trocar">Trocar foto</span>}
      </button>
      {erro && (
        <span className="foto-cliente-erro" role="alert">
          {erro}
        </span>
      )}

      {/* Esc, o botão de fechar ou clicar fora da janela fecham */}
      <dialog
        ref={janela}
        className="janela-envios janela-foto tema-clientes"
        aria-labelledby="janela-foto-titulo"
        onCancel={(e) => {
          e.preventDefault()
          fechar()
        }}
        onClick={(e) => e.target === janela.current && fechar()}
      >
        <header className="janela-envios-topo">
          <div>
            <h2 id="janela-foto-titulo">Foto do cliente</h2>
            <p>{camera ? 'Posicione o rosto no centro e clique em "Capturar".' : 'Tire a foto pela webcam ou envie uma imagem.'}</p>
          </div>
          <button type="button" className="janela-envios-fechar" onClick={fechar} aria-label="Fechar">
            ×
          </button>
        </header>

        <div className="janela-envios-corpo">
          {camera ? (
            <div className="janela-foto-camera">
              <div className="janela-foto-video">
                <video ref={video} autoPlay playsInline muted aria-label="Imagem da webcam" />
              </div>
              {/* Mais de uma webcam (ex.: a do notebook e a externa): escolher qual usar */}
              {cameras.length > 1 && (
                <label className="janela-foto-cameras">
                  Câmera:
                  <select value={cameraId} onChange={(e) => ligarCamera(e.target.value)} disabled={ligando}>
                    {cameras.map((c, i) => (
                      <option key={c.deviceId} value={c.deviceId}>
                        {c.label || `Câmera ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="janela-foto-acoes">
                <button type="button" className="pagina-botao" onClick={capturar}>
                  <IconeCamera tamanho={20} />
                  Capturar
                </button>
                <button type="button" className="pagina-botao neutro" onClick={() => setCamera(null)}>
                  Voltar
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="janela-foto-opcoes">
                <button type="button" className="janela-foto-opcao" onClick={() => ligarCamera()} disabled={ligando}>
                  <IconeCamera tamanho={44} />
                  <strong>{ligando ? 'Ligando a webcam...' : 'Tirar foto'}</strong>
                  <span>Usar a webcam do computador</span>
                </button>
                <button type="button" className="janela-foto-opcao" onClick={() => arquivo.current?.click()}>
                  <IconeUpload />
                  <strong>Fazer upload</strong>
                  <span>Escolher uma imagem do computador</span>
                </button>
                <input
                  ref={arquivo}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={(e) => enviarArquivo(e.target.files)}
                />
              </div>
              {url && (
                <button
                  type="button"
                  className="janela-foto-remover"
                  onClick={() => {
                    onRemover()
                    fechar()
                  }}
                >
                  Remover a foto atual
                </button>
              )}
            </>
          )}
          {aviso && (
            <p className="janela-foto-aviso" role="alert">
              {aviso}
            </p>
          )}
        </div>
      </dialog>
    </div>
  )
}

function IconeCamera({ tamanho }: { tamanho: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  )
}

function IconeUpload() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M12 15V4m0 0L7.5 8.5M12 4l4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" strokeLinecap="round" />
    </svg>
  )
}
