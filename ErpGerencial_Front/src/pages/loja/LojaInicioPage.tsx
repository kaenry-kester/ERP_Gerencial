import { Link } from 'react-router-dom'
import { IconeCheck, IconeSeta } from '../../components/icones/Icones'
import { formatarCnpj } from '../../utils/validacao'
import { useLoja } from './contexto'
import { caminhoDo, MODULOS } from './modulos'

// Passos para deixar a loja pronta para vender, na ordem em que fazem sentido.
const PASSOS = [
  { modulo: 'produtos', titulo: 'Cadastre seus produtos', texto: 'Nome, código e preço de cada item.' },
  { modulo: 'estoque', titulo: 'Informe o estoque', texto: 'Quanto você tem de cada produto hoje.' },
  { modulo: 'clientes', titulo: 'Cadastre seus clientes', texto: 'Para vender a prazo e ver o histórico.' },
  { modulo: 'nova-venda', titulo: 'Faça a primeira venda', texto: 'Na frente de caixa, em poucos cliques.' },
].map((passo) => ({ ...passo, ...MODULOS.find((m) => m.id === passo.modulo)! }))

// Painel inicial da loja.
export default function LojaInicioPage() {
  const { loja } = useLoja()

  return (
    <div className="erp-pagina">
      <header className="erp-pagina-cabecalho">
        <h1 className="erp-pagina-titulo">{loja.nomeFantasia}</h1>
        <p className="erp-pagina-subtitulo">
          {loja.razaoSocial} · CNPJ {formatarCnpj(loja.cnpj)}
        </p>
      </header>

      <section aria-labelledby="passos-titulo">
        <h2 id="passos-titulo" className="erp-secao-titulo">
          Primeiros passos
        </h2>
        <ol className="erp-passos">
          <li className="erp-passo feito">
            <span className="erp-passo-icone" aria-hidden="true">
              <IconeCheck tamanho={20} />
            </span>
            <span className="erp-passo-textos">
              <span className="erp-passo-titulo">Loja cadastrada</span>
              <span className="erp-passo-texto">CNPJ, dono e senha de acesso prontos.</span>
            </span>
            <span className="erp-passo-status">Concluído</span>
          </li>

          {PASSOS.map(({ Icone, ...passo }) => (
            <li key={passo.id}>
              <Link to={caminhoDo(passo)} className="erp-passo">
                <span className="erp-passo-icone" aria-hidden="true">
                  <Icone tamanho={22} />
                </span>
                <span className="erp-passo-textos">
                  <span className="erp-passo-titulo">{passo.titulo}</span>
                  <span className="erp-passo-texto">{passo.texto}</span>
                </span>
                <span className="erp-passo-seta">
                  <IconeSeta tamanho={20} />
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
