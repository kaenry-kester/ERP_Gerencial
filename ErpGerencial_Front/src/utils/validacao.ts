// Regras de validação compartilhadas pelos formulários.

export const emailValido = (email: string) => /^\S+@\S+\.\S+$/.test(email.trim())

/** Mantém só os dígitos e aplica a máscara (00) 0000-0000 ou (00) 00000-0000. */
export function formatarTelefone(valor: string) {
  const d = valor.replace(/\D/g, '').slice(0, 11)
  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

/** CEP com a máscara 00000-000. */
export function formatarCep(valor: string) {
  const d = valor.replace(/\D/g, '').slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

/** Telefone fixo (10 dígitos) ou celular (11 dígitos), com DDD. */
export const telefoneValido = (telefone: string) => {
  const digitos = telefone.replace(/\D/g, '').length
  return digitos === 10 || digitos === 11
}

export type RequisitoSenha = {
  id: string
  texto: string
  /** Versão curta, usada em telas estreitas. */
  textoCurto: string
  atendido: boolean
}

export function requisitosSenha(senha: string): RequisitoSenha[] {
  return [
    {
      id: 'tamanho',
      texto: 'Mínimo de 8 caracteres',
      textoCurto: '8+ caracteres',
      atendido: senha.length >= 8,
    },
    {
      id: 'maiuscula',
      texto: 'Uma letra maiúscula',
      textoCurto: 'Letra maiúscula',
      atendido: /\p{Lu}/u.test(senha),
    },
    {
      id: 'numero',
      texto: 'Um número',
      textoCurto: 'Número',
      atendido: /\d/.test(senha),
    },
    {
      id: 'especial',
      texto: 'Um caractere especial (!@#$)',
      textoCurto: 'Especial (!@#$)',
      atendido: /[^\p{L}\d\s]/u.test(senha),
    },
  ]
}

// ---------- CPF e CNPJ ----------

export const apenasDigitos = (valor: string) => valor.replace(/\D/g, '')

/** Máscara 000.000.000-00. */
export function formatarCpf(valor: string) {
  const d = apenasDigitos(valor).slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

/** 11 dígitos e os dois dígitos verificadores corretos. */
export function cpfValido(cpf: string) {
  const d = apenasDigitos(cpf)
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false
  const digito = (tamanho: number) => {
    let soma = 0
    for (let i = 0; i < tamanho; i++) soma += Number(d[i]) * (tamanho + 1 - i)
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }
  return digito(9) === Number(d[9]) && digito(10) === Number(d[10])
}

/** Letras maiúsculas e dígitos, sem pontuação (o CNPJ pode ter letras desde julho/2026). */
export const normalizarCnpj = (valor: string) =>
  valor
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 14)

/** Máscara 00.000.000/0000-00 (aceita letras nas 12 primeiras posições). */
export function formatarCnpj(valor: string) {
  const c = normalizarCnpj(valor)
  if (c.length <= 2) return c
  if (c.length <= 5) return `${c.slice(0, 2)}.${c.slice(2)}`
  if (c.length <= 8) return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5)}`
  if (c.length <= 12) return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8)}`
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`
}

/**
 * CNPJ numérico ou alfanumérico: 12 letras/dígitos + 2 dígitos verificadores.
 * Cada caractere vale seu código ASCII − 48 (regra da Receita Federal).
 */
export function cnpjValido(cnpj: string) {
  const c = normalizarCnpj(cnpj)
  if (!/^[A-Z0-9]{12}\d{2}$/.test(c) || /^(.)\1+$/.test(c)) return false
  const digito = (tamanho: number) => {
    let soma = 0
    for (let i = 0; i < tamanho; i++) soma += (c.charCodeAt(i) - 48) * (((tamanho - 1 - i) % 8) + 2)
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }
  return digito(12) === Number(c[12]) && digito(13) === Number(c[13])
}

// ---------- CNPJ ou CPF no mesmo campo (dados da empresa) ----------

/** Máscara de CPF até 11 dígitos; passou disso (ou tem letra), máscara de CNPJ. */
export function formatarDocumento(valor: string) {
  const c = normalizarCnpj(valor)
  return c.length <= 11 && /^\d*$/.test(c) ? formatarCpf(c) : formatarCnpj(c)
}

/** Mensagem de erro do campo "CNPJ ou CPF" (vazio é aceito: o campo é opcional). */
export function erroDocumento(valor: string): string | undefined {
  const c = normalizarCnpj(valor)
  if (!c) return undefined
  if (c.length === 11 && /^\d+$/.test(c)) return cpfValido(c) ? undefined : 'CPF inválido'
  if (c.length === 14) return cnpjValido(c) ? undefined : 'CNPJ inválido'
  return 'Incompleto'
}

// ---------- Dinheiro e quantidade (cadastro de produto) ----------

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const numeroBr = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 })

/** 1234.5 → "R$ 1.234,50" */
export const formatarMoeda = (valor: number) => moeda.format(valor)

/** Máscara de dinheiro enquanto digita: só números, os 2 últimos são os centavos. "123456" → "R$ 1.234,56" */
export function mascaraMoeda(valor: string) {
  const digitos = apenasDigitos(valor).replace(/^0+/, '').slice(0, 13)
  return digitos ? moeda.format(Number(digitos) / 100) : ''
}

/** "R$ 1.234,56" → 1234.56 ("" → null) */
export function moedaParaNumero(valor: string): number | null {
  const digitos = apenasDigitos(valor)
  return digitos ? Number(digitos) / 100 : null
}

/** 12.5 → "12,5" */
export const formatarQuantidade = (valor: number) => numeroBr.format(valor)

/** Quantidade enquanto digita: números e uma vírgula, até 3 casas decimais. */
export function mascaraQuantidade(valor: string) {
  const limpo = valor.replace(/\./g, ',').replace(/[^\d,]/g, '')
  const [inteiro, ...resto] = limpo.split(',')
  const decimais = resto.join('').slice(0, 3)
  return resto.length > 0 ? `${inteiro.slice(0, 10)},${decimais}` : inteiro.slice(0, 10)
}

/** "1,5" → 1.5 ("" → null) */
export const quantidadeParaNumero = (valor: string): number | null =>
  valor.trim() ? Number(valor.replace(',', '.')) || 0 : null
