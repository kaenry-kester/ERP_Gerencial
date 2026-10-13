import { useEffect, useRef, useState, type Dispatch, type DragEvent, type SetStateAction } from 'react'
import { IconeLixeira, IconeMais, IconeSeta, IconeVoltar } from '../../../components/icones/Icones'
import './imagens.css'

export const MAXIMO_IMAGENS = 10
const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
/** Lado maior depois de reduzir: nítido na tela e leve para guardar. */
const LADO_MAXIMO = 1600
const TAMANHO_MAXIMO = 5 * 1024 * 1024

/** Imagem da galeria: já salva (tem id) ou nova, ainda só no navegador (tem arquivo). */
export type ImagemProduto = {
  chave: string
  id?: string
  arquivo?: Blob
  url: string
}

let contador = 0
const novaChave = () => `nova-${++contador}`

/**
 * Deixa a foto pronta para enviar: fotos grandes (ex.: de celular) são reduzidas para 1600px no lado maior.
 * GIF fica como está (pode ser animado).
 */
async function prepararImagem(arquivo: File): Promise<Blob> {
  if (!TIPOS_ACEITOS.includes(arquivo.type)) throw new Error(`${arquivo.name}: use JPG, PNG, WEBP ou GIF`)
  if (arquivo.type === 'image/gif') {
    if (arquivo.size > TAMANHO_MAXIMO) throw new Error(`${arquivo.name}: GIF grande demais (máximo de 5 MB)`)
    return arquivo
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(arquivo)
  } catch {
    throw new Error(`${arquivo.name}: não foi possível abrir a imagem`)
  }
  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height))
  if (escala === 1 && arquivo.size <= 1.5 * 1024 * 1024) {
    bitmap.close()
    return arquivo
  }

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * escala)
  canvas.height = Math.round(bitmap.height * escala)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const gerar = (tipo: string) => new Promise<Blob | null>((ok) => canvas.toBlob(ok, tipo, 0.85))
  // WEBP mantém o fundo transparente; navegador sem WEBP gera JPG.
  const webp = await gerar('image/webp')
  const reduzida = webp?.type === 'image/webp' ? webp : await gerar('image/jpeg')
  if (!reduzida) throw new Error(`${arquivo.name}: não foi possível preparar a imagem`)
  return reduzida
}

type Props = {
  imagens: ImagemProduto[]
  alterar: Dispatch<SetStateAction<ImagemProduto[]>>
  /** Erro vindo do servidor ao salvar. */
  erro?: string
  desabilitado?: boolean
}

/**
 * Galeria do cadastro de produto: "Adicionar imagem" (ou arrastar fotos do computador para cá),
 * a primeira é a capa e a ordem muda arrastando. As setas fazem o mesmo pelo teclado e no celular.
 */
export default function ImagensProduto({ imagens, alterar, erro, desabilitado }: Props) {
  const entrada = useRef<HTMLInputElement>(null)
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [recebendoArquivos, setRecebendoArquivos] = useState(false)
  const [preparando, setPreparando] = useState(false)
  const [avisos, setAvisos] = useState<string[]>([])

  // Endereços temporários (blob:) das imagens novas: liberados quando saem da galeria ou a página fecha.
  const temporarias = useRef(new Set<string>())
  useEffect(() => {
    const atuais = new Set(imagens.filter((i) => i.url.startsWith('blob:')).map((i) => i.url))
    for (const url of temporarias.current) if (!atuais.has(url)) URL.revokeObjectURL(url)
    temporarias.current = atuais
  }, [imagens])
  useEffect(() => () => temporarias.current.forEach((url) => URL.revokeObjectURL(url)), [])

  const vagas = MAXIMO_IMAGENS - imagens.length

  const adicionar = async (arquivos: File[]) => {
    if (desabilitado || arquivos.length === 0) return
    const problemas: string[] = []
    if (arquivos.length > vagas) {
      problemas.push(
        vagas > 0
          ? `Cabem mais ${vagas} ${vagas === 1 ? 'imagem' : 'imagens'} (máximo de ${MAXIMO_IMAGENS}); as outras ficaram de fora.`
          : `Máximo de ${MAXIMO_IMAGENS} imagens por produto.`,
      )
    }
    setPreparando(true)
    const novas: ImagemProduto[] = []
    for (const arquivo of arquivos.slice(0, Math.max(vagas, 0))) {
      try {
        const pronta = await prepararImagem(arquivo)
        novas.push({ chave: novaChave(), arquivo: pronta, url: URL.createObjectURL(pronta) })
      } catch (e) {
        problemas.push((e as Error).message)
      }
    }
    setPreparando(false)
    setAvisos(problemas)
    if (novas.length) alterar((atual) => [...atual, ...novas].slice(0, MAXIMO_IMAGENS))
  }

  const mover = (chave: string, destino: number) =>
    alterar((atual) => {
      const origem = atual.findIndex((i) => i.chave === chave)
      if (origem < 0 || destino < 0 || destino >= atual.length || origem === destino) return atual
      const lista = [...atual]
      const [item] = lista.splice(origem, 1)
      lista.splice(destino, 0, item)
      return lista
    })

  const remover = (chave: string) => alterar((atual) => atual.filter((i) => i.chave !== chave))

  // ---------- Arrastar ----------

  const temArquivos = (e: DragEvent) => e.dataTransfer.types.includes('Files')

  const aoPassarSobreImagem = (e: DragEvent, chave: string) => {
    if (!arrastando) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    // A imagem arrastada já toma o lugar da que está embaixo do mouse (dá para ver a ordem nova antes de soltar).
    if (chave !== arrastando) mover(arrastando, imagens.findIndex((i) => i.chave === chave))
  }

  const aoPassarSobreGaleria = (e: DragEvent) => {
    if (desabilitado || !temArquivos(e)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setRecebendoArquivos(true)
  }

  const aoSoltarNaGaleria = (e: DragEvent) => {
    setRecebendoArquivos(false)
    if (!temArquivos(e)) return
    e.preventDefault()
    void adicionar([...e.dataTransfer.files])
  }

  return (
    <div className="imagens">
      <ul
        className={recebendoArquivos ? 'imagens-grade recebendo' : 'imagens-grade'}
        aria-label="Imagens do produto"
        onDragOver={aoPassarSobreGaleria}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setRecebendoArquivos(false)
        }}
        onDrop={aoSoltarNaGaleria}
      >
        {imagens.map((imagem, i) => {
          const capa = i === 0
          return (
            <li
              key={imagem.chave}
              className={['imagens-item', capa && 'capa', arrastando === imagem.chave && 'arrastando']
                .filter(Boolean)
                .join(' ')}
              draggable={!desabilitado}
              onDragStart={(e) => {
                setArrastando(imagem.chave)
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', imagem.chave) // o Firefox só arrasta com algum dado
              }}
              onDragOver={(e) => aoPassarSobreImagem(e, imagem.chave)}
              onDrop={(e) => arrastando && e.preventDefault()}
              onDragEnd={() => setArrastando(null)}
            >
              <img src={imagem.url} alt={capa ? 'Capa do produto' : `Imagem ${i + 1}`} draggable={false} />
              {capa && <span className="imagens-capa">Capa</span>}
              <div className="imagens-acoes">
                <button
                  type="button"
                  onClick={() => mover(imagem.chave, i - 1)}
                  disabled={desabilitado || i === 0}
                  aria-label={`Mover a imagem ${i + 1} para trás`}
                  title="Mover para trás"
                >
                  <IconeVoltar tamanho={18} />
                </button>
                <button
                  type="button"
                  onClick={() => mover(imagem.chave, i + 1)}
                  disabled={desabilitado || i === imagens.length - 1}
                  aria-label={`Mover a imagem ${i + 1} para frente`}
                  title="Mover para frente"
                >
                  <IconeSeta tamanho={18} />
                </button>
                <button
                  type="button"
                  className="remover"
                  onClick={() => remover(imagem.chave)}
                  disabled={desabilitado}
                  aria-label={`Remover a imagem ${i + 1}`}
                  title="Remover"
                >
                  <IconeLixeira tamanho={18} />
                </button>
              </div>
            </li>
          )
        })}

        {vagas > 0 && (
          <li className="imagens-item adicionar">
            <button type="button" onClick={() => entrada.current?.click()} disabled={desabilitado || preparando}>
              <IconeMais tamanho={34} />
              <span className="imagens-adicionar-titulo">{preparando ? 'Preparando...' : 'Adicionar imagem'}</span>
              <span className="imagens-adicionar-dica">ou arraste as fotos para cá</span>
            </button>
          </li>
        )}
      </ul>

      <input
        ref={entrada}
        id="produto-imagens"
        type="file"
        accept={TIPOS_ACEITOS.join(',')}
        multiple
        hidden
        onChange={(e) => {
          void adicionar([...(e.target.files ?? [])])
          e.target.value = '' // permite escolher a mesma foto de novo
        }}
      />

      <p className="imagens-rodape">
        {imagens.length} de {MAXIMO_IMAGENS} · JPG, PNG, WEBP ou GIF
      </p>
      {(erro || avisos.length > 0) && (
        <ul className="imagens-erros" role="alert">
          {erro && <li>{erro}</li>}
          {avisos.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
