/**
 * Cadastro de advogados (25/09/2026) — a parte que não precisa de banco: a
 * validação do formulário e a qualificação que entra na procuração.
 */

import { describe, expect, it } from 'vitest'

import { qualificacaoDoAdvogado, validarAdvogado, type CamposDeAdvogado } from '@/lib/advogados'

const COMPLETO: CamposDeAdvogado = {
  nome: 'Dra. Maria de Souza',
  genero: 'F',
  nacionalidade: 'brasileira',
  estadoCivil: 'Casada',
  oab: '123.456',
  oabUf: 'sp',
}

describe('validarAdvogado', () => {
  it('aceita o cadastro completo e normaliza a UF da OAB', () => {
    const resultado = validarAdvogado(COMPLETO)

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    expect(resultado.dados.oabUf).toBe('SP')
    expect(resultado.dados.genero).toBe('F')
  })

  it.each(['nome', 'genero', 'nacionalidade', 'estadoCivil', 'oab', 'oabUf'] as const)(
    'recusa sem %s',
    (campo) => {
      const resultado = validarAdvogado({ ...COMPLETO, [campo]: '' })

      expect(resultado.ok).toBe(false)
      if (resultado.ok) return
      expect(resultado.erros[campo]).toBeDefined()
    },
  )

  it('a OAB é só número (com ponto) — letra ou barra não passa', () => {
    expect(validarAdvogado({ ...COMPLETO, oab: 'OAB/SP 123' }).ok).toBe(false)
    expect(validarAdvogado({ ...COMPLETO, oab: '123456' }).ok).toBe(true)
  })

  it('estado civil é da lista fechada', () => {
    expect(validarAdvogado({ ...COMPLETO, estadoCivil: 'enrolado' }).ok).toBe(false)
  })

  it('UF que não existe é recusada', () => {
    expect(validarAdvogado({ ...COMPLETO, oabUf: 'XX' }).ok).toBe(false)
  })
})

describe('qualificacaoDoAdvogado', () => {
  it('sai como no modelo do escritório, concordando com o gênero', () => {
    expect(
      qualificacaoDoAdvogado({ nacionalidade: 'brasileiro', estadoCivil: 'Solteiro', feminino: false }),
    ).toBe('brasileiro, solteiro, advogado')

    expect(
      qualificacaoDoAdvogado({ nacionalidade: 'brasileira', estadoCivil: 'Divorciada', feminino: true }),
    ).toBe('brasileira, divorciada, advogada')
  })
})
