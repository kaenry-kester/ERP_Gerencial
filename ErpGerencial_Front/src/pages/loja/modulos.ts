import type { ComponentType } from 'react'
import {
  IconeCaixa,
  IconeCaminhao,
  IconeCarrinho,
  IconeCarteira,
  IconeClientes,
  IconeCracha,
  IconeDocumento,
  IconeEngrenagem,
  IconeEstoque,
  IconeEtiqueta,
  IconeGrafico,
  IconeInicio,
  IconeLoja,
  IconePagar,
  IconeReceber,
  IconeRecibo,
} from '../../components/icones/Icones'

export type Modulo = {
  /** Trecho da URL: /loja/<id> (o painel inicial é /loja). */
  id: string
  rotulo: string
  /** Versão curta para a barra de navegação em telas estreitas. */
  rotuloCurto?: string
  descricao: string
  Icone: ComponentType<{ tamanho?: number }>
}

export type GrupoModulos = {
  titulo: string
  modulos: Modulo[]
}

/** Primeiro item do menu, fora dos grupos. */
export const PAINEL: Modulo = {
  id: '',
  rotulo: 'Painel',
  descricao: 'Resumo da loja e os primeiros passos.',
  Icone: IconeInicio,
}

/** Tudo o que o ERP terá, na ordem do menu lateral (cada grupo abre e fecha). */
export const GRUPOS: GrupoModulos[] = [
  {
    titulo: 'Vendas',
    modulos: [
      {
        id: 'nova-venda',
        rotulo: 'Nova venda',
        rotuloCurto: 'Vender',
        descricao: 'Frente de caixa: escolha os produtos, o cliente e a forma de pagamento.',
        Icone: IconeCarrinho,
      },
      {
        id: 'vendas',
        rotulo: 'Vendas realizadas',
        descricao: 'Histórico de vendas, com busca por data, cliente e produto.',
        Icone: IconeRecibo,
      },
      {
        id: 'orcamentos',
        rotulo: 'Orçamentos',
        descricao: 'Propostas para clientes que podem virar venda com um clique.',
        Icone: IconeDocumento,
      },
    ],
  },
  {
    titulo: 'Produtos',
    modulos: [
      {
        id: 'produtos',
        rotulo: 'Produtos',
        descricao: 'Cadastro dos produtos: nome, código, preço de custo e de venda.',
        Icone: IconeCaixa,
      },
      {
        id: 'categorias',
        rotulo: 'Categorias',
        descricao: 'Grupos de produtos para organizar o catálogo e os relatórios.',
        Icone: IconeEtiqueta,
      },
      {
        id: 'estoque',
        rotulo: 'Estoque',
        descricao: 'Quantidade de cada produto, entradas, saídas e alerta de estoque baixo.',
        Icone: IconeEstoque,
      },
      {
        id: 'fornecedores',
        rotulo: 'Fornecedores',
        descricao: 'Empresas que vendem para a sua loja, com contatos e compras.',
        Icone: IconeCaminhao,
      },
    ],
  },
  {
    titulo: 'Pessoas',
    modulos: [
      {
        id: 'clientes',
        rotulo: 'Clientes',
        descricao: 'Cadastro dos clientes e o histórico de compras de cada um.',
        Icone: IconeClientes,
      },
      {
        id: 'funcionarios',
        rotulo: 'Funcionários',
        descricao: 'Quem trabalha na loja e o que cada pessoa pode acessar.',
        Icone: IconeCracha,
      },
    ],
  },
  {
    titulo: 'Financeiro',
    modulos: [
      {
        id: 'caixa',
        rotulo: 'Caixa',
        descricao: 'Abertura e fechamento do caixa e o dinheiro que entrou e saiu no dia.',
        Icone: IconeCarteira,
      },
      {
        id: 'contas-a-receber',
        rotulo: 'Contas a receber',
        descricao: 'Vendas a prazo e valores que os clientes ainda vão pagar.',
        Icone: IconeReceber,
      },
      {
        id: 'contas-a-pagar',
        rotulo: 'Contas a pagar',
        descricao: 'Boletos, fornecedores e despesas da loja, com vencimentos.',
        Icone: IconePagar,
      },
    ],
  },
  {
    titulo: 'Análises',
    modulos: [
      {
        id: 'relatorios',
        rotulo: 'Relatórios',
        descricao: 'Vendas por período, produtos mais vendidos e lucro da loja.',
        Icone: IconeGrafico,
      },
    ],
  },
  {
    titulo: 'Loja',
    modulos: [
      {
        id: 'dados-da-loja',
        rotulo: 'Dados da loja',
        descricao: 'Razão social, CNPJ, dono e contatos da loja.',
        Icone: IconeLoja,
      },
      {
        id: 'configuracoes',
        rotulo: 'Configurações',
        descricao: 'Senha da loja, impressão de cupons e preferências do sistema.',
        Icone: IconeEngrenagem,
      },
    ],
  },
]

export const MODULOS: Modulo[] = [PAINEL, ...GRUPOS.flatMap((g) => g.modulos)]

/** Atalhos da barra de navegação (o essencial do dia a dia). */
export const ESSENCIAIS = ['', 'nova-venda', 'produtos', 'estoque', 'clientes'].map(
  (id) => MODULOS.find((m) => m.id === id)!,
)

export const caminhoDo = (modulo: Pick<Modulo, 'id'>) => (modulo.id ? `/loja/${modulo.id}` : '/loja')
