import { useEffect, useState, type SubmitEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import CampoArea from '../../../components/formulario/CampoArea'
import CampoTexto from '../../../components/formulario/CampoTexto'
import type { Aviso } from '../../../components/formulario/FaixaAviso'
import { IconeCheck, IconeVoltar } from '../../../components/icones/Icones'
import { IlustracaoProdutos } from '../../../components/icones/Ilustracoes'
import { useSessaoExpirada } from '../../../hooks/useSessaoExpirada'
import {
  criarProduto,
  editarProduto,
  ErroApi,
  mensagemDe,
  obterProduto,
  type DadosProduto,
  type Produto,
} from '../../../services/api'
import {
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
import '../../../styles/acesso.css'
import './produtos.css'

type Campo =
  | 'nome'
  | 'codigo'
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

const paraFormulario = (p: Produto): Valores => ({
  nome: p.nome,
  codigo: p.codigo ?? '',
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

  const permitido = tem(sessao.usuario, novo ? 'produtos-cadastrar' : 'produtos-editar')

  useEffect(() => {
    if (novo || !permitido) return
    let ativo = true
    obterProduto(sessao.token, id!)
      .then((p) => {
        if (!ativo) return
        setOriginal(p)
        setValores(paraFormulario(p))
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

  const erros: Partial<Record<Campo, string>> = {
    ...erroServidor,
    ...(enviado && !valores.nome.trim() ? { nome: 'Obrigatório' } : {}),
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

  const salvar = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (salvando) return
    setEnviado(true)
    if (!valores.nome.trim()) {
      document.getElementById('produto-nome')?.focus()
      return
    }
    setSalvando(true)
    setAviso(null)
    try {
      if (novo) {
        const criado = await criarProduto(sessao.token, paraApi(valores))
        navigate('/app/produtos', {
          state: { aviso: { tipo: 'ok', texto: `Produto cadastrado (ID ${criado.numero}).` } },
        })
      } else {
        await editarProduto(sessao.token, id!, paraApi(valores))
        navigate(`/app/produtos/${id}`, { state: { aviso: { tipo: 'ok', texto: 'Produto atualizado.' } } })
      }
    } catch (erro) {
      if (sessaoExpirada(erro)) return
      if (erro instanceof ErroApi && erro.campo) {
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
    <div className="erp-pagina erp-pagina-estreita">
      <Link to={voltar} className="erp-voltar">
        <IconeVoltar tamanho={18} />
        {novo ? 'Produtos' : original!.nome}
      </Link>
      <header className="erp-pagina-cabecalho com-icone tema-produtos">
        <span className="erp-pagina-ilustracao" aria-hidden="true">
          <IlustracaoProdutos tamanho={60} />
        </span>
        <div className="erp-pagina-cabecalho-textos">
          <h1 className="erp-pagina-titulo">{novo ? 'Cadastrar produto' : 'Editar produto'}</h1>
          <p className="erp-pagina-subtitulo">
            {novo ? 'O ID é gerado automaticamente.' : `ID ${original!.numero}`}
          </p>
        </div>
      </header>

      <form className="produto-form" onSubmit={salvar} noValidate>
        <section className="produto-grupo" aria-labelledby="g-identificacao">
          <h2 id="g-identificacao" className="produto-grupo-titulo">Identificação</h2>
          <div className="erp-form">
            <CampoTexto {...campo('nome')} rotulo="Nome" maxLength={200} className="largo" autoComplete="off" />
            <CampoTexto {...campo('codigo')} rotulo="Código do produto" maxLength={60} autoComplete="off" />
          </div>
        </section>

        <section className="produto-grupo" aria-labelledby="g-precos">
          <h2 id="g-precos" className="produto-grupo-titulo">Preços</h2>
          <div className="erp-form produto-tres">
            <CampoTexto {...campo('precoCusto')} rotulo="Custo" inputMode="numeric" placeholder="R$ 0,00" />
            <CampoTexto {...campo('precoVendaPf')} rotulo="Venda pessoa física" inputMode="numeric" placeholder="R$ 0,00" />
            <CampoTexto {...campo('precoVendaPj')} rotulo="Venda pessoa jurídica" inputMode="numeric" placeholder="R$ 0,00" />
          </div>
        </section>

        <section className="produto-grupo" aria-labelledby="g-estoque">
          <h2 id="g-estoque" className="produto-grupo-titulo">Estoque</h2>
          <div className="erp-form">
            <CampoTexto {...campo('quantidade')} rotulo="Quantidade" inputMode="decimal" placeholder="0" />
          </div>
        </section>

        <section className="produto-grupo" aria-labelledby="g-caracteristicas">
          <h2 id="g-caracteristicas" className="produto-grupo-titulo">Características</h2>
          <div className="erp-form">
            <CampoTexto {...campo('marca')} rotulo="Marca" maxLength={80} autoComplete="off" />
            <CampoTexto {...campo('modelo')} rotulo="Modelo" maxLength={80} autoComplete="off" />
            <CampoTexto {...campo('cor')} rotulo="Cor" maxLength={50} autoComplete="off" />
            <CampoTexto {...campo('voltagem')} rotulo="Voltagem" maxLength={30} lista="voltagens" autoComplete="off" />
            <datalist id="voltagens">
              {VOLTAGENS.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
          </div>
        </section>

        <section className="produto-grupo" aria-labelledby="g-observacao">
          <h2 id="g-observacao" className="produto-grupo-titulo">Observação</h2>
          <CampoArea {...campo('observacao')} rotulo="Observação" maxLength={2000} />
        </section>

        <div className="erp-form-acoes">
          <button type="submit" className="erp-cadastro-acao tema-produtos" disabled={salvando}>
            <IconeCheck tamanho={20} />
            {salvando ? 'Salvando...' : novo ? 'Cadastrar produto' : 'Salvar'}
          </button>
          <Link to={voltar} className="ghost-button erp-botao">
            Cancelar
          </Link>
          {aviso && <AvisoPagina aviso={aviso} />}
        </div>
      </form>
    </div>
  )
}
