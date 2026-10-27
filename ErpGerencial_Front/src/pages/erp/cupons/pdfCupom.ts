import { toJpeg } from 'html-to-image'

/** Largura do papel do cupom no PDF (bobina de 80 mm). */
const LARGURA_MM = 80

export type PdfCupom = { arquivo: Blob; base64: string }

/**
 * PDF do cupom igual ao impresso: fotografa o cupom já montado na tela (em alta resolução) e põe a imagem numa
 * página de 80 mm de largura, com a altura do cupom.
 */
export async function gerarPdfCupom(elemento: HTMLElement): Promise<PdfCupom> {
  // skipFonts: o cupom usa Arial (do computador); não precisa baixar as fontes do site
  const imagem = await toJpeg(elemento, { pixelRatio: 3, quality: 0.92, backgroundColor: '#ffffff', skipFonts: true })
  const { largura, altura } = await medir(imagem)
  const jpeg = base64ParaBytes(imagem.slice(imagem.indexOf(',') + 1))
  const bytes = pdfComImagem(jpeg, largura, altura)
  return { arquivo: new Blob([bytes], { type: 'application/pdf' }), base64: bytesParaBase64(bytes) }
}

/** Baixa o arquivo com o nome dado (ex.: "cupom-000012.pdf"). */
export function baixarArquivo(arquivo: Blob, nome: string) {
  const url = URL.createObjectURL(arquivo)
  const link = document.createElement('a')
  link.href = url
  link.download = nome
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

function medir(src: string) {
  return new Promise<{ largura: number; altura: number }>((resolver, falhar) => {
    const img = new Image()
    img.onload = () => resolver({ largura: img.naturalWidth, altura: img.naturalHeight })
    img.onerror = () => falhar(new Error('Não foi possível montar a imagem do cupom'))
    img.src = src
  })
}

/** PDF de uma página só, com a imagem JPEG ocupando a página inteira. */
function pdfComImagem(jpeg: Uint8Array, larguraPx: number, alturaPx: number): Uint8Array<ArrayBuffer> {
  const largura = (LARGURA_MM * 72) / 25.4
  const altura = (largura * alturaPx) / larguraPx
  const n = (v: number) => v.toFixed(2)
  const desenho = `q ${n(largura)} 0 0 ${n(altura)} 0 0 cm /Im0 Do Q`

  const partes: Uint8Array[] = []
  const posicoes: number[] = []
  let tamanho = 0
  const codificador = new TextEncoder()
  const escrever = (dado: string | Uint8Array) => {
    const bytes = typeof dado === 'string' ? codificador.encode(dado) : dado
    partes.push(bytes)
    tamanho += bytes.length
  }
  const objeto = (numero: number, conteudo: string) => {
    posicoes[numero] = tamanho
    escrever(`${numero} 0 obj\n${conteudo}\nendobj\n`)
  }

  escrever('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')
  objeto(1, '<< /Type /Catalog /Pages 2 0 R >>')
  objeto(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>')
  objeto(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n(largura)} ${n(altura)}] ` +
      '/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>',
  )
  posicoes[4] = tamanho
  escrever(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${larguraPx} /Height ${alturaPx} /ColorSpace /DeviceRGB ` +
      `/BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
  )
  escrever(jpeg)
  escrever('\nendstream\nendobj\n')
  objeto(5, `<< /Length ${desenho.length} >>\nstream\n${desenho}\nendstream`)

  const inicioXref = tamanho
  escrever(`xref\n0 6\n0000000000 65535 f \n`)
  for (let i = 1; i <= 5; i++) escrever(`${String(posicoes[i]).padStart(10, '0')} 00000 n \n`)
  escrever(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`)

  const pdf = new Uint8Array(tamanho)
  let pos = 0
  for (const parte of partes) {
    pdf.set(parte, pos)
    pos += parte.length
  }
  return pdf
}

function base64ParaBytes(base64: string) {
  const texto = atob(base64)
  const bytes = new Uint8Array(texto.length)
  for (let i = 0; i < texto.length; i++) bytes[i] = texto.charCodeAt(i)
  return bytes
}

function bytesParaBase64(bytes: Uint8Array) {
  let texto = ''
  for (let i = 0; i < bytes.length; i += 0x8000) texto += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(texto)
}
