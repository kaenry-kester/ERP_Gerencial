import { Link } from 'react-router-dom'
import ImagemIcone from '../../components/icones/ImagemIcone'
import { IconeCadastro, IconeLogin, IconeSeta } from '../../components/icones/Icones'
import './inicio.css'

export default function InicioPage() {
  return (
    <main className="inicio">
      <section className="inicio-painel">
        <img src="/imgs/logo-orion.png" alt="Órion" className="inicio-logo" />
        <h1 className="inicio-slogan">Tenha controle total sobre o que é seu.</h1>
      </section>

      <section className="inicio-acoes" aria-labelledby="acoes-titulo">
        <div className="inicio-acoes-conteudo">
          <header className="inicio-acoes-cabecalho">
            <h2 id="acoes-titulo" className="inicio-chamada">
              Comece agora
            </h2>
            <p className="inicio-apoio">Entre na sua conta ou crie uma nova.</p>
          </header>

          <nav className="inicio-escolhas" aria-label="Acesso ao sistema">
            <Link to="/login" className="botao-grande principal">
              <ImagemIcone
                src="/imgs/login.png"
                reserva={<IconeLogin tamanho={34} />}
                className="botao-grande-imagem"
              />
              <span className="botao-grande-textos">
                <span className="botao-grande-titulo">Login</span>
                <span className="botao-grande-descricao">Já sou cliente</span>
              </span>
              <span className="botao-grande-seta">
                <IconeSeta tamanho={26} />
              </span>
            </Link>

            <Link to="/cadastro" className="botao-grande secundario">
              <ImagemIcone
                src="/imgs/cadastro.png"
                reserva={<IconeCadastro tamanho={28} />}
                className="botao-grande-imagem"
              />
              <span className="botao-grande-textos">
                <span className="botao-grande-titulo">Cadastre-se</span>
                <span className="botao-grande-descricao">Quero organizar meu negócio</span>
              </span>
              <span className="botao-grande-seta">
                <IconeSeta tamanho={22} />
              </span>
            </Link>
          </nav>
        </div>
      </section>
    </main>
  )
}
