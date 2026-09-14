import { describe, expect, it } from 'vitest'

import { formatarReais, reaisParaCentavos, reaisPorExtenso } from '@/lib/extenso'

describe('formatarReais', () => {
  it('formata com separador de milhar e dois decimais', () => {
    expect(formatarReais(175000)).toBe('R$ 1.750,00')
    expect(formatarReais(50000)).toBe('R$ 500,00')
    expect(formatarReais(1096891)).toBe('R$ 10.968,91')
    expect(formatarReais(5)).toBe('R$ 0,05')
    expect(formatarReais(0)).toBe('R$ 0,00')
  })

  it('não perde centavos em valor grande', () => {
    expect(formatarReais(123456789)).toBe('R$ 1.234.567,89')
  })
})

describe('reaisPorExtenso', () => {
  // O valor do contrato que o escritório enviou como exemplo.
  it('escreve o valor do contrato exatamente como no modelo', () => {
    expect(reaisPorExtenso(175000)).toBe('mil setecentos e cinquenta reais')
  })

  it('escreve o valor do termo de acordo do escritório', () => {
    expect(reaisPorExtenso(1096891)).toBe(
      'dez mil, novecentos e sessenta e oito reais e noventa e um centavos',
    )
  })

  it('trata singular e plural', () => {
    expect(reaisPorExtenso(100)).toBe('um real')
    expect(reaisPorExtenso(200)).toBe('dois reais')
    expect(reaisPorExtenso(1)).toBe('um centavo')
    expect(reaisPorExtenso(2)).toBe('dois centavos')
  })

  it('escreve cem e cento corretamente', () => {
    expect(reaisPorExtenso(10000)).toBe('cem reais')
    expect(reaisPorExtenso(10100)).toBe('cento e um reais')
    expect(reaisPorExtenso(15000)).toBe('cento e cinquenta reais')
  })

  it('junta reais e centavos', () => {
    expect(reaisPorExtenso(50050)).toBe('quinhentos reais e cinquenta centavos')
    expect(reaisPorExtenso(75000)).toBe('setecentos e cinquenta reais')
  })

  it('escreve milhares', () => {
    expect(reaisPorExtenso(100000)).toBe('mil reais')
    expect(reaisPorExtenso(200000)).toBe('dois mil reais')
    expect(reaisPorExtenso(274222)).toBe(
      'dois mil, setecentos e quarenta e dois reais e vinte e dois centavos',
    )
  })

  // "um milhão DE reais" quando é redondo; sem preposição quando tem resto.
  it('usa a preposição no milhão redondo', () => {
    expect(reaisPorExtenso(100_000_000)).toBe('um milhão de reais')
    expect(reaisPorExtenso(200_000_000)).toBe('dois milhões de reais')
    expect(reaisPorExtenso(150_000_000)).toBe('um milhão e quinhentos mil reais')
  })

  it('trata zero', () => {
    expect(reaisPorExtenso(0)).toBe('zero reais')
  })
})

describe('reaisParaCentavos', () => {
  it('aceita o formato brasileiro', () => {
    expect(reaisParaCentavos('1.750,00')).toBe(175000)
    expect(reaisParaCentavos('1750,00')).toBe(175000)
    expect(reaisParaCentavos('1750')).toBe(175000)
    expect(reaisParaCentavos('0,05')).toBe(5)
    expect(reaisParaCentavos('10.968,91')).toBe(1096891)
  })

  it('aceita com o cifrão na frente', () => {
    expect(reaisParaCentavos('R$ 1.750,00')).toBe(175000)
  })

  it('completa um decimal só', () => {
    expect(reaisParaCentavos('10,5')).toBe(1050)
  })

  // Formato americano entrando por engano daria um valor 100x errado num
  // documento assinado. Melhor recusar.
  it('recusa formato que não é brasileiro', () => {
    expect(reaisParaCentavos('1,750.00')).toBeNull()
    expect(reaisParaCentavos('abc')).toBeNull()
    expect(reaisParaCentavos('')).toBeNull()
    expect(reaisParaCentavos('12,345')).toBeNull()
  })

  it('ida e volta preserva o valor', () => {
    for (const centavos of [1, 5, 100, 175000, 1096891, 123456789]) {
      expect(reaisParaCentavos(formatarReais(centavos))).toBe(centavos)
    }
  })
})
