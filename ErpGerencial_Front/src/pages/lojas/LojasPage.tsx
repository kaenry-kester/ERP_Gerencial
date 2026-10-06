import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import FaixaAviso, { type Aviso } from '../../components/formulario/FaixaAviso'
import { IconeLoja, IconeSair, IconeSeta } from '../../components/icones/Icones'
import { useSessaoExpirada } from '../../hooks/useSessaoExpirada'
import { lerSessao, listarLojas, mensagemDe, sair, type LojaResumo } from '../../services/api'
import { formatarCnpj } from '../../utils/validacao'
import '../../styles/acesso.css'
import '../../styles/tela-dividida.css'
import './lojas.css'

// "Suas lojas": lista as lojas da conta. Cada loja abre o login da loja (CNPJ e senha).
export default function LojasPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const sessaoExpirada = useSessaoExpirada('conta')
  const [sessao] = useState(lerSessao)
  const [lojas, setLojas] = useState<LojaResumo[] | null>(null)
  const [falhou, setFalhou] = useState(false)
  const [tentativa, setTentativa] = useState(0)
  const [aviso, setAviso] = useState<Aviso>((location.state as { aviso?: Aviso } | null)?.aviso ?? null)

  useEffect(() => {
    if (!sessao) return
    let ativo = true
    listarLojas(sessao.token)
      .then((lista) => {
        if (!ativo) return
        setLojas(lista)
        setFalhou(false)
      })
      .catch((erro) => {
        if (!ativo || sessaoExpirada(erro)) return
        setFalhou(true)
        setAviso({ tipo: 'erro', texto: mensagemDe(erro) })
      })
    return () => {
      ativo = false
    }
    // sessaoExpirada muda a cada render; só a sessão e a nova tentativa devem recarregar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessao, tentativa])

  if (!sessao) return <Navigate to="/login" replace />

  const sairDaConta = () => {
    sair()
    navigate('/', { replace: true })
  }

  const tentarDeNovo = () => {
    setAviso(null)
    setFalhou(false)
    setTentativa((t) => t + 1)
  }

  const semLojas = lojas?.length === 0
  const titulo = semLojas
    ? 'Cadastre sua primeira loja para começar:'
    : 'Escolha a loja que deseja acessar:'

  return (
    <main className="tela-dividida lojas">
      <aside className="tela-painel">
        <Link to="/" className="tela-logo-link" aria-label="Órion — início">
          <img src="/imgs/logo-orion.png" alt="Órion" className="tela-logo" />
        </Link>
        <h1 className="tela-titulo">Suas lojas</h1>
        <p className="tela-texto">Cada loja tem o seu próprio acesso, com CNPJ e senha.</p>

        <div className="painel-conta">
          <div className="painel-conta-textos">
            <p className="painel-conta-nome">{sessao.nome}</p>
            <p className="painel-conta-email">{sessao.email}</p>
          </div>
          <button
            type="button"
            className="ghost-button botao-painel"
            onClick={sairDaConta}
            aria-label="Sair da conta"
          >
            <IconeSair tamanho={20} />
            <span className="botao-painel-texto">Sair da conta</span>
          </button>
        </div>
      </aside>

      <section className="tela-area" aria-labelledby="lojas-titulo" aria-busy={lojas === null && !falhou}>
        <FaixaAviso id="lojas-titulo" titulo={titulo} aviso={aviso} />

        <div className="lojas-conteudo">
          {lojas === null && !falhou && <p className="lojas-carregando">Carregando suas lojas...</p>}

          {falhou && (
            <button type="button" className="primary-button botao-acao" onClick={tentarDeNovo}>
              Tentar de novo
            </button>
          )}

          {lojas && lojas.length > 0 && (
            <ul className="lojas-lista">
              {lojas.map((loja) => (
                <li key={loja.id}>
                  <Link to="/loja/entrar" state={{ cnpj: loja.cnpj }} className="loja-item">
                    <span className="loja-item-icone" aria-hidden="true">
                      <IconeLoja tamanho={26} />
                    </span>
                    <span className="loja-item-textos">
                      <span className="loja-item-nome">{loja.nomeFantasia}</span>
                      <span className="loja-item-detalhe">
                        {loja.razaoSocial} · CNPJ {formatarCnpj(loja.cnpj)}
                      </span>
                    </span>
                    <span className="loja-item-entrar">
                      <span className="loja-item-entrar-texto">Entrar</span>
                      <IconeSeta tamanho={22} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {lojas && (
            <Link to="/lojas/nova" className={semLojas ? 'loja-nova destaque' : 'loja-nova'}>
              <span className="loja-nova-icone" aria-hidden="true">
                <IconeLoja tamanho={semLojas ? 30 : 24} />
              </span>
              <span className="loja-nova-textos">
                <span className="loja-nova-titulo">
                  {semLojas ? 'Cadastrar minha loja' : 'Cadastrar nova loja'}
                </span>
                <span className="loja-nova-descricao">Dados da empresa, do dono e a senha de acesso</span>
              </span>
              <IconeSeta tamanho={semLojas ? 26 : 22} />
            </Link>
          )}
        </div>
      </section>
    </main>
  )
}
