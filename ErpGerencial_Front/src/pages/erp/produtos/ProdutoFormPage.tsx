import { useEffect, useState, type SubmitEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { Aviso } from '../../../components/formulario/FaixaAviso'
import { IconeCheck } from '../../../components/icones/Icones'
import { IlustracaoProdutos } from '../../../components/icones/Ilustracoes'
import { useLeitorCodigoBarras, type Leitura } from '../../../hooks/useLeitorCodigoBarras'
import { useSessaoExpirada } from '../../../hooks/useSessaoExpirada'
import {
  criarProduto,
  editarProduto,
  enviarImagemProduto,
  ErroApi,
  excluirImagemProduto,
  mensagemDe,
  obterProduto,
  ordenarImagensProduto,
  urlImagemProduto,
  type DadosProduto,
  type Produto,
} from '../../../services/api'
import {
  erroCodigoBarras,
  formatarMoeda,
  formatarQuantidade,
  mascaraMoeda,
  mascaraQuantidade,
  moedaParaNumero,
  quantidadeParaNumero,
} from '../../../utils/validacao'
import AvisoPagina from '../AvisoPagina'
import { useErp } from '../contexto'
import { tem } from '../modulos'
import SemAcesso from '../SemAcesso'
import FaixaPagina from '../FaixaPagina'
import CampoFicha from '../CampoFicha'
import ImagensProduto, { type ImagemProduto } from './ImagensProduto'
import '../../../styles/acesso.css'

type Campo =
  | 'nome'
  | 'codigo'
  | 'codigoBarras'
  | 'precoCusto'
  | 'precoVendaPf'
  | 'precoVendaPj'
  | 'quantidade'
  | 'marca'
  | 'modelo'
  | 'cor'
  | 'voltagem'
  | 'observacao'
type Valores = Record<Campo, string>

const VAZIO: Valores = {
  nome: '',
  codigo: '',
  codigoBarras: '',
  precoCusto: '',
  precoVendaPf: '',
  precoVendaPj: '',
  quantidade: '',
  marca: '',
  modelo: '',
  cor: '',
  voltagem: '',
  observacao: '',
}

const MASCARAS: Partial<Record<Campo, (v: string) => string>> = {
  precoCusto: mascaraMoeda,
  precoVendaPf: mascaraMoeda,
  precoVendaPj: mascaraMoeda,
  quantidade: mascaraQuantidade,
}

const VOLTAGENS = ['110V', '127V', '220V', 'Bivolt', '12V', '24V', 'Não se aplica']

/** Opções da voltagem: vazio, as comuns e, se o produto já tinha outra (digitada antes), ela também. */
const opcoesVoltagem = (atual: string) => [
  { valor: '', rotulo: '—' },
  ...[...(atual && !VOLTAGENS.includes(atual) ? [atual] : []), ...VOLTAGENS].map((v) => ({ valor: v, rotulo: v })),
]

const paraFormulario = (p: Produto): Valores => ({
  nome: p.nome,
  codigo: p.codigo ?? '',
  codigoBarras: p.codigoBarras ?? '',
  precoCusto: formatarMoeda(p.precoCusto),
  precoVendaPf: formatarMoeda(p.precoVendaPf),
  precoVendaPj: formatarMoeda(p.precoVendaPj),
  quantidade: formatarQuantidade(p.quantidade).replace(/\./g, ''),
  marca: p.marca ?? '',
  modelo: p.modelo ?? '',
  cor: p.cor ?? '',
  voltagem: p.voltagem ?? '',
  observacao: p.observacao ?? '',
})

const paraApi = (v: Valores): DadosProduto => ({
  ...v,
  precoCusto: moedaParaNumero(v.precoCusto),
  precoVendaPf: moedaParaNumero(v.precoVendaPf),
  precoVendaPj: moedaParaNumero(v.precoVendaPj),
  quantidade: quantidadeParaNumero(v.quantidade),
})

/** Cadastro (/app/produtos/novo) e edição (/app/produtos/:id/editar) de produto. */
export default function ProdutoFormPage() {
  const { id } = useParams()
  const novo = !id
  const navigate = useNavigate()
  const { sessao } = useErp()
  const sessaoExpirada = useSessaoExpirada()
  const [original, setOriginal] = useState<Produto | null>(null)
  const [valores, setValores] = useState<Valores>(VAZIO)
  const [enviado, setEnviado] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erroServidor, setErroServidor] = useState<Partial<Record<Campo, string>>>({})
  const [aviso, setAviso] = useState<Aviso>(null)
  const [lido, setLido] = useState(false)
  const [imagens, setImagens] = useState<ImagemProduto[]>([])
  const [erroImagens, setErroImagens] = useState<string>()

  // Leitor de código de barras: em qualquer lugar da página, a leitura vai para o campo "Código de barras".
  useLeitorCodigoBarras('produto-codigoBarras', ({ codigo, idAlvo, valorAntes }: Leitura) => {
    setValores((atual) => {
      const novos = { ...atual, codigoBarras: codigo }
      // Se o cursor estava em outro campo, os números foram digitados nele: volta ao que era antes.
      const outro = idAlvo?.replace(/^produto-/, '') as Campo | undefined
      if (outro && outro !== 'codigoBarras' && outro in atual && valorAntes !== null) novos[outro] = valorAntes
      return novos
    })
    setLido(true)
    setErroServidor({})
    const erro = erroCodigoBarras(codigo)
    setAviso(erro ? { tipo: 'erro', texto: `Código de barras ${codigo}: ${erro.toLowerCase()}` } : { tipo: 'ok', texto: `Código de barras lido: ${codigo}` })
    const campoBarras = document.getElementById('produto-codigoBarras')
    campoBarras?.focus()
    campoBarras?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  })

  const permitido = tem(sessao.usuario, novo ? 'produtos-cadastrar' : 'produtos-editar')

  useEffect(() => {
    if (novo || !permitido) return
    let ativo = true
    obterProduto(sessao.token, id!)
      .then((p) => {
        if (!ativo) return
        setOriginal(p)
        setValores(paraFormulario(p))
        setImagens(p.imagens.map((idImagem) => ({ chave: idImagem, id: idImagem, url: urlImagemProduto(idImagem) })))
      })
      .catch((e) => ativo && !sessaoExpirada(e) && setAviso({ tipo: 'erro', texto: mensagemDe(e) }))
    return () => {
      ativo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, sessao.token, permitido])

  if (!permitido) return <div className="erp-pagina"><SemAcesso /></div>
  if (!novo && !original) {
    return (
      <div className="erp-pagina">
        {aviso ? <AvisoPagina aviso={aviso} /> : <p className="erp-carregando">Carregando...</p>}
      </div>
    )
  }

  const erroBarras = enviado || lido ? erroCodigoBarras(valores.codigoBarras) : undefined
  const erros: Partial<Record<Campo, string>> = {
    ...erroServidor,
    ...(enviado && !valores.nome.trim() ? { nome: 'Obrigatório' } : {}),
    ...(erroBarras ? { codigoBarras: erroBarras } : {}),
  }

  const campo = (c: Campo) => ({
    id: `produto-${c}`,
    valor: valores[c],
    erro: erros[c],
    onChange: (v: string) => {
      setValores((atual) => ({ ...atual, [c]: MASCARAS[c]?.(v) ?? v }))
      setErroServidor({})
      setAviso(null)
    },
  })

  /**
   * Depois de salvar o produto: apaga as imagens que saíram, envia as novas (na ordem da galeria) e,
   * se a ordem do servidor ficou diferente da tela, grava a ordem certa (a primeira é a capa).
   */
  const salvarImagens = async (produtoId: string, noServidor: string[]) => {
    const ficaram = new Set(imagens.flatMap((i) => (i.id ? [i.id] : [])))
    let servidor = [...noServidor]
    try {
      for (const idImagem of noServidor.filter((x) => !ficaram.has(x))) {
        await excluirImagemProduto(sessao.token, produtoId, idImagem).catch((erro) => {
          if (!(erro instanceof ErroApi && erro.status === 404)) throw erro // 404: já tinha saído
        })
        servidor = servidor.filter((x) => x !== idImagem)
      }
      const ids: string[] = []
      for (const imagem of imagens) {
        if (imagem.id) {
          ids.push(imagem.id)
          continue
        }
        const { id: novoId } = await enviarImagemProduto(sessao.token, produtoId, imagem.arquivo!)
        ids.push(novoId)
        servidor.push(novoId)
        // Já marca como enviada: se algo falhar depois, salvar de novo não manda esta outra vez.
        setImagens((atual) => atual.map((i) => (i.chave === imagem.chave ? { ...i, id: novoId } : i)))
      }
      if (ids.join() !== servidor.join()) {
        await ordenarImagensProduto(sessao.token, produtoId, ids)
        servidor = ids
      }
    } finally {
      setOriginal((o) => o && { ...o, imagens: servidor })
    }
  }

  const salvar = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (salvando) return
    setEnviado(true)
    if (!valores.nome.trim()) {
      document.getElementById('produto-nome')?.focus()
      return
    }
    if (erroCodigoBarras(valores.codigoBarras)) {
      document.getElementById('produto-codigoBarras')?.focus()
      return
    }
    setSalvando(true)
    setAviso(null)
    try {
      if (novo) {
        const criado = await criarProduto(sessao.token, paraApi(valores))
        try {
          await salvarImagens(criado.id, [])
        } catch (erro) {
          // O produto já existe: abre a página dele contando o que faltou (as imagens dá para mandar editando).
          if (sessaoExpirada(erro)) return
          navigate(`/app/produtos/${criado.id}`, {
            state: {
              aviso: {
                tipo: 'erro',
                texto: `Produto cadastrado (ID ${criado.numero}), mas nem todas as imagens foram salvas: ${mensagemDe(erro)}`,
              },
            },
          })
          return
        }
        navigate('/app/produtos', {
          state: { aviso: { tipo: 'ok', texto: `Produto cadastrado (ID ${criado.numero}).` } },
        })
      } else {
        await editarProduto(sessao.token, id!, paraApi(valores))
        await salvarImagens(id!, original!.imagens)
        navigate(`/app/produtos/${id}`, { state: { aviso: { tipo: 'ok', texto: 'Produto atualizado.' } } })
      }
    } catch (erro) {
      if (sessaoExpirada(erro)) return
      if (erro instanceof ErroApi && erro.campo === 'imagens') {
        setErroImagens(erro.message)
        document.getElementById('produto-imagens-celula')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      } else if (erro instanceof ErroApi && erro.campo) {
        const c = erro.campo as Campo
        setErroServidor({ [c]: erro.message })
        document.getElementById(`produto-${c}`)?.focus()
      }
      setAviso({ tipo: 'erro', texto: mensagemDe(erro) })
      setSalvando(false)
    }
  }

  const voltar = novo ? '/app/produtos' : `/app/produtos/${id}`

  return (
    <div className="pagina tema-produtos">
      <FaixaPagina
        Ilustracao={IlustracaoProdutos}
        titulo={novo ? 'Cadastrar produto' : 'Editar produto'}
        subtitulo={novo ? undefined : `ID ${original!.numero}`}
        voltar={{ para: voltar, rotulo: novo ? 'Produtos' : original!.nome }}
      />

      {/* Ficha do produto (mesmo visual da ficha do cliente), centralizada e compacta: cabe na tela sem rolar */}
      <form className="ficha-pagina" onSubmit={salvar} noValidate>
        <div className="ficha-area">
          <div className="ficha" role="group" aria-label="Cadastro de produto">
            <CampoFicha {...campo('nome')} rotulo="Nome do produto" obrigatorio maxLength={200} className="c6" />
            <CampoFicha {...campo('codigo')} rotulo="Código do produto" maxLength={60} className="c3" />
            <CampoFicha
              {...campo('codigoBarras')}
              rotulo="Código de barras"
              maxLength={50}
              className="c3"
            />

            <h2 className="ficha-topico">Preços e estoque</h2>
            <CampoFicha {...campo('precoCusto')} rotulo="Custo" inputMode="numeric" placeholder="R$ 0,00" className="c3" />
            <CampoFicha {...campo('precoVendaPf')} rotulo="Venda pessoa física" inputMode="numeric" placeholder="R$ 0,00" className="c3" />
            <CampoFicha {...campo('precoVendaPj')} rotulo="Venda pessoa jurídica" inputMode="numeric" placeholder="R$ 0,00" className="c3" />
            <CampoFicha {...campo('quantidade')} rotulo="Quantidade em estoque" inputMode="decimal" placeholder="0" className="c3" />

            <h2 className="ficha-topico">Características</h2>
            <CampoFicha {...campo('marca')} rotulo="Marca" maxLength={80} className="c3" />
            <CampoFicha {...campo('modelo')} rotulo="Modelo" maxLength={80} className="c3" />
            <CampoFicha {...campo('cor')} rotulo="Cor" maxLength={50} className="c3" />
            <CampoFicha {...campo('voltagem')} rotulo="Voltagem" opcoes={opcoesVoltagem(valores.voltagem)} className="c3" />
            {/* Observação e imagens lado a lado: o cadastro inteiro cabe na tela sem rolar */}
            <CampoFicha {...campo('observacao')} rotulo="Observação" linhas={4} maxLength={2000} className="c5" />
            <div id="produto-imagens-celula" className="ficha-campo ficha-imagens c7">
              <span className="ficha-rotulo">Imagens</span>
              <ImagensProduto
                imagens={imagens}
                alterar={(atualizar) => {
                  setImagens(atualizar)
                  setErroImagens(undefined)
                }}
                erro={erroImagens}
                desabilitado={salvando}
              />
            </div>
          </div>
          <p className="ficha-nota">
            <span aria-hidden="true">*</span> Obrigatório.
          </p>
        </div>

        <div className="pagina-barra">
          <button type="submit" className="pagina-botao" disabled={salvando}>
            <IconeCheck tamanho={20} />
            {salvando ? 'Salvando...' : novo ? 'Cadastrar produto' : 'Salvar alterações'}
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
