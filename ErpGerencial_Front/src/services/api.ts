// Chamadas à API ASP.NET (ErpGerencial_Back/Orion.Api).
// Em desenvolvimento o Vite repassa /api para http://localhost:5193 (ver vite.config.ts).
//
// Como no Bling: a conta da pessoa pertence a uma empresa, e tudo do ERP fica dentro dela.
// O administrador cria os outros usuários da empresa, cada um com login e permissões próprios.

const SESSAO_KEY = 'orion-sessao'
const LEMBRAR_KEY = 'orion-lembrar'

export type Usuario = {
  id: string
  nome: string
  email: string
  administrador: boolean
  /** Ids dos módulos liberados (ver pages/erp/modulos.ts). Administrador acessa tudo. */
  permissoes: string[]
  ativo: boolean
  criadoEm: string
}

export type EmpresaResumo = { id: string; nome: string }

export type Empresa = EmpresaResumo & {
  razaoSocial: string | null
  documento: string | null
  email: string | null
  telefone: string | null
  criadoEm: string
}

/** Sessão salva no navegador. */
export type Sessao = {
  token: string
  usuario: Usuario
  empresa: EmpresaResumo
}

export class ErroApi extends Error {
  status: number
  /** Campo do formulário ligado ao erro (ex.: "email", "documento"), quando a API informa. */
  campo?: string

  constructor(status: number, mensagem: string, campo?: string) {
    super(mensagem)
    this.status = status
    this.campo = campo
  }
}

/** Mensagem de qualquer erro, pronta para a faixa de aviso. */
export const mensagemDe = (erro: unknown) =>
  erro instanceof ErroApi ? erro.message : 'Algo deu errado. Tente de novo.'

async function requisicao<T>(
  metodo: 'GET' | 'POST' | 'PUT' | 'DELETE',
  rota: string,
  { corpo, token, cabecalhos }: { corpo?: unknown; token?: string; cabecalhos?: Record<string, string> } = {},
): Promise<T> {
  const headers: Record<string, string> = { ...cabecalhos }
  if (corpo !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let resposta: Response
  try {
    resposta = await fetch(rota, {
      method: metodo,
      headers,
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    })
  } catch {
    throw new ErroApi(0, 'Sem conexão com o servidor. Tente de novo.')
  }

  if (resposta.status === 204) return undefined as T
  if (resposta.ok) return resposta.json() as Promise<T>

  // O proxy do Vite responde 500/502/504 quando a API está desligada.
  if (resposta.status >= 500) throw new ErroApi(resposta.status, 'Servidor indisponível. Tente de novo.')
  if (resposta.status === 429) throw new ErroApi(429, 'Muitas tentativas. Aguarde um minuto.')
  if (resposta.status === 401) {
    // Com token: a sessão venceu (ou o usuário foi desativado). Sem token: login recusado.
    throw new ErroApi(401, token ? 'Sua sessão expirou. Entre de novo.' : 'Dados de acesso incorretos')
  }

  // 403 e 409 trazem { erro, campo? }; 400 traz { errors: { campo: [mensagem] } }
  const dados = await resposta.json().catch(() => null)
  if (dados?.erro) throw new ErroApi(resposta.status, dados.erro, dados.campo)
  if (resposta.status === 403) throw new ErroApi(403, 'Você não tem permissão para fazer isso.')
  const [campo, mensagens] = (Object.entries(dados?.errors ?? {})[0] ?? []) as [string?, string[]?]
  throw new ErroApi(resposta.status, mensagens?.[0] ?? 'Algo deu errado. Tente de novo.', campo)
}

/** Troca a mensagem genérica de login recusado pela da tela. */
async function login<T>(chamada: Promise<T>, mensagem: string) {
  try {
    return await chamada
  } catch (erro) {
    if (erro instanceof ErroApi && erro.status === 401) throw new ErroApi(401, mensagem)
    throw erro
  }
}

// ---------- Conta ----------

/** Cria a conta da pessoa e a empresa juntas; quem cadastra é o administrador. */
export const cadastrar = (dados: {
  nome: string
  email: string
  telefone: string
  nomeEmpresa: string
  senha: string
}) => requisicao<Sessao>('POST', '/api/auth/cadastro', { corpo: dados })

/** Login em duas etapas: depois da senha, a API envia um código por e-mail (a não ser no navegador lembrado). */
export type Verificacao = {
  desafioId: string
  /** E-mail com parte escondida, ex.: "an•••@gmail.com" */
  email: string
  expiraEm: string
  reenviarEmSegundos: number
}

/** Resposta da 1ª etapa: a sessão (navegador lembrado) ou o pedido do código. */
export type RespostaLogin = Sessao | Verificacao

export const precisaDeCodigo = (r: RespostaLogin): r is Verificacao => 'desafioId' in r

export const entrar = (dados: { email: string; senha: string }) =>
  login(
    requisicao<RespostaLogin>('POST', '/api/auth/login', {
      // Token do "Lembrar de quem sou": neste navegador, o código não é pedido.
      corpo: { ...dados, dispositivo: lerLembrado()?.token ?? null },
    }),
    'E-mail ou senha incorretos',
  )

/** 2ª etapa: o código do e-mail. Com "lembrar", a resposta traz o token deste navegador. */
export const verificarCodigo = (dados: { desafioId: string; codigo: string; lembrar: boolean }) =>
  requisicao<Sessao & { dispositivo: string | null }>('POST', '/api/auth/login/verificar', { corpo: dados })

export const reenviarCodigo = (desafioId: string) =>
  requisicao<Verificacao>('POST', '/api/auth/login/reenviar', { corpo: { desafioId } })

/** Sessão atualizada (permissões, empresa e status podem ter mudado). */
export const sessaoAtual = (token: string) => requisicao<Sessao>('GET', '/api/auth/eu', { token })

// ---------- Empresa ----------

export const obterEmpresa = (token: string) => requisicao<Empresa>('GET', '/api/empresa', { token })

export type DadosEmpresa = {
  nome: string
  razaoSocial: string
  documento: string
  email: string
  telefone: string
}

export const editarEmpresa = (token: string, dados: DadosEmpresa) =>
  requisicao<Empresa>('PUT', '/api/empresa', { corpo: dados, token })

// ---------- Usuários e permissões (só administrador) ----------

export const listarUsuarios = (token: string) => requisicao<Usuario[]>('GET', '/api/usuarios', { token })

export const criarUsuario = (
  token: string,
  dados: { nome: string; email: string; senha: string; administrador: boolean; permissoes: string[] },
) => requisicao<Usuario>('POST', '/api/usuarios', { corpo: dados, token })

export const editarUsuario = (
  token: string,
  id: string,
  dados: { nome: string; administrador: boolean; permissoes: string[]; ativo: boolean },
) => requisicao<Usuario>('PUT', `/api/usuarios/${id}`, { corpo: dados, token })

// ---------- Produtos ----------

export type Produto = {
  id: string
  /** ID mostrado na tela (1, 2, 3...), gerado automaticamente. */
  numero: number
  nome: string
  codigo: string | null
  precoCusto: number
  precoVendaPf: number
  precoVendaPj: number
  quantidade: number
  marca: string | null
  modelo: string | null
  cor: string | null
  voltagem: string | null
  observacao: string | null
  criadoEm: string
  atualizadoEm: string
}

export type DadosProduto = {
  nome: string
  codigo: string
  precoCusto: number | null
  precoVendaPf: number | null
  precoVendaPj: number | null
  quantidade: number | null
  marca: string
  modelo: string
  cor: string
  voltagem: string
  observacao: string
}

export type ListaProdutos = { itens: Produto[]; total: number; pagina: number; tamanhoPagina: number }

export const listarProdutos = (token: string, busca = '', pagina = 1) =>
  requisicao<ListaProdutos>(
    'GET',
    `/api/produtos?pagina=${pagina}${busca.trim() ? `&busca=${encodeURIComponent(busca.trim())}` : ''}`,
    { token },
  )

export const obterProduto = (token: string, id: string) => requisicao<Produto>('GET', `/api/produtos/${id}`, { token })

export const criarProduto = (token: string, dados: DadosProduto) =>
  requisicao<Produto>('POST', '/api/produtos', { corpo: dados, token })

export const editarProduto = (token: string, id: string, dados: DadosProduto) =>
  requisicao<Produto>('PUT', `/api/produtos/${id}`, { corpo: dados, token })

export const excluirProduto = (token: string, id: string) =>
  requisicao<void>('DELETE', `/api/produtos/${id}`, { token })

// ---------- Minha conta ----------

/** O que acontece ao excluir: só a conta, ou a conta e a empresa inteira (única administradora). */
export type TipoExclusao = 'conta' | 'conta-e-empresa'

export type Conta = {
  id: string
  nome: string
  email: string
  telefone: string | null
  administrador: boolean
  empresa: string | null
  criadoEm: string
  exclusao: TipoExclusao
}

export type Dispositivo = {
  id: string
  descricao: string | null
  criadoEm: string
  ultimoUsoEm: string
  expiraEm: string
  /** É este navegador */
  atual: boolean
}

export const obterConta = (token: string) => requisicao<Conta>('GET', '/api/conta', { token })

export const editarConta = (token: string, dados: { nome: string; telefone: string }) =>
  requisicao<Conta>('PUT', '/api/conta', { corpo: dados, token })

export const trocarSenha = (token: string, dados: { senhaAtual: string; novaSenha: string }) =>
  requisicao<Conta>('POST', '/api/conta/senha', { corpo: dados, token })

/** Envia um código para o e-mail novo; a troca só vale depois de confirmar o código. */
export const pedirTrocaDeEmail = (token: string, dados: { novoEmail: string; senha: string }) =>
  requisicao<Verificacao>('POST', '/api/conta/email', { corpo: dados, token })

export const confirmarTrocaDeEmail = (token: string, dados: { desafioId: string; codigo: string }) =>
  requisicao<Conta>('POST', '/api/conta/email/confirmar', { corpo: dados, token })

export const reenviarCodigoDoEmail = (token: string, desafioId: string) =>
  requisicao<Verificacao>('POST', '/api/conta/email/reenviar', { corpo: { desafioId }, token })

export const listarDispositivos = (token: string) =>
  requisicao<Dispositivo[]>('GET', '/api/conta/dispositivos', {
    token,
    // Para a API marcar qual é "este computador"
    cabecalhos: lerLembrado() ? { 'X-Dispositivo': lerLembrado()!.token } : undefined,
  })

export const esquecerDispositivo = (token: string, id: string) =>
  requisicao<void>('DELETE', `/api/conta/dispositivos/${id}`, { token })

export const esquecerTodosDispositivos = (token: string) =>
  requisicao<void>('DELETE', '/api/conta/dispositivos', { token })

export const excluirConta = (token: string, dados: { senha: string; confirmacao: string }) =>
  requisicao<{ excluida: TipoExclusao }>('POST', '/api/conta/excluir', { corpo: dados, token })

// ---------- Sessão salva no navegador ----------

export function lerSessao(): Sessao | null {
  try {
    const bruto = localStorage.getItem(SESSAO_KEY)
    const sessao = bruto ? (JSON.parse(bruto) as Sessao) : null
    // Sessões do formato antigo (antes das empresas) não têm "usuario": pede login de novo.
    return sessao?.usuario ? sessao : null
  } catch {
    return null
  }
}

export function salvarSessao(sessao: Sessao) {
  try {
    localStorage.setItem(SESSAO_KEY, JSON.stringify(sessao))
  } catch {
    // Sem armazenamento (aba anônima bloqueada etc.): a sessão vale só nesta página.
  }
}

export function sair() {
  try {
    localStorage.removeItem(SESSAO_KEY)
    localStorage.removeItem('orion-sessao-loja') // sessão das lojas, de versões anteriores
  } catch {
    // nada a limpar
  }
}

// ---------- "Lembrar de quem sou" ----------

/** Navegador lembrado: o e-mail já vem preenchido e o login não pede o código (por 30 dias). */
export type Lembrado = { email: string; token: string }

export function lerLembrado(): Lembrado | null {
  try {
    const bruto = localStorage.getItem(LEMBRAR_KEY)
    return bruto ? (JSON.parse(bruto) as Lembrado) : null
  } catch {
    return null
  }
}

export function salvarLembrado(lembrado: Lembrado) {
  try {
    localStorage.setItem(LEMBRAR_KEY, JSON.stringify(lembrado))
  } catch {
    // Sem armazenamento: o código volta a ser pedido no próximo login.
  }
}

export function esquecerLembrado() {
  try {
    localStorage.removeItem(LEMBRAR_KEY)
  } catch {
    // nada a limpar
  }
}
