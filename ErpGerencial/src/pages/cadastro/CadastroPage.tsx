import { Link } from 'react-router-dom'
import { IconeVoltar } from '../../components/icones/Icones'
import '../../styles/acesso.css'

// Tela provisória: o formulário de cadastro será construído na próxima etapa.
export default function CadastroPage() {
  return (
    <div className="acesso-pagina">
      <main className="acesso-cartao estreito">
        <h1 className="acesso-titulo">Crie sua conta</h1>
        <p className="acesso-texto">Esta tela está em construção.</p>

        <div className="acesso-rodape-form">
          <Link to="/" className="ghost-button botao-voltar">
            <IconeVoltar tamanho={20} />
            Voltar ao início
          </Link>
        </div>
      </main>
    </div>
  )
}
