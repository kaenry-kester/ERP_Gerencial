import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { IconeMais } from '../../components/icones/Icones'
import { EMISSOR_GOV } from './cupons/dadosNotaGov'
import { useErp } from './contexto'
import FaixaPagina from './FaixaPagina'
import { LOGO_HORIZONTAL, LOGO_QUADRADA } from './logoLoja'
import AvisoBackup from './AvisoBackup'
import MensagensHoje from './MensagensHoje'
import { caminhoDo, MODULOS, MODULOS_PRINCIPAIS, podeAcessar, tem } from './modulos'

const CUPONS = MODULOS.find((m) => m.id === 'cupom-fiscal')!
const CLIENTES = MODULOS.find((m) => m.id === 'clientes')!

/*
  Tela inicial do ERP: um botão grande para cada módulo, com ilustração e nome, todos numa fileira só.
  Cada módulo tem a sua cor (Produtos azul-marinho, Clientes azul, Financeiro preto), e o botão de
  cadastro fica logo acima do módulo, na mesma cor — fácil de associar, inclusive para quem tem dislexia.
*/
/** Logo quadrada da loja no quadradinho da faixa (um pouco mais larga que o desenho padrão). */
function LogoQuadrada() {
  return <img src={LOGO_QUADRADA} alt="" className="pagina-faixa-logo" />
}

export default function InicioPage() {
  const { sessao } = useErp()
  const { usuario, empresa } = sessao
  // Cada pessoa vê só os módulos liberados para ela.
  const modulos = MODULOS_PRINCIPAIS.filter((m) => podeAcessar(usuario, m)).map((m) => ({
    ...m,
    // O botão de cadastro só aparece para quem pode cadastrar.
    cadastro: m.cadastro && tem(usuario, m.cadastro.permissao) ? m.cadastro : undefined,
  }))
  const algumCadastro = modulos.some((m) => m.cadastro)
  const vende = podeAcessar(usuario, CUPONS)
  const verMensagens = podeAcessar(usuario, CLIENTES)
  // Colunas da grade (blocos e linha de baixo usam a mesma, para ficarem alinhados); no mínimo 3
  const colunas = Math.max(3, modulos.length)

  // Atalhos da venda, no canto direito da faixa: o cupom (feito aqui) e a nota fiscal (direto na emissão do gov.br)
  const acoes = vende && (
    <>
      <Link to="/app/cupom-fiscal/novo" className="pagina-botao claro">
        <span aria-hidden="true">🧾</span>
        Emitir cupom
      </Link>
      <a href={EMISSOR_GOV} target="_blank" rel="noreferrer" className="pagina-botao azul">
        <span aria-hidden="true">🏛️</span>
        Emitir nota fiscal
      </a>
    </>
  )

  return (
    <div className="pagina tema-produtos pagina-inicio">
      {/* Empresa e quem está usando, em destaque numa faixa azul-marinho acima dos botões de cadastro */}
      <FaixaPagina
        Ilustracao={LogoQuadrada}
        titulo={empresa.nome}
        subtitulo={
          <span className="erp-inicio-usuario">
            <strong>{usuario.nome}</strong>
            <span className="erp-inicio-papel">{usuario.administrador ? 'Administrador' : 'Usuário'}</span>
          </span>
        }
        acoes={acoes || undefined}
      />

      <div className="erp-inicio">
        {/* Só aparece se a última cópia de segurança tiver mais de 1 dia */}
        {usuario.administrador && <AvisoBackup />}
        {modulos.length === 0 && (
          <p className="erp-inicio-texto">Nenhum módulo liberado. Fale com o administrador.</p>
        )}

        <nav className="erp-blocos" aria-label="Módulos" style={{ '--colunas': colunas } as CSSProperties}>
          {modulos.map(({ Ilustracao, cadastro, ...m }) => (
            <div key={m.id} className={`erp-modulo tema-${m.id}`}>
              {cadastro ? (
                <Link to={cadastro.para} className="erp-cadastro">
                  <IconeMais tamanho={20} />
                  {cadastro.rotulo}
                </Link>
              ) : (
                algumCadastro && <span className="erp-cadastro-vazio" aria-hidden="true" />
              )}

              <Link to={caminhoDo(m)} className="erp-bloco">
                <span className="erp-bloco-arte">
                  <span className="erp-bloco-imagem" aria-hidden="true">
                    {Ilustracao ? <Ilustracao tamanho={160} /> : <m.Icone tamanho={64} />}
                  </span>
                </span>
                <span className="erp-bloco-corpo">
                  <span className="erp-bloco-titulo">{m.rotulo}</span>
                </span>
              </Link>
            </div>
          ))}
        </nav>

        {/* Linha de baixo, na mesma grade dos blocos: a logo (largura de 2 blocos) e as mensagens de hoje (o resto) */}
        <div className="erp-inicio-rodape" style={{ '--colunas': colunas } as CSSProperties}>
          <div className={verMensagens ? 'erp-inicio-logo' : 'erp-inicio-logo inteira'}>
            <img src={LOGO_HORIZONTAL} alt="FJ Filtros — venda e assistência de purificadores" />
          </div>
          {verMensagens && <MensagensHoje />}
        </div>
      </div>
    </div>
  )
}
