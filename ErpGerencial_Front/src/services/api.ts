// Chamadas à API ASP.NET (ErpGerencial_Back/Orion.Api).
// Em desenvolvimento o Vite repassa /api para http://localhost:5193 (ver vite.config.ts).

const SESSAO_KEY = 'orion-sessao'

export type Sessao = {
  token: string
  nome: string
  email: string
}

export class ErroApi extends Error {
  status: number

  constructor(status: number, mensagem: string) {
    super(mensagem)
    this.status = status
  }
}

async function post<T>(rota: string, corpo: unknown): Promise<T> {
  let resposta: Response
  try {
    resposta = await fetch(rota, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    })
  } catch {
    throw new ErroApi(0, 'Sem conexão com o servidor. Tente de novo.')
  }

  if (resposta.ok) return resposta.json() as Promise<T>

  // O proxy do Vite responde 500/502/504 quando a API está desligada.
  if (resposta.status >= 500) throw new ErroApi(resposta.status, 'Servidor indisponível. Tente de novo.')
  if (resposta.status === 401) throw new ErroApi(401, 'E-mail ou senha incorretos')

  // 409 traz { erro }, 400 traz { errors: { campo: [mensagem] } }
  const dados = await resposta.json().catch(() => null)
  const mensagem =
    dados?.erro ??
    (Object.values(dados?.errors ?? {}).flat()[0] as string | undefined) ??
    'Algo deu errado. Tente de novo.'
  throw new ErroApi(resposta.status, mensagem)
}

export const cadastrar = (dados: { nome: string; email: string; telefone: string; senha: string }) =>
  post<Sessao>('/api/auth/cadastro', dados)

export const entrar = (dados: { email: string; senha: string }) => post<Sessao>('/api/auth/login', dados)

export function salvarSessao(sessao: Sessao) {
  try {
    localStorage.setItem(SESSAO_KEY, JSON.stringify(sessao))
  } catch {
    // Sem armazenamento (aba anônima bloqueada etc.): a sessão vale só nesta página.
  }
}
