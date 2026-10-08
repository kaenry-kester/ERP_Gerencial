import type { ComponentType } from 'react'
import { IconeCaixa, IconeCarteira, IconeClientes, IconeCracha, IconeLoja, IconeUsuario } from '../../components/icones/Icones'
import {
  IlustracaoClientes,
  IlustracaoConta,
  IlustracaoEmpresa,
  IlustracaoFinanceiro,
  IlustracaoProdutos,
  IlustracaoUsuarios,
} from '../../components/icones/Ilustracoes'
import type { Usuario } from '../../services/api'

/**
 * Quem acessa o módulo:
 * - todos: qualquer usuário da empresa (Dados da empresa);
 * - permissao: administrador ou quem recebeu a permissão (ids iguais aos de Auth/Permissoes.cs);
 * - admin: só o administrador.
 */
export type Acesso = 'todos' | 'permissao' | 'admin'

type Desenho = ComponentType<{ tamanho?: number }>

export type Modulo = {
  /** Trecho da URL: /app/<id>. */
  id: string
  rotulo: string
  /** Frase curta embaixo do nome, no botão grande da tela inicial. */
  resumo: string
  descricao: string
  /** Ícone de linha (botões pequenos). */
  Icone: Desenho
  /** Ilustração colorida (botões grandes da tela inicial e título da página). */
  Ilustracao?: Desenho
  /** Texto curto do botão no topo (Preferências). */
  rotuloBotao?: string
  /** Botão de cadastro mostrado logo acima do botão grande, na tela inicial (para quem tem a permissão). */
  cadastro?: { rotulo: string; para: string; permissao: string }
  acesso: Acesso
}

/** Os botões grandes da tela inicial, na ordem em que aparecem. */
export const MODULOS_PRINCIPAIS: Modulo[] = [
  {
    id: 'produtos',
    rotulo: 'Produtos',
    resumo: 'Cadastro, preços e estoque',
    descricao: 'Catálogo, preços e estoque.',
    Icone: IconeCaixa,
    Ilustracao: IlustracaoProdutos,
    cadastro: { rotulo: 'Cadastrar produto', para: '/app/produtos/novo', permissao: 'produtos-cadastrar' },
    acesso: 'permissao',
  },
  {
    id: 'clientes',
    rotulo: 'Clientes',
    resumo: 'Cadastro e histórico de compras',
    descricao: 'Cadastro e histórico de compras.',
    Icone: IconeClientes,
    Ilustracao: IlustracaoClientes,
    cadastro: { rotulo: 'Cadastrar cliente', para: '/app/clientes/novo', permissao: 'clientes-cadastrar' },
    acesso: 'permissao',
  },
  {
    id: 'financeiro',
    rotulo: 'Financeiro',
    resumo: 'Contas a pagar, a receber e caixa',
    descricao: 'Contas a pagar, a receber e caixa.',
    Icone: IconeCarteira,
    Ilustracao: IlustracaoFinanceiro,
    acesso: 'permissao',
  },
]

/** Preferências (botões do topo): a conta da pessoa, a empresa e quem acessa o sistema. */
export const PREFERENCIAS: Modulo[] = [
  {
    id: 'conta',
    rotulo: 'Minha conta',
    rotuloBotao: 'Minha conta',
    resumo: 'Seus dados, e-mail e senha',
    descricao: 'Dados pessoais e segurança.',
    Icone: IconeUsuario,
    Ilustracao: IlustracaoConta,
    acesso: 'todos',
  },
  {
    id: 'empresa',
    rotulo: 'Dados da empresa',
    resumo: 'Nome, CNPJ e contatos',
    descricao: 'Informações cadastrais.',
    rotuloBotao: 'Empresa',
    Icone: IconeLoja,
    Ilustracao: IlustracaoEmpresa,
    acesso: 'todos',
  },
  {
    id: 'usuarios',
    rotulo: 'Usuários e permissões',
    resumo: 'Quem acessa o sistema',
    descricao: 'Acessos da equipe.',
    rotuloBotao: 'Usuários',
    Icone: IconeCracha,
    Ilustracao: IlustracaoUsuarios,
    acesso: 'admin',
  },
]

export const MODULOS: Modulo[] = [...MODULOS_PRINCIPAIS, ...PREFERENCIAS]

export const caminhoDo = (modulo: Pick<Modulo, 'id'>) => `/app/${modulo.id}`

/** O usuário pode abrir o módulo? (o servidor confere de novo em cada rota) */
export function podeAcessar(usuario: Usuario, modulo: Modulo) {
  if (modulo.acesso === 'todos' || usuario.administrador) return true
  if (modulo.acesso === 'admin') return false
  return usuario.permissoes.includes(modulo.id)
}

/** Tem a permissão? (administrador tem todas; o servidor confere de novo em cada rota) */
export const tem = (usuario: Usuario, permissao: string) =>
  usuario.administrador || usuario.permissoes.includes(permissao)

/**
 * Permissões que o administrador marca em "Usuários e permissões", por módulo
 * (ids iguais aos de Auth/Permissoes.cs). A primeira de cada grupo é "ver"; as outras a incluem.
 */
export const PERMISSOES: { modulo: string; itens: { id: string; rotulo: string; dica?: string }[] }[] = [
  {
    modulo: 'produtos',
    itens: [
      { id: 'produtos', rotulo: 'Ver produtos' },
      { id: 'produtos-cadastrar', rotulo: 'Cadastrar produto' },
      { id: 'produtos-editar', rotulo: 'Editar produtos', dica: 'Sem marcar, só visualiza a lista.' },
    ],
  },
  {
    modulo: 'clientes',
    itens: [
      { id: 'clientes', rotulo: 'Ver clientes' },
      { id: 'clientes-cadastrar', rotulo: 'Cadastrar cliente' },
    ],
  },
  { modulo: 'financeiro', itens: [{ id: 'financeiro', rotulo: 'Ver financeiro' }] },
]
