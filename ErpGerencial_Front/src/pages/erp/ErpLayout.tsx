import { useEffect, useState } from 'react'
import { Link, Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { IconeSair } from '../../components/icones/Icones'
import { useSessaoExpirada } from '../../hooks/useSessaoExpirada'
import { lerSessao, sair, salvarSessao, sessaoAtual, type Sessao } from '../../services/api'
import type { ContextoErp } from './contexto'
import { caminhoDo, podeAcessar, PREFERENCIAS } from './modulos'
import './erp.css'

/*
  Estrutura do ERP (depois do login):
  - header: logo Órion (volta ao início), a empresa, quem está usando,
    Dados da empresa, Usuários (administrador) e Sair;
  - conteúdo: a tela inicial com os botões grandes ou a página do módulo aberto.
*/
export default function ErpLayout() {
  const navigate = useNavigate()
  const sessaoExpirada = useSessaoExpirada()
  const [sessao, setSessao] = useState(lerSessao)

  const atualizarSessao = (nova: Sessao) => {
    salvarSessao(nova)
    setSessao(nova)
  }

  // Atualiza permissões e empresa com o servidor (o administrador pode ter mudado algo).
  useEffect(() => {
    if (!sessao) return
    let ativo = true
    sessaoAtual(sessao.token)
      .then((atual) => {
        if (!ativo) return
        salvarSessao(atual)
        setSessao(atual)
      })
      // Sem conexão: continua com os dados guardados; sessão vencida ou desativada: volta ao login.
      .catch((erro) => ativo && sessaoExpirada(erro))
    return () => {
      ativo = false
    }
    // Só ao abrir o ERP (e a cada novo login); sessaoExpirada muda a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessao?.token])

  if (!sessao) return <Navigate to="/login" replace />

  const { empresa } = sessao
  const contexto: ContextoErp = { sessao, atualizarSessao }

  const sairDaConta = () => {
    sair()
    navigate('/', { replace: true })
  }

  return (
    <div className="erp">
      <header className="erp-header">
        <Link to="/app" className="erp-logo-link" aria-label="Órion — início">
          <img src="/imgs/logo-orion-escuro.png" alt="Órion" className="erp-logo" />
        </Link>

        <div className="erp-header-conta">
          <div className="erp-conta-textos">
            <span className="erp-empresa-nome">{empresa.nome}</span>
            <span className="erp-usuario-nome">{sessao.usuario.nome}</span>
          </div>

          <nav className="erp-header-botoes" aria-label="Preferências">
            {PREFERENCIAS.filter((m) => podeAcessar(sessao.usuario, m)).map((m) => (
              <NavLink
                key={m.id}
                to={caminhoDo(m)}
                aria-label={m.rotulo}
                title={m.rotulo}
                className={({ isActive }) => (isActive ? 'erp-header-botao ativo' : 'erp-header-botao')}
              >
                <m.Icone tamanho={20} />
                <span className="erp-header-botao-texto">{m.rotuloBotao ?? m.rotulo}</span>
              </NavLink>
            ))}
            <button type="button" className="erp-header-botao" onClick={sairDaConta} aria-label="Sair">
              <IconeSair tamanho={20} />
              <span className="erp-header-botao-texto">Sair</span>
            </button>
          </nav>
        </div>
      </header>

      <main className="erp-conteudo">
        <Outlet context={contexto} />
      </main>
    </div>
  )
}
