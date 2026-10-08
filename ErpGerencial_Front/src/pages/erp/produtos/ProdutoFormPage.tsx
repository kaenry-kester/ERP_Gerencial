import { useEffect, useState, type SubmitEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import CampoArea from '../../../components/formulario/CampoArea'
import CampoTexto from '../../../components/formulario/CampoTexto'
import type { Aviso } from '../../../components/formulario/FaixaAviso'
import { IconeCheck } from '../../../components/icones/Icones'
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
import FaixaPagina from '../FaixaPagina'
import SecaoPagina from '../SecaoPagina'
import '../../../styles/acesso.css'

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
    <div className="pagina tema-produtos">
      <FaixaPagina
        Ilustracao={IlustracaoProdutos}
        titulo={novo ? 'Cadastrar produto' : 'Editar produto'}
        subtitulo={novo ? 'O ID é gerado automaticamente.' : `ID ${original!.numero}`}
        voltar={{ para: voltar, rotulo: novo ? 'Produtos' : original!.nome }}
      />

      <form className="pagina-secoes" onSubmit={salvar} noValidate>
        <SecaoPagina id="identificacao" numero={1} titulo="Identificação">
          <div className="erp-form">
            <CampoTexto {...campo('nome')} rotulo="Nome" maxLength={200} className="largo" autoComplete="off" />
            <CampoTexto {...campo('codigo')} rotulo="Código do produto" maxLength={60} autoComplete="off" />
          </div>
        </SecaoPagina>

        <SecaoPagina id="precos" numero={2} titulo="Preços">
          <div className="erp-form tres">
            <CampoTexto {...campo('precoCusto')} rotulo="Custo" inputMode="numeric" placeholder="R$ 0,00" />
            <CampoTexto {...campo('precoVendaPf')} rotulo="Venda pessoa física" inputMode="numeric" placeholder="R$ 0,00" />
            <CampoTexto {...campo('precoVendaPj')} rotulo="Venda pessoa jurídica" inputMode="numeric" placeholder="R$ 0,00" />
          </div>
        </SecaoPagina>

        <SecaoPagina id="estoque" numero={3} titulo="Estoque">
          <div className="erp-form">
            <CampoTexto {...campo('quantidade')} rotulo="Quantidade" inputMode="decimal" placeholder="0" />
          </div>
        </SecaoPagina>

        <SecaoPagina id="caracteristicas" numero={4} titulo="Características">
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
        </SecaoPagina>

        <SecaoPagina id="observacao" numero={5} titulo="Observação">
          <CampoArea {...campo('observacao')} rotulo="Observação" maxLength={2000} />
        </SecaoPagina>

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
