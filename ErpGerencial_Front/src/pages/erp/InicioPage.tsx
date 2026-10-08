import { Link } from 'react-router-dom'
import ImagemIcone from '../../components/icones/ImagemIcone'
import { IconeMais, IconeSeta } from '../../components/icones/Icones'
import { useErp } from './contexto'
import { caminhoDo, MODULOS_PRINCIPAIS, podeAcessar, tem } from './modulos'

/*
  Tela inicial do ERP: um botão grande para cada módulo, com ilustração, nome, descrição e "Abrir".
  Cada módulo tem a sua cor (Produtos marrom, Clientes azul, Financeiro preto), e o botão de
  cadastro fica logo acima do módulo, na mesma cor — fácil de associar, inclusive para quem tem dislexia.
*/
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

  return (
    <div className="erp-inicio">
      {/* Título para leitores de tela (o nome da empresa já aparece no topo) */}
      <h1 className="sr-only">{empresa.nome}</h1>
      {modulos.length === 0 && (
        <p className="erp-inicio-texto">Nenhum módulo liberado. Fale com o administrador.</p>
      )}

      <nav className="erp-blocos" aria-label="Módulos">
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
                <ImagemIcone
                  src={`/imgs/modulos/${m.id}.png`}
                  reserva={Ilustracao ? <Ilustracao tamanho={160} /> : <m.Icone tamanho={64} />}
                  className="erp-bloco-imagem"
                />
              </span>
              <span className="erp-bloco-corpo">
                <span className="erp-bloco-titulo">{m.rotulo}</span>
                <span className="erp-bloco-texto">{m.resumo}</span>
                <span className="erp-bloco-abrir" aria-hidden="true">
                  Abrir
                  <IconeSeta tamanho={18} />
                </span>
              </span>
            </Link>
          </div>
        ))}
      </nav>
    </div>
  )
}
