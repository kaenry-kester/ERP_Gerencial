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
