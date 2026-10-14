import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { Aviso } from '../../components/formulario/FaixaAviso'
import { IconeCadastro, IconeSeta } from '../../components/icones/Icones'
import { useSessaoExpirada } from '../../hooks/useSessaoExpirada'
import { listarUsuarios, mensagemDe, type Usuario } from '../../services/api'
import AvisoPagina from './AvisoPagina'
import CabecalhoModulo from './CabecalhoModulo'
import FaixaPagina from './FaixaPagina'
import { useErp } from './contexto'
import { MODULOS } from './modulos'
import SemAcesso from './SemAcesso'

const MODULO = MODULOS.find((m) => m.id === 'usuarios')!

/** Tipo de acesso, como aparece na lista da equipe. */
const resumoAcesso = (u: Usuario) =>
  u.administrador ? 'Administrador · acessa tudo' : 'Funcionário · vê produtos e clientes, cadastra clientes'

const iniciais = (nome: string) =>
  nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')

// Lista dos usuários da empresa (só o administrador vê).
export default function UsuariosPage() {
  const { sessao } = useErp()
  const sessaoExpirada = useSessaoExpirada()
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null)
  const [aviso, setAviso] = useState<Aviso>((useLocation().state as { aviso?: Aviso } | null)?.aviso ?? null)

  const admin = sessao.usuario.administrador

  useEffect(() => {
    if (!admin) return
    let ativo = true
    listarUsuarios(sessao.token)
      .then((lista) => ativo && setUsuarios(lista))
      .catch((erro) => ativo && !sessaoExpirada(erro) && setAviso({ tipo: 'erro', texto: mensagemDe(erro) }))
    return () => {
      ativo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessao.token, admin])

  if (!admin) {
    return (
      <div className="erp-pagina">
        <CabecalhoModulo modulo={MODULO} />
        <SemAcesso />
      </div>
    )
  }

  const novoUsuario = (
    <Link to="/app/usuarios/novo" className="pagina-botao marrom">
      <IconeCadastro tamanho={20} />
      Novo usuário
    </Link>
  )

  return (
    <div className="pagina tema-preferencias">
      <FaixaPagina
        titulo={MODULO.rotulo}
        subtitulo={MODULO.descricao}
        Ilustracao={MODULO.Ilustracao}
        acoes={novoUsuario}
      />

      <div className="pagina-corpo pagina-lista">
        {aviso && <AvisoPagina aviso={aviso} />}
        {!usuarios && !aviso && <p className="erp-carregando">Carregando...</p>}

        {usuarios && (
          <ul className="erp-lista" aria-label="Usuários da empresa">
            {usuarios.map((u) => (
              <li key={u.id}>
                <Link to={`/app/usuarios/${u.id}`} className={u.ativo ? 'erp-linha' : 'erp-linha inativo'}>
                  <span className="erp-avatar" aria-hidden="true">
                    {iniciais(u.nome)}
                  </span>
                  <span className="erp-linha-textos">
                    <span className="erp-linha-titulo">
                      {u.nome}
                      {u.id === sessao.usuario.id && <span className="erp-etiqueta">Você</span>}
                      {!u.ativo && <span className="erp-etiqueta desativado">Desativado</span>}
                    </span>
                    <span className="erp-linha-texto">{u.email}</span>
                  </span>
                  <span className="erp-linha-acesso">{resumoAcesso(u)}</span>
                  <span className="erp-linha-seta">
                    <IconeSeta tamanho={20} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
