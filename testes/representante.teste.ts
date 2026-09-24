/**
 * `validarRepresentante` — os campos do sócio, coletados na mesma submissão
 * do cadastro da empresa (decisão de 17/09/2026). Os nomes de campo já vêm
 * prefixados (`representanteDocumento`, `representanteNome`...) porque
 * convivem, no mesmo FormData, com os campos da própria empresa.
 */

import { describe, expect, it } from 'vitest'

import { validarRepresentante, type CamposDoRepresentante } from '@/lib/clientes'

const COMPLETO: CamposDoRepresentante = {
  representanteDocumento: '529.982.247-25',
  representanteNome: 'Marcos Vinícius Andrade',
  representanteRg: '12.345.678 SSP-SP',
  representanteEstadoCivil: 'Casado',
  representanteProfissao: 'Engenheiro civil',
  representanteNacionalidade: 'Brasileiro',
  representanteNomeMae: '',
  representanteEmail: 'marcos@exemplo.com.br',
  representanteTelefone: '(11) 98812-4470',
  representanteQualificacao: 'sócio administrador',
}

describe('validarRepresentante', () => {
  it('aceita o cadastro completo, com nome da mãe em branco', () => {
    const resultado = validarRepresentante(COMPLETO)

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(resultado.dados.documento).toBe('52998224725')
    expect(resultado.dados.nomeMae).toBeNull()
    expect(resultado.dados.qualificacao).toBe('sócio administrador')
  })

  it('recusa CNPJ no lugar do CPF do representante', () => {
    const resultado = validarRepresentante({
      ...COMPLETO,
      representanteDocumento: '11.222.333/0001-81',
    })

    expect(resultado.ok).toBe(false)
    if (resultado.ok) return
    expect(resultado.erros['representanteDocumento']).toMatch(/pessoa física/i)
  })

  it('recusa CPF com dígito verificador errado', () => {
    const resultado = validarRepresentante({
      ...COMPLETO,
      representanteDocumento: '529.982.247-24',
    })

    expect(resultado.ok).toBe(false)
    if (resultado.ok) return
    expect(resultado.erros['representanteDocumento']).toMatch(/dígito verificador/i)
  })

  it.each([
    'representanteNome',
    'representanteRg',
    'representanteEstadoCivil',
    'representanteNacionalidade',
    'representanteEmail',
    'representanteTelefone',
  ] as const)('bloqueia sem %s', (campo) => {
    const resultado = validarRepresentante({ ...COMPLETO, [campo]: '' })

    expect(resultado.ok).toBe(false)
    if (resultado.ok) return
    expect(resultado.erros[campo]).toBeDefined()
  })

  it('profissão do representante é opcional (o modelo de PJ de 24/09/2026 não a cita)', () => {
    const resultado = validarRepresentante({ ...COMPLETO, representanteProfissao: '' })

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    expect(resultado.dados.profissao).toBeNull()
  })

  it('nome da mãe e qualificação continuam opcionais', () => {
    const resultado = validarRepresentante({
      ...COMPLETO,
      representanteNomeMae: '',
      representanteQualificacao: '',
    })

    expect(resultado.ok).toBe(true)
  })

  it('recusa e-mail inválido', () => {
    const resultado = validarRepresentante({
      ...COMPLETO,
      representanteEmail: 'nao-e-email',
    })

    expect(resultado.ok).toBe(false)
    if (resultado.ok) return
    expect(resultado.erros['representanteEmail']).toMatch(/e-mail/i)
  })

  it('junta os erros de campos diferentes em uma resposta só', () => {
    const resultado = validarRepresentante({
      ...COMPLETO,
      representanteNome: '',
      representanteEmail: 'nao-e-email',
    })

    expect(resultado.ok).toBe(false)
    if (resultado.ok) return
    expect(Object.keys(resultado.erros).sort()).toEqual([
      'representanteEmail',
      'representanteNome',
    ])
  })
})
