import { useEffect, useState } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { IconeChevron, IconeFechar, IconeMenu, IconeSair } from '../../components/icones/Icones'
import { useSessaoExpirada } from '../../hooks/useSessaoExpirada'
import {
  lerSessao,
  lerSessaoLoja,
  lojaAtual,
  sairDaLoja,
  salvarSessaoLoja,
  type LojaDetalhe,
} from '../../services/api'
import type { ContextoLoja } from './contexto'
import { caminhoDo, ESSENCIAIS, GRUPOS, PAINEL, type GrupoModulos, type Modulo } from './modulos'
import './loja.css'

/*
  Estrutura de dentro da loja (depois do login com CNPJ e senha):
  - header: só o logo Órion;
  - aside: todos os módulos do ERP, por grupo;
  - nav-bar: atalhos do dia a dia, o nome da loja e "Sair";
  - conteúdo: a página do módulo aberto (Outlet).
*/
export default function LojaLayout() {
  const navigate = useNavigate()
  const sessaoExpirada = useSessaoExpirada('loja')
  const [sessao] = useState(lerSessaoLoja)
  const [loja, setLoja] = useState<LojaDetalhe | null>(sessao?.loja ?? null)
  const [menuAberto, setMenuAberto] = useState(false)
  const { pathname } = useLocation()
  // Grupos do menu abertos pela pessoa; o grupo do módulo aberto fica sempre aberto.
  const [gruposAbertos, setGruposAbertos] = useState<string[]>([])

  // Confere o acesso no servidor e atualiza os dados guardados.
  useEffect(() => {
    if (!sessao) return
    let ativo = true
    lojaAtual(sessao.token)
      .then((atual) => {
        if (!ativo) return
        setLoja(atual)
        salvarSessaoLoja({ token: sessao.token, loja: atual })
      })
      .catch((erro) => {
        // Sem conexão: continua com os dados guardados; sessão vencida: volta ao login da loja.
        if (ativo) sessaoExpirada(erro, sessao.loja.cnpj)
      })
    return () => {
      ativo = false
    }
    // sessaoExpirada muda a cada render; a verificação só precisa rodar uma vez por sessão.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessao])

  // Esc fecha o menu no celular
  useEffect(() => {
    if (!menuAberto) return
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && setMenuAberto(false)
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [menuAberto])

  if (!sessao || !loja) return <Navigate to="/loja/entrar" replace />

  const fecharMenu = () => setMenuAberto(false)

  const sair = () => {
    sairDaLoja()
    // Quem tem conta volta para a lista de lojas; quem entrou só com o CNPJ, para o login da loja.
    navigate(lerSessao() ? '/lojas' : '/loja/entrar', { replace: true })
  }

  const contexto: ContextoLoja = { loja }

  const grupoAtivo = (grupo: GrupoModulos) => grupo.modulos.some((m) => pathname === caminhoDo(m))
  const grupoAberto = (grupo: GrupoModulos) => grupoAtivo(grupo) || gruposAbertos.includes(grupo.titulo)
  const alternarGrupo = (grupo: GrupoModulos) =>
    setGruposAbertos((atual) =>
      grupoAberto(grupo) ? atual.filter((t) => t !== grupo.titulo) : [...atual, grupo.titulo],
    )

  const linkDoMenu = (modulo: Modulo) => (
    <NavLink
      to={caminhoDo(modulo)}
      end
      onClick={fecharMenu}
      className={({ isActive }) => (isActive ? 'erp-aside-link ativo' : 'erp-aside-link')}
    >
      <modulo.Icone tamanho={20} />
      <span>{modulo.rotulo}</span>
    </NavLink>
  )

  return (
    <div className="erp">
      <header className="erp-header">
        <Link to="/loja" className="erp-logo-link" aria-label="Órion — painel da loja">
          <img src="/imgs/logo-orion-escuro.png" alt="Órion" className="erp-logo" />
        </Link>
      </header>

      <aside
        id="erp-menu"
        className={menuAberto ? 'erp-aside aberto' : 'erp-aside'}
        aria-label="Módulos do sistema"
      >
        {/* Só no celular, onde o menu abre por cima da tela */}
        <div className="erp-aside-topo">
          <span className="erp-aside-topo-titulo">Menu</span>
          <button type="button" className="erp-icone-botao" onClick={fecharMenu} aria-label="Fechar menu">
            <IconeFechar tamanho={22} />
          </button>
        </div>

        <nav className="erp-aside-nav">
          {linkDoMenu(PAINEL)}

          {GRUPOS.map((grupo) => {
            const aberto = grupoAberto(grupo)
            const idLista = 'grupo-' + grupo.titulo.toLowerCase()
            return (
              <div key={grupo.titulo} className={aberto ? 'erp-grupo aberto' : 'erp-grupo'}>
                <button
                  type="button"
                  className={grupoAtivo(grupo) ? 'erp-grupo-botao ativo' : 'erp-grupo-botao'}
                  onClick={() => alternarGrupo(grupo)}
                  aria-expanded={aberto}
                  aria-controls={idLista}
                >
                  <span>{grupo.titulo}</span>
                  <span className="erp-grupo-qtd">{grupo.modulos.length}</span>
                  <IconeChevron tamanho={18} />
                </button>
                <ul id={idLista} hidden={!aberto}>
                  {grupo.modulos.map((modulo) => (
                    <li key={modulo.id}>{linkDoMenu(modulo)}</li>
                  ))}
                </ul>
              </div>
            )
          })}
        </nav>
      </aside>

      {menuAberto && <div className="erp-fundo" onClick={fecharMenu} aria-hidden="true" />}

      <div className="erp-principal">
        <nav className="erp-navbar" aria-label="Atalhos">
          <button
            type="button"
            className="erp-icone-botao erp-menu-botao"
            onClick={() => setMenuAberto(true)}
            aria-expanded={menuAberto}
            aria-controls="erp-menu"
            aria-label="Abrir menu"
          >
            <IconeMenu tamanho={24} />
          </button>

          <ul className="erp-atalhos">
            {ESSENCIAIS.map((modulo) => (
              <li key={modulo.id}>
                <NavLink
                  to={caminhoDo(modulo)}
                  end
                  aria-label={modulo.rotulo}
                  className={({ isActive }) =>
                    [
                      'erp-atalho',
                      modulo.id === 'nova-venda' ? 'destaque' : '',
                      isActive ? 'ativo' : '',
                    ].join(' ').trim()
                  }
                >
                  <modulo.Icone tamanho={20} />
                  <span className="erp-atalho-texto">
                    {modulo.rotuloCurto ? (
                      <>
                        <span className="erp-atalho-longo">{modulo.rotulo}</span>
                        <span className="erp-atalho-curto">{modulo.rotuloCurto}</span>
                      </>
                    ) : (
                      modulo.rotulo
                    )}
                  </span>
                </NavLink>
              </li>
            ))}
          </ul>

          <div className="erp-navbar-loja">
            <span className="erp-loja-nome" title={loja.razaoSocial}>
              {loja.nomeFantasia}
            </span>
            <button type="button" className="ghost-button erp-sair" onClick={sair} aria-label="Sair da loja">
              <IconeSair tamanho={20} />
              <span className="erp-sair-texto">Sair</span>
            </button>
          </div>
        </nav>

        <main className="erp-conteudo">
          <Outlet context={contexto} />
        </main>
      </div>
    </div>
  )
}
