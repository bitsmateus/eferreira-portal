import { describe, expect, it } from 'vitest'
import {
  cnpjValido,
  cpfValido,
  documentoValido,
  formatarDocumento,
  normalizarDocumento,
  prepararDocumento,
  tipoDoDocumento,
} from '@/lib/documento'

/**
 * Números sintéticos, gerados fechando o dígito verificador. Não pertencem a
 * ninguém — servem só para exercitar o cálculo.
 */
const CPFS_VALIDOS = [
  '52998224725',
  '11144477735',
  '39053344705',
  '16899502267',
] as const

const CNPJS_VALIDOS = [
  '11222333000181',
  '45776096000112',
  '30118774000182',
] as const

describe('normalizarDocumento', () => {
  it('mantém só os dígitos', () => {
    expect(normalizarDocumento('529.982.247-25')).toBe('52998224725')
    expect(normalizarDocumento('11.222.333/0001-81')).toBe('11222333000181')
    expect(normalizarDocumento('  529 982 247 25 ')).toBe('52998224725')
  })

  it('devolve string vazia quando não há dígito nenhum', () => {
    expect(normalizarDocumento('abc.def-gh')).toBe('')
  })
})

describe('cpfValido', () => {
  it.each(CPFS_VALIDOS)('aceita o CPF válido %s', (cpf) => {
    expect(cpfValido(cpf)).toBe(true)
  })

  it('aceita com máscara', () => {
    expect(cpfValido('529.982.247-25')).toBe(true)
  })

  it('recusa quando o primeiro dígito verificador não confere', () => {
    // 52998224725 é válido; trocar o penúltimo dígito quebra o primeiro DV.
    expect(cpfValido('52998224715')).toBe(false)
  })

  it('recusa quando o segundo dígito verificador não confere', () => {
    expect(cpfValido('52998224724')).toBe(false)
  })

  it('recusa sequências de dígitos repetidos', () => {
    for (const digito of '0123456789') {
      expect(cpfValido(digito.repeat(11))).toBe(false)
    }
  })

  it('recusa comprimento errado', () => {
    expect(cpfValido('5299822472')).toBe(false)
    expect(cpfValido('529982247255')).toBe(false)
    expect(cpfValido('')).toBe(false)
  })

  it('recusa um CNPJ válido — não é CPF', () => {
    expect(cpfValido('11222333000181')).toBe(false)
  })

  it('recusa uma máscara bem formada com números inventados', () => {
    // O caso que a regra 4 existe para pegar: formato certo, dígito errado.
    expect(cpfValido('123.456.789-00')).toBe(false)
  })
})

describe('cnpjValido', () => {
  it.each(CNPJS_VALIDOS)('aceita o CNPJ válido %s', (cnpj) => {
    expect(cnpjValido(cnpj)).toBe(true)
  })

  it('aceita com máscara', () => {
    expect(cnpjValido('11.222.333/0001-81')).toBe(true)
  })

  it('recusa quando o primeiro dígito verificador não confere', () => {
    expect(cnpjValido('11222333000171')).toBe(false)
  })

  it('recusa quando o segundo dígito verificador não confere', () => {
    expect(cnpjValido('11222333000180')).toBe(false)
  })

  it('recusa sequências de dígitos repetidos', () => {
    for (const digito of '0123456789') {
      expect(cnpjValido(digito.repeat(14))).toBe(false)
    }
  })

  it('recusa comprimento errado', () => {
    expect(cnpjValido('1122233300018')).toBe(false)
    expect(cnpjValido('112223330001811')).toBe(false)
  })

  it('recusa um CPF válido — não é CNPJ', () => {
    expect(cnpjValido('52998224725')).toBe(false)
  })
})

describe('tipoDoDocumento', () => {
  it('distingue CPF de CNPJ', () => {
    expect(tipoDoDocumento('529.982.247-25')).toBe('CPF')
    expect(tipoDoDocumento('11.222.333/0001-81')).toBe('CNPJ')
  })

  it('devolve null para número inválido, mesmo com o comprimento certo', () => {
    expect(tipoDoDocumento('52998224724')).toBeNull()
    expect(tipoDoDocumento('11222333000180')).toBeNull()
    expect(tipoDoDocumento('123')).toBeNull()
  })
})

describe('documentoValido', () => {
  it('aceita CPF e CNPJ válidos', () => {
    expect(documentoValido('529.982.247-25')).toBe(true)
    expect(documentoValido('45.776.096/0001-12')).toBe(true)
  })

  it('recusa o resto', () => {
    expect(documentoValido('000.000.000-00')).toBe(false)
    expect(documentoValido('')).toBe(false)
  })
})

describe('formatarDocumento', () => {
  it('formata CPF e CNPJ', () => {
    expect(formatarDocumento('52998224725')).toBe('529.982.247-25')
    expect(formatarDocumento('11222333000181')).toBe('11.222.333/0001-81')
  })

  it('devolve só os dígitos quando o comprimento não é de CPF nem de CNPJ', () => {
    expect(formatarDocumento('123')).toBe('123')
  })

  it('ida e volta: formatar e normalizar preserva o valor guardado', () => {
    for (const documento of [...CPFS_VALIDOS, ...CNPJS_VALIDOS]) {
      expect(normalizarDocumento(formatarDocumento(documento))).toBe(documento)
    }
  })
})

describe('prepararDocumento', () => {
  it('normaliza e classifica um CPF válido', () => {
    expect(prepararDocumento('529.982.247-25')).toEqual({
      ok: true,
      documento: '52998224725',
      tipo: 'CPF',
    })
  })

  it('normaliza e classifica um CNPJ válido', () => {
    expect(prepararDocumento('11.222.333/0001-81')).toEqual({
      ok: true,
      documento: '11222333000181',
      tipo: 'CNPJ',
    })
  })

  it('explica quando o campo veio vazio', () => {
    const resultado = prepararDocumento('   ')
    expect(resultado.ok).toBe(false)
    if (!resultado.ok) {
      expect(resultado.motivo).toContain('Informe o CPF ou o CNPJ')
    }
  })

  it('explica quando o comprimento não bate', () => {
    const resultado = prepararDocumento('1234567')
    expect(resultado.ok).toBe(false)
    if (!resultado.ok) {
      expect(resultado.motivo).toContain('11 dígitos')
    }
  })

  it('diz que o dígito verificador do CPF não confere', () => {
    const resultado = prepararDocumento('123.456.789-00')
    expect(resultado.ok).toBe(false)
    if (!resultado.ok) {
      expect(resultado.motivo).toBe(
        'CPF inválido — o dígito verificador não confere.',
      )
    }
  })

  it('diz que o dígito verificador do CNPJ não confere', () => {
    const resultado = prepararDocumento('11.222.333/0001-80')
    expect(resultado.ok).toBe(false)
    if (!resultado.ok) {
      expect(resultado.motivo).toBe(
        'CNPJ inválido — o dígito verificador não confere.',
      )
    }
  })

  it('recusa os CPFs de exemplo do protótipo — são fictícios', () => {
    // Registrado como teste porque a semente e a demonstração NÃO podem
    // usá-los: o protótipo é maquete, o sistema exige dígito verificador.
    for (const ficticio of [
      '381.204.556-08',
      '205.887.401-72',
      '744.019.230-66',
      '918.335.702-14',
    ]) {
      expect(documentoValido(ficticio)).toBe(false)
    }
  })
})
