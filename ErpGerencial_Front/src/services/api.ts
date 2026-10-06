// Chamadas à API ASP.NET (ErpGerencial_Back/Orion.Api).
// Em desenvolvimento o Vite repassa /api para http://localhost:5193 (ver vite.config.ts).
//
// Dois acessos separados, cada um com o seu token:
// - a conta da pessoa (e-mail e senha), que vê e cadastra lojas;
// - a loja (CNPJ e senha), onde ficam os produtos.

const SESSAO_KEY = 'orion-sessao'
const SESSAO_LOJA_KEY = 'orion-sessao-loja'

export type Sessao = {
  token: string
  nome: string
  email: string
}

export type LojaResumo = {
  id: string
  razaoSocial: string
  nomeFantasia: string
  cnpj: string
}

export type LojaDetalhe = LojaResumo & {
  nomeDono: string
  email: string
  celular: string
  criadoEm: string
}

export type SessaoLoja = {
  token: string
  loja: LojaDetalhe
}

export type NovaLoja = {
  razaoSocial: string
  nomeFantasia: string
  cnpj: string
  nomeDono: string
  cpfDono: string
  email: string
  celular: string
  senha: string
}

export class ErroApi extends Error {
  status: number
  /** Campo do formulário ligado ao erro (ex.: "email", "cnpj"), quando a API informa. */
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
  metodo: 'GET' | 'POST',
  rota: string,
  { corpo, token }: { corpo?: unknown; token?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = {}
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

  if (resposta.ok) return resposta.json() as Promise<T>

  // O proxy do Vite responde 500/502/504 quando a API está desligada.
  if (resposta.status >= 500) throw new ErroApi(resposta.status, 'Servidor indisponível. Tente de novo.')
  if (resposta.status === 429) throw new ErroApi(429, 'Muitas tentativas. Aguarde um minuto.')
  if (resposta.status === 401 || resposta.status === 403) {
    // Com token: a sessão venceu. Sem token: login recusado (a mensagem vem de quem chamou).
    throw new ErroApi(resposta.status, token ? 'Sua sessão expirou. Entre de novo.' : 'Dados de acesso incorretos')
  }

  // 409 traz { erro, campo }, 400 traz { errors: { campo: [mensagem] } }
  const dados = await resposta.json().catch(() => null)
  if (dados?.erro) throw new ErroApi(resposta.status, dados.erro, dados.campo)
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

export const cadastrar = (dados: { nome: string; email: string; telefone: string; senha: string }) =>
  requisicao<Sessao>('POST', '/api/auth/cadastro', { corpo: dados })

export const entrar = (dados: { email: string; senha: string }) =>
  login(requisicao<Sessao>('POST', '/api/auth/login', { corpo: dados }), 'E-mail ou senha incorretos')

/** Client ID público do Google; null quando o servidor ainda não foi configurado. */
export const configGoogle = () => requisicao<{ clientId: string | null }>('GET', '/api/auth/google/config')

/** contaNova: a conta foi criada agora (o próximo passo é cadastrar a loja). */
export type SessaoGoogle = Sessao & { contaNova: boolean }

export const entrarComGoogle = (codigo: string) =>
  login(
    requisicao<SessaoGoogle>('POST', '/api/auth/google', { corpo: { codigo } }),
    'O Google não confirmou o acesso. Tente de novo.',
  )

// ---------- Lojas ----------

export const listarLojas = (token: string) => requisicao<LojaResumo[]>('GET', '/api/lojas', { token })

export const criarLoja = (token: string, dados: NovaLoja) =>
  requisicao<LojaResumo>('POST', '/api/lojas', { corpo: dados, token })

export const entrarNaLoja = (dados: { cnpj: string; senha: string }) =>
  login(requisicao<SessaoLoja>('POST', '/api/lojas/login', { corpo: dados }), 'CNPJ ou senha incorretos')

export const lojaAtual = (token: string) => requisicao<LojaDetalhe>('GET', '/api/lojas/atual', { token })

// ---------- Sessões salvas no navegador ----------

function ler<T>(chave: string): T | null {
  try {
    const bruto = localStorage.getItem(chave)
    return bruto ? (JSON.parse(bruto) as T) : null
  } catch {
    return null
  }
}

function gravar(chave: string, valor: unknown) {
  try {
    if (valor === null) localStorage.removeItem(chave)
    else localStorage.setItem(chave, JSON.stringify(valor))
  } catch {
    // Sem armazenamento (aba anônima bloqueada etc.): a sessão vale só nesta página.
  }
}

export const lerSessao = () => ler<Sessao>(SESSAO_KEY)
export const salvarSessao = (sessao: Sessao) => gravar(SESSAO_KEY, sessao)

export const lerSessaoLoja = () => ler<SessaoLoja>(SESSAO_LOJA_KEY)
export const salvarSessaoLoja = (sessao: SessaoLoja) => gravar(SESSAO_LOJA_KEY, sessao)
export const sairDaLoja = () => gravar(SESSAO_LOJA_KEY, null)

/** Sai da conta e da loja. */
export function sair() {
  gravar(SESSAO_KEY, null)
  gravar(SESSAO_LOJA_KEY, null)
}
