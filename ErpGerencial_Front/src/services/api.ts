// Chamadas à API ASP.NET (ErpGerencial_Back/Orion.Api).
// Em desenvolvimento o Vite repassa /api para http://localhost:5193 (ver vite.config.ts).
//
// Como no Bling: a conta da pessoa pertence a uma empresa, e tudo do ERP fica dentro dela.
// O administrador cria os outros usuários da empresa, cada um com login e permissões próprios.

const SESSAO_KEY = 'orion-sessao'
/** "Lembrar de quem sou" de versões anteriores (o login não pede mais código): apagado ao sair. */
const LEMBRAR_KEY = 'orion-lembrar'

export type Usuario = {
  id: string
  nome: string
  email: string
  /** WhatsApp, só dígitos com DDD: o código de acesso pode ir para ele. */
  telefone: string | null
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
  /** Rua, número e bairro (impresso no cupom e no recibo). */
  endereco: string | null
  cidade: string | null
  uf: string | null
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
  // FormData (envio de arquivo): o navegador monta o Content-Type com o separador das partes.
  const formulario = corpo instanceof FormData
  const headers: Record<string, string> = { ...cabecalhos }
  if (corpo !== undefined && !formulario) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let resposta: Response
  try {
    resposta = await fetch(rota, {
      method: metodo,
      headers,
      body: corpo === undefined ? undefined : formulario ? corpo : JSON.stringify(corpo),
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

/** Código de 6 dígitos enviado por e-mail (confirmação da troca de e-mail em Minha conta). */
export type Verificacao = {
  desafioId: string
  canal: 'email'
  /** Para onde foi, com parte escondida: "an•••@gmail.com" */
  destino: string
  expiraEm: string
  reenviarEmSegundos: number
}

/** Entra com e-mail ou com o celular (o mesmo cadastrado em Minha conta) e a senha. */
export const entrar = (dados: { email: string; senha: string } | { telefone: string; senha: string }) =>
  login(
    requisicao<Sessao>('POST', '/api/auth/login', { corpo: dados }),
    'telefone' in dados ? 'Celular ou senha incorretos' : 'E-mail ou senha incorretos',
  )

/** Sessão atualizada (permissões, empresa e status podem ter mudado). */
export const sessaoAtual = (token: string) => requisicao<Sessao>('GET', '/api/auth/eu', { token })

/** Quando o token vence (milissegundos), lido do próprio token; null se não der para ler. */
export function expiracaoDoToken(token: string): number | null {
  try {
    const parte = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const { exp } = JSON.parse(atob(parte.padEnd(parte.length + ((4 - (parte.length % 4)) % 4), '='))) as { exp?: number }
    return typeof exp === 'number' ? exp * 1000 : null
  } catch {
    return null
  }
}

/** Sessão nova (mais 8 horas); o ERP chama sozinho enquanto está aberto. */
export const renovarSessao = (token: string) => requisicao<Sessao>('POST', '/api/auth/renovar', { token })

// ---------- Esqueci minha senha ----------

export type PedidoSenha = { desafioId: string; reenviarEmSegundos: number }

export const pedirCodigoDeSenha = (acesso: { email: string } | { telefone: string }) =>
  requisicao<PedidoSenha>('POST', '/api/auth/senha/esqueci', { corpo: acesso })

export const reenviarCodigoDeSenha = (desafioId: string) =>
  requisicao<PedidoSenha>('POST', '/api/auth/senha/reenviar', { corpo: { desafioId } })

export const redefinirSenha = (dados: { desafioId: string; codigo: string; novaSenha: string }) =>
  requisicao<Sessao>('POST', '/api/auth/senha/redefinir', { corpo: dados })

// ---------- Empresa ----------

export const obterEmpresa = (token: string) => requisicao<Empresa>('GET', '/api/empresa', { token })

export type DadosEmpresa = {
  nome: string
  razaoSocial: string
  documento: string
  email: string
  telefone: string
  endereco: string
  cidade: string
  uf: string
}

export const editarEmpresa = (token: string, dados: DadosEmpresa) =>
  requisicao<Empresa>('PUT', '/api/empresa', { corpo: dados, token })

// ---------- Usuários e permissões (só administrador) ----------

export const listarUsuarios = (token: string) => requisicao<Usuario[]>('GET', '/api/usuarios', { token })

export const criarUsuario = (
  token: string,
  dados: { nome: string; email: string; telefone: string; senha: string; administrador: boolean },
) => requisicao<Usuario>('POST', '/api/usuarios', { corpo: dados, token })

export const editarUsuario = (
  token: string,
  id: string,
  dados: { nome: string; telefone: string; administrador: boolean; ativo: boolean; novaSenha?: string | null },
) => requisicao<Usuario>('PUT', `/api/usuarios/${id}`, { corpo: dados, token })

// ---------- Produtos ----------

export type Produto = {
  id: string
  /** ID mostrado na tela (1, 2, 3...), gerado automaticamente. */
  numero: number
  nome: string
  codigo: string | null
  codigoBarras: string | null
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
  /** Ids das imagens na ordem da galeria; a primeira é a capa (ver urlImagemProduto). */
  imagens: string[]
  /** UN, KG, M, CX... */
  unidade: string
  estoqueMinimo: number
  /** Quantidade no mínimo ou abaixo dele. */
  estoqueBaixo: boolean
}

export type DadosProduto = {
  nome: string
  codigo: string
  codigoBarras: string
  precoCusto: number | null
  precoVendaPf: number | null
  precoVendaPj: number | null
  quantidade: number | null
  marca: string
  modelo: string
  cor: string
  voltagem: string
  observacao: string
  unidade: string
  estoqueMinimo: number | null
}

export type ListaProdutos = { itens: Produto[]; total: number; pagina: number; tamanhoPagina: number }

export const listarProdutos = (token: string, busca = '', pagina = 1) =>
  requisicao<ListaProdutos>('GET', `/api/produtos?${parametros({ busca: busca.trim(), pagina })}`, { token })

export const obterProduto = async (token: string, id: string) => {
  const produto = await requisicao<Produto>('GET', `/api/produtos/${id}`, { token })
  // API de versão anterior às imagens (ainda não reiniciada) não manda a lista: trata como sem imagens.
  return { ...produto, imagens: produto.imagens ?? [] }
}

export const criarProduto = (token: string, dados: DadosProduto) =>
  requisicao<Produto>('POST', '/api/produtos', { corpo: dados, token })

export const editarProduto = (token: string, id: string, dados: DadosProduto) =>
  requisicao<Produto>('PUT', `/api/produtos/${id}`, { corpo: dados, token })

export const excluirProduto = (token: string, id: string) =>
  requisicao<void>('DELETE', `/api/produtos/${id}`, { token })

// Imagens do produto: enviadas uma a uma depois de salvar o produto; a primeira da lista é a capa.

/** Endereço da imagem para a tag <img> (aberto: o id é aleatório, não dá para adivinhar). */
export const urlImagemProduto = (id: string) => `/api/produtos/imagens/${id}`

/**
 * As rotas de imagem sempre explicam um 404 ("Produto não encontrado"...). 404 sem explicação = a API em
 * execução é de antes das imagens (não tem essas rotas): o projeto precisa ser reiniciado.
 */
async function rotaDeImagem<T>(chamada: Promise<T>): Promise<T> {
  try {
    return await chamada
  } catch (erro) {
    if (erro instanceof ErroApi && erro.status === 404 && !erro.campo) {
      throw new ErroApi(
        404,
        'A API está desatualizada e ainda não salva imagens. Reinicie o projeto (npm run dev:tudo) e salve de novo.',
        'imagens',
      )
    }
    throw erro
  }
}

export const enviarImagemProduto = (token: string, produtoId: string, arquivo: Blob) => {
  const corpo = new FormData()
  corpo.append('arquivo', arquivo, 'imagem')
  return rotaDeImagem(requisicao<{ id: string }>('POST', `/api/produtos/${produtoId}/imagens`, { corpo, token }))
}

/** Todos os ids do produto na nova ordem (o primeiro vira a capa). */
export const ordenarImagensProduto = (token: string, produtoId: string, ids: string[]) =>
  rotaDeImagem(requisicao<void>('PUT', `/api/produtos/${produtoId}/imagens/ordem`, { corpo: { ids }, token }))

export const excluirImagemProduto = (token: string, produtoId: string, id: string) =>
  requisicao<void>('DELETE', `/api/produtos/${produtoId}/imagens/${id}`, { token })

// ---------- Clientes ----------

export type Cliente = {
  id: string
  /** ID mostrado na tela (1, 2, 3...), gerado automaticamente. */
  numero: number
  nome: string
  /** Só os dígitos (DDD + número). */
  celular: string
  /** CPF ou CNPJ sem pontuação (o CNPJ pode ter letras). */
  documento: string | null
  // Campos da ficha "Registro de Cliente" (opcionais)
  /** Produto que o cliente comprou. */
  produto: string | null
  /** RG ou inscrição estadual. */
  rgInscricao: string | null
  /** "1980-05-20" */
  dataNascimento: string | null
  pontoReferencia: string | null
  /** Telefones só com os dígitos (DDD + número). */
  telefoneResidencial: string | null
  telefoneComercial: string | null
  celular2: string | null
  conjuge: string | null
  /** Dia da compra ("2026-10-13"). */
  dataCompra: string | null
  /** Só os 8 dígitos. */
  cep: string | null
  logradouro: string | null
  numeroEndereco: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  /** "meses" (a cada N meses, no horário escolhido, e se repete) ou "data" (cadastros antigos: uma vez só). */
  tipoIntervalo: TipoIntervalo
  /** De quanto em quanto tempo a mensagem se repete (em intervaloUnidade); null: sem envios automáticos. */
  intervaloQuantidade: number | null
  intervaloUnidade: UnidadeIntervalo
  /** Dia do próximo envio ("2026-12-08"); null quando não há envio marcado. */
  proximaManutencao: string | null
  /** Mensagem de WhatsApp só deste cliente (null: usa a mensagem padrão da empresa). */
  mensagemWhatsapp: string | null
  /** Próximo envio da mensagem de WhatsApp (ISO, UTC). */
  envioEm: string | null
  /** Foto do cliente (ver urlFotoCliente); null quando não tem. */
  fotoId: string | null
  /** Imagem da mensagem personalizada (ver urlImagemMensagem); null quando não tem. */
  mensagemImagemId: string | null
  criadoEm: string
  atualizadoEm: string
}

export type DadosCliente = {
  nome: string
  celular: string
  /** CPF ou CNPJ (opcional). */
  documento: string
  produto: string
  rgInscricao: string
  /** "1980-05-20" ou null. */
  dataNascimento: string | null
  pontoReferencia: string
  telefoneResidencial: string
  telefoneComercial: string
  celular2: string
  conjuge: string
  /** "2026-10-13" ou null. */
  dataCompra: string | null
  cep: string
  logradouro: string
  numeroEndereco: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
  /**
   * Data e hora do próximo envio (ISO). O servidor calcula o intervalo por ela: hoje 14/10 e próximo envio 14/12 →
   * a cada 2 meses. null: sem envios automáticos.
   */
  envioEm: string | null
  /** Edição sem mexer no calendário: o servidor mantém o envio e o intervalo como estão (envioEm é ignorado). */
  manterEnvio?: boolean
}

export type TipoIntervalo = 'meses' | 'data'

export type UnidadeIntervalo = 'minutos' | 'horas' | 'dias' | 'semanas' | 'meses'

export type ListaClientes = { itens: Cliente[]; total: number; pagina: number; tamanhoPagina: number }

export const listarClientes = (token: string, busca = '', pagina = 1) =>
  requisicao<ListaClientes>(
    'GET',
    `/api/clientes?pagina=${pagina}${busca.trim() ? `&busca=${encodeURIComponent(busca.trim())}` : ''}`,
    { token },
  )

export const obterCliente = (token: string, id: string) => requisicao<Cliente>('GET', `/api/clientes/${id}`, { token })

export const criarCliente = (token: string, dados: DadosCliente) =>
  requisicao<Cliente>('POST', '/api/clientes', { corpo: dados, token })

export const editarCliente = (token: string, id: string, dados: DadosCliente) =>
  requisicao<Cliente>('PUT', `/api/clientes/${id}`, { corpo: dados, token })

/** Mensagem personalizada do cliente (vazia: volta a usar a mensagem padrão da empresa). */
export const salvarMensagemCliente = (token: string, id: string, mensagem: string) =>
  requisicao<Cliente>('PUT', `/api/clientes/${id}/mensagem`, { corpo: { mensagem }, token })

export const excluirCliente = (token: string, id: string) =>
  requisicao<void>('DELETE', `/api/clientes/${id}`, { token })

/** Botão "Cancelar envios automáticos": nada mais é enviado para o cliente. */
export const cancelarEnviosCliente = (token: string, id: string) =>
  requisicao<Cliente>('POST', `/api/clientes/${id}/cancelar-envios`, { token })

/** Endereço da foto para a tag <img> (aberto: o id é aleatório, não dá para adivinhar). */
export const urlFotoCliente = (id: string) => `/api/clientes/fotos/${id}`

/** Envia (ou troca) a foto do cliente, tirada pela webcam. */
export const salvarFotoCliente = (token: string, clienteId: string, foto: Blob) => {
  const corpo = new FormData()
  corpo.append('arquivo', foto, 'foto.jpg')
  return rotaDeImagem(requisicao<{ id: string }>('PUT', `/api/clientes/${clienteId}/foto`, { corpo, token }))
}

export const excluirFotoCliente = (token: string, clienteId: string) =>
  requisicao<void>('DELETE', `/api/clientes/${clienteId}/foto`, { token })

/** Endereço de um CEP (ViaCEP, serviço público e gratuito). */
export type EnderecoCep = { logradouro: string; bairro: string; cidade: string; uf: string }

/** Busca o endereço do CEP (8 dígitos). null: CEP não encontrado. Lança erro se não houver conexão. */
export async function buscarCep(cep: string): Promise<EnderecoCep | null> {
  const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
  if (!resposta.ok) return null
  const dados = (await resposta.json()) as { erro?: boolean | string; logradouro?: string; bairro?: string; localidade?: string; uf?: string }
  if (dados.erro) return null
  return { logradouro: dados.logradouro ?? '', bairro: dados.bairro ?? '', cidade: dados.localidade ?? '', uf: dados.uf ?? '' }
}

// ---------- Mensagem automática (WhatsApp) ----------

export type EnvioWhatsapp = {
  id: string
  clienteId: string
  clienteNome: string
  telefone: string
  /** Data de manutenção que motivou o envio ("2027-04-08"). */
  dataReferencia: string
  /** "agendado" (na data e hora marcadas no cliente); "manutencao" é dos envios antigos, pelo intervalo. */
  tipo: 'manutencao' | 'agendado'
  mensagem: string
  /** "enviado", "teste" (modo teste: não saiu de verdade) ou "erro". */
  status: 'enviado' | 'teste' | 'erro'
  erro: string | null
  criadoEm: string
}

export type ConfiguracaoWhatsapp = {
  /** Número remetente, só dígitos com DDD. */
  remetente: string | null
  mensagem: string | null
  /** Imagem da mensagem padrão (ver urlImagemMensagem); null quando não tem. */
  imagemId: string | null
  /** Últimos envios: os 15 clientes que receberam a mensagem mais recentemente (um envio por cliente). */
  envios: EnvioWhatsapp[]
}

export type DadosWhatsapp = { remetente: string; mensagem: string }

export const obterWhatsapp = (token: string) => requisicao<ConfiguracaoWhatsapp>('GET', '/api/whatsapp', { token })

export const salvarWhatsapp = (token: string, dados: DadosWhatsapp) =>
  requisicao<ConfiguracaoWhatsapp>('PUT', '/api/whatsapp', { corpo: dados, token })

/** Situação do WhatsApp que envia; ao conectar, vem o QR Code (imagem) e o código de 8 letras. */
export type ConexaoWhatsapp = {
  remetente: string | null
  estado: 'sem-numero' | 'conectado' | 'aguardando' | 'desconectado' | 'indisponivel'
  qrCode: string | null
  codigo: string | null
  mensagem: string | null
}

export const obterConexaoWhatsapp = (token: string) => requisicao<ConexaoWhatsapp>('GET', '/api/whatsapp/conexao', { token })
/** Gera um QR Code novo para conectar o celular do número salvo (o QR vale ~20 segundos). */
export const conectarWhatsapp = (token: string) => requisicao<ConexaoWhatsapp>('POST', '/api/whatsapp/conexao', { token })

/** Mensagem automática programada para hoje (tela inicial), uma por cliente: enviada, não saiu ou ainda vai sair. */
/** Cópias de segurança do programa da loja (aviso na tela inicial). */
export type SituacaoBackup = { ativo: boolean; pasta: string; ultima: string | null }

export const obterSituacaoBackup = (token: string) => requisicao<SituacaoBackup>('GET', '/api/sistema/backup', { token })

export type MensagemHoje = {
  clienteId: string
  nome: string
  celular: string
  /** Horário do envio (feito) ou o marcado no cliente (agendada). */
  horario: string
  situacao: 'enviada' | 'teste' | 'erro' | 'agendada'
  erro: string | null
  /** Quantas já saíram hoje (cliente com intervalo de minutos/horas recebe mais de uma por dia). */
  enviadas: number
}

export const listarMensagensHoje = (token: string) => requisicao<MensagemHoje[]>('GET', '/api/whatsapp/hoje', { token })

/** Endereço da imagem da mensagem para a tag <img> (aberto: o id é aleatório, não dá para adivinhar). */
export const urlImagemMensagem = (id: string) => `/api/whatsapp/imagens/${id}`

/**
 * Envia (ou troca) a imagem da mensagem: a da mensagem padrão (sem clienteId) ou a da mensagem de um cliente.
 * Ela vai como foto, com o texto de legenda.
 */
export const salvarImagemMensagem = (token: string, imagem: Blob, clienteId?: string) => {
  const corpo = new FormData()
  corpo.append('arquivo', imagem, 'imagem.jpg')
  const caminho = clienteId ? `/api/clientes/${clienteId}/mensagem/imagem` : '/api/whatsapp/imagem'
  return rotaDeImagem(requisicao<{ id: string }>('PUT', caminho, { corpo, token }))
}

export const excluirImagemMensagem = (token: string, clienteId?: string) =>
  requisicao<void>('DELETE', clienteId ? `/api/clientes/${clienteId}/mensagem/imagem` : '/api/whatsapp/imagem', { token })

/** Todo o histórico de envios da mensagem automática para um cliente (mais novos primeiro). */
export const listarEnviosCliente = (token: string, clienteId: string) =>
  requisicao<EnvioWhatsapp[]>('GET', `/api/clientes/${clienteId}/envios`, { token })

// ---------- Cupons e recibos (não fiscais) ----------

export type FormaPagamento = 'dinheiro' | 'pix' | 'cartao-credito' | 'cartao-debito' | 'boleto' | 'transferencia' | 'outro'

export const FORMAS_PAGAMENTO: { valor: FormaPagamento; rotulo: string }[] = [
  { valor: 'dinheiro', rotulo: 'Dinheiro' },
  { valor: 'pix', rotulo: 'Pix' },
  { valor: 'cartao-credito', rotulo: 'Cartão de crédito' },
  { valor: 'cartao-debito', rotulo: 'Cartão de débito' },
  { valor: 'boleto', rotulo: 'Boleto' },
  { valor: 'transferencia', rotulo: 'Transferência' },
  { valor: 'outro', rotulo: 'Outro' },
]

export const rotuloPagamento = (forma: string) => FORMAS_PAGAMENTO.find((f) => f.valor === forma)?.rotulo ?? forma

export type CupomItem = {
  id: string
  /** Produto do cadastro; null no item avulso. */
  produtoId: string | null
  descricao: string
  codigo: string | null
  codigoBarras: string | null
  quantidade: number
  valorUnitario: number
  total: number
}

/** Cupom de venda / recibo. Emitente e cliente são copiados na emissão (a reimpressão sai igual). */
export type Cupom = {
  id: string
  /** Nº sequencial dentro da empresa. */
  numero: number
  emitenteNome: string
  emitenteRazaoSocial: string | null
  emitenteDocumento: string | null
  emitenteEndereco: string | null
  emitenteCidade: string | null
  emitenteUf: string | null
  emitenteTelefone: string | null
  clienteId: string | null
  clienteNome: string | null
  clienteDocumento: string | null
  clienteEndereco: string | null
  itens: CupomItem[]
  subtotal: number
  desconto: number
  total: number
  formaPagamento: FormaPagamento
  /** Quanto foi pago na 1ª forma (null nos cupons antigos: o total). */
  valorPagamento1: number | null
  /** 2ª forma (venda paga em duas partes). */
  formaPagamento2: FormaPagamento | null
  valorPagamento2: number | null
  /** Total pago (soma das formas). */
  valorRecebido: number | null
  troco: number | null
  /** "Correspondente a" do recibo. */
  referente: string | null
  observacao: string | null
  emitidoPor: string
  vendedorNome: string | null
  emitidoEm: string
  canceladoEm: string | null
  motivoCancelamento: string | null
  /** Nota emitida no site do governo e anotada aqui: 'cupom' (consumidor) ou 'nota' (empresa). */
  notaTipo: TipoNota | null
  notaNumero: string | null
  notaRegistradaEm: string | null
}

export type DadosCupom = {
  clienteId: string | null
  clienteNome: string | null
  clienteDocumento: string | null
  clienteEndereco: string | null
  itens: { produtoId: string | null; descricao: string | null; quantidade: number; valorUnitario: number }[]
  /** Valor do recibo avulso (sem itens). */
  valor: number | null
  desconto: number | null
  formaPagamento: FormaPagamento
  valorRecebido: number | null
  referente: string | null
  observacao: string | null
  valorPagamento1?: number | null
  formaPagamento2?: FormaPagamento | null
  valorPagamento2?: number | null
  /** Vendedor (usuário da empresa); sem ele, quem está emitindo. */
  vendedorId?: string | null
}

export type ListaCupons = { itens: Cupom[]; total: number; pagina: number; tamanhoPagina: number }

/** Filtros do Financeiro (datas "2026-10-21", no horário de Brasília). */
export type FiltrosVendas = { de?: string; ate?: string; forma?: string; vendedorId?: string; situacao?: string }

const parametros = (valores: Record<string, string | number | undefined>) =>
  new URLSearchParams(
    Object.entries(valores)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)]),
  )

export const listarCupons = (token: string, busca = '', pagina = 1, filtros: FiltrosVendas = {}) =>
  requisicao<ListaCupons>('GET', `/api/cupons?${parametros({ busca: busca.trim(), pagina, ...filtros })}`, { token })

export const obterCupom = (token: string, id: string) => requisicao<Cupom>('GET', `/api/cupons/${id}`, { token })

export const emitirCupom = (token: string, dados: DadosCupom) =>
  requisicao<Cupom>('POST', '/api/cupons', { corpo: dados, token })

export const cancelarCupom = (token: string, id: string, motivo: string) =>
  requisicao<Cupom>('POST', `/api/cupons/${id}/cancelar`, { corpo: { motivo }, token })

export type TipoNota = 'cupom' | 'nota'


// ---------- Estoque ----------

export type TipoMovimento = 'inicial' | 'ajuste' | 'venda' | 'cancelamento'

export type MovimentoEstoque = {
  id: string
  produtoId: string
  produtoNome: string
  produtoCodigo: string | null
  tipo: TipoMovimento
  /** Positivo entra, negativo sai. */
  quantidade: number
  saldoApos: number
  custoUnitario: number | null
  observacao: string | null
  cupomId: string | null
  usuarioNome: string
  criadoEm: string
}

export type ListaMovimentos = { itens: MovimentoEstoque[]; total: number; pagina: number; tamanhoPagina: number }

export const listarMovimentos = (
  token: string,
  filtros: { produtoId?: string; tipo?: string; de?: string; ate?: string; pagina?: number } = {},
) => requisicao<ListaMovimentos>('GET', `/api/estoque/movimentos?${parametros(filtros)}`, { token })

export const ajustarEstoque = (token: string, produtoId: string, novaQuantidade: number, motivo: string) =>
  requisicao<{ quantidade: number }>('POST', `/api/estoque/produtos/${produtoId}/ajuste`, { corpo: { novaQuantidade, motivo }, token })

// ---------- Financeiro ----------

export type TotaisVendas = {
  faturamento: number
  vendas: number
  ticketMedio: number
  itensVendidos: number
  descontos: number
  custo: number
  /** Faturamento menos o custo dos produtos (preço de custo na hora da venda). */
  lucroBruto: number
  cancelados: number
  valorCancelado: number
}

export type FatiaVendas = { chave: string; nome: string; valor: number; quantidade: number }

export type ResumoFinanceiro = {
  de: string
  ate: string
  /** "dia" (até 3 meses) ou "mes". */
  agrupamento: 'dia' | 'mes'
  totais: TotaisVendas
  /** O período anterior do mesmo tamanho (para comparar). */
  anterior: TotaisVendas
  noTempo: { periodo: string; faturamento: number; vendas: number }[]
  formasPagamento: FatiaVendas[]
  produtos: FatiaVendas[]
  clientes: FatiaVendas[]
  vendedores: FatiaVendas[]
  /** 0 = domingo. */
  diasSemana: number[]
  horas: number[]
  anos: number[]
  equipe: FatiaVendas[]
}

export const obterResumoFinanceiro = (token: string, filtros: FiltrosVendas) =>
  requisicao<ResumoFinanceiro>('GET', `/api/financeiro/resumo?${parametros(filtros)}`, { token })

// ---------- Histórico dos clientes ("Número de ordem de serviço") ----------

export type ClienteHistoricoResumo = {
  id: string
  numero: number
  nome: string
  celular: string
  documento: string | null
  compras: number
  totalGasto: number
  mensagens: number
  ultimaAtividade: string
}

export type ListaClientesHistorico = { itens: ClienteHistoricoResumo[]; total: number; pagina: number; tamanhoPagina: number }

export type EventoHistorico = {
  tipo: 'venda' | 'cancelamento' | 'mensagem' | 'cadastro'
  data: string
  titulo: string
  detalhe: string | null
  valor: number | null
  cupomId: string | null
  /** Venda: "cancelado"; mensagem: enviado, teste ou erro. */
  status: string | null
  itens: { descricao: string; codigo: string | null; codigoBarras: string | null; quantidade: number; valorUnitario: number; total: number }[]
}

export type HistoricoCliente = {
  id: string
  numero: number
  nome: string
  celular: string
  documento: string | null
  endereco: string | null
  proximoEnvio: string | null
  criadoEm: string
  resumo: {
    compras: number
    totalGasto: number
    ticketMedio: number
    itensComprados: number
    mensagensEnviadas: number
    mensagensComErro: number
    primeiraCompra: string | null
    ultimaCompra: string | null
  }
  eventos: EventoHistorico[]
}

export const listarHistoricoClientes = (token: string, busca = '', pagina = 1) =>
  requisicao<ListaClientesHistorico>('GET', `/api/historico/clientes?${parametros({ busca: busca.trim(), pagina })}`, { token })

export const obterHistoricoCliente = (token: string, id: string) =>
  requisicao<HistoricoCliente>('GET', `/api/historico/clientes/${id}`, { token })

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
    localStorage.removeItem(LEMBRAR_KEY)
  } catch {
    // nada a limpar
  }
}
