import { Link } from 'react-router-dom'
import { IconeSeta } from '../../components/icones/Icones'
import { IlustracaoCadastro, IlustracaoEntrar } from '../../components/icones/Ilustracoes'
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
              <span className="botao-grande-imagem" aria-hidden="true">
                <IlustracaoEntrar tamanho={84} />
              </span>
              <span className="botao-grande-textos">
                <span className="botao-grande-titulo">Entrar</span>
                <span className="botao-grande-descricao">Já tenho conta</span>
              </span>
              <span className="botao-grande-seta">
                <IconeSeta tamanho={26} />
              </span>
            </Link>

            <Link to="/cadastro" className="botao-grande secundario">
              <span className="botao-grande-imagem" aria-hidden="true">
                <IlustracaoCadastro tamanho={72} />
              </span>
              <span className="botao-grande-textos">
                <span className="botao-grande-titulo">Criar conta</span>
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
