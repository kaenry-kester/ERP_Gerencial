import type { ComponentType } from 'react'
import {
  IconeCaixa,
  IconeCarteira,
  IconeClientes,
  IconeCracha,
  IconeLoja,
  IconeOrcamento,
  IconeOrdemServico,
  IconeRecibo,
  IconeUsuario,
} from '../../components/icones/Icones'
import {
  IlustracaoClientes,
  IlustracaoConta,
  IlustracaoCupomFiscal,
  IlustracaoEmpresa,
  IlustracaoFinanceiro,
  IlustracaoOrcamento,
  IlustracaoOrdemServico,
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
  /** Versão ainda mais curta, para celulares estreitos. */
  rotuloCurto?: string
  /** Botão de cadastro mostrado logo acima do botão grande, na tela inicial (para quem tem a permissão). */
  cadastro?: { rotulo: string; para: string; permissao: string }
  acesso: Acesso
  /** Permissão que libera o módulo, quando não é o próprio id (ex.: Orçamento usa a de cupons). */
  permissao?: string
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
    resumo: 'Cadastro e próximas manutenções',
    descricao: 'Cadastro e manutenções.',
    Icone: IconeClientes,
    Ilustracao: IlustracaoClientes,
    cadastro: { rotulo: 'Cadastrar cliente', para: '/app/clientes/novo', permissao: 'clientes-cadastrar' },
    acesso: 'permissao',
  },
  {
    id: 'financeiro',
    rotulo: 'Financeiro',
    resumo: 'Vendas, faturamento e painel',
    descricao: 'Todas as vendas, com o resumo e o painel.',
    Icone: IconeCarteira,
    Ilustracao: IlustracaoFinanceiro,
    acesso: 'permissao',
  },
  // Cupons e orçamentos: o administrador e o funcionário liberado para emitir cupons
  {
    id: 'cupom-fiscal',
    rotulo: 'Cupons e recibos',
    resumo: 'Emissão e impressão de cupons',
    descricao: 'Cupons de venda e recibos (não fiscais), com impressão.',
    Icone: IconeRecibo,
    Ilustracao: IlustracaoCupomFiscal,
    // Sem atalho acima do bloco: "Emitir cupom" fica na faixa do topo da tela principal
    acesso: 'permissao',
  },
  {
    id: 'orcamento',
    rotulo: 'Orçamento',
    resumo: 'Serviços, preços e datas numa tabela',
    descricao: 'Monte o orçamento e, ao finalizar, gere o cupom.',
    Icone: IconeOrcamento,
    Ilustracao: IlustracaoOrcamento,
    cadastro: { rotulo: 'Novo orçamento', para: '/app/orcamento/novo', permissao: 'cupom-fiscal' },
    acesso: 'permissao',
    permissao: 'cupom-fiscal',
  },
  {
    id: 'ordem-servico',
    rotulo: 'Número de ordem de serviço',
    resumo: 'Histórico completo de cada cliente',
    descricao: 'Tudo o que foi vendido e enviado a cada cliente.',
    Icone: IconeOrdemServico,
    Ilustracao: IlustracaoOrdemServico,
    acesso: 'permissao',
  },
]

/** Preferências (botões do topo): a conta da pessoa, a empresa e quem acessa o sistema. */
export const PREFERENCIAS: Modulo[] = [
  {
    id: 'conta',
    rotulo: 'Minha conta',
    rotuloBotao: 'Minha conta',
    rotuloCurto: 'Conta',
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
    rotuloBotao: 'Equipe',
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
  return usuario.permissoes.includes(modulo.permissao ?? modulo.id)
}

/** Tem a permissão? (administrador tem todas; o servidor confere de novo em cada rota) */
export const tem = (usuario: Usuario, permissao: string) =>
  usuario.administrador || usuario.permissoes.includes(permissao)
