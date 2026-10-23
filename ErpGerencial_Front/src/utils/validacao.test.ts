import { describe, expect, it } from 'vitest'
import {
  cnpjValido,
  cpfValido,
  erroCodigoBarras,
  erroDocumento,
  formatarDocumento,
  formatarMoeda,
  formatarTelefone,
  mascaraMoeda,
  mascaraQuantidade,
  mascaraQuantidadeComSinal,
  moedaParaNumero,
  quantidadeParaNumero,
  requisitosSenha,
  telefoneValido,
} from './validacao'

describe('dinheiro (caixa e cadastro)', () => {
  it('máscara: os dois últimos números são os centavos', () => {
    expect(mascaraMoeda('123456')).toMatch(/^R\$\s1\.234,56$/)
    expect(mascaraMoeda('')).toBe('')
    expect(mascaraMoeda('abc5')).toMatch(/^R\$\s0,05$/)
  })

  it('volta para número', () => {
    expect(moedaParaNumero('R$ 1.234,56')).toBe(1234.56)
    expect(moedaParaNumero('')).toBeNull()
  })

  it('formata em reais', () => {
    expect(formatarMoeda(1060)).toMatch(/^R\$\s1\.060,00$/)
  })
})

describe('quantidade', () => {
  it('aceita vírgula e até 3 casas', () => {
    expect(mascaraQuantidade('1,23456')).toBe('1,234')
    expect(mascaraQuantidade('2.5')).toBe('2,5')
    expect(quantidadeParaNumero('1,5')).toBe(1.5)
    expect(quantidadeParaNumero('')).toBeNull()
  })
})

describe('documentos e telefone', () => {
  it('CPF e CNPJ válidos e inválidos', () => {
    expect(cpfValido('529.982.247-25')).toBe(true)
    expect(cpfValido('111.111.111-11')).toBe(false)
    expect(cnpjValido('11.222.333/0001-81')).toBe(true)
    expect(cnpjValido('11.222.333/0001-82')).toBe(false)
  })

  it('formata e acusa o que falta', () => {
    expect(formatarDocumento('52998224725')).toBe('529.982.247-25')
    expect(formatarDocumento('11222333000181')).toBe('11.222.333/0001-81')
    expect(erroDocumento('')).toBeUndefined()
    expect(erroDocumento('123')).toBeTruthy()
  })

  it('telefone com DDD', () => {
    expect(formatarTelefone('16988887777')).toBe('(16) 98888-7777')
    expect(telefoneValido('(16) 98888-7777')).toBe(true)
    expect(telefoneValido('9888')).toBe(false)
  })
})

describe('código de barras', () => {
  it('confere o dígito verificador do EAN-13', () => {
    expect(erroCodigoBarras('7891234567895')).toBeUndefined()
    expect(erroCodigoBarras('7891234567890')).toBeTruthy()
    expect(erroCodigoBarras('ABC-123')).toBeUndefined() // outros formatos passam
  })
})

describe('senha', () => {
  it('lista o que falta', () => {
    expect(requisitosSenha('Forte@123').every((r) => r.atendido)).toBe(true)
    expect(requisitosSenha('fraca').some((r) => !r.atendido)).toBe(true)
  })
})

describe('mascaraQuantidadeComSinal', () => {
  it('aceita o sinal de menos só na frente', () => {
    expect(mascaraQuantidadeComSinal('-3')).toBe('-3')
    expect(mascaraQuantidadeComSinal('-2,5')).toBe('-2,5')
    expect(mascaraQuantidadeComSinal('4-')).toBe('4')
    expect(mascaraQuantidadeComSinal('10')).toBe('10')
    expect(quantidadeParaNumero('-2,5')).toBe(-2.5)
  })
})
