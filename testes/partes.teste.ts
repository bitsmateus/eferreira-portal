/**
 * `validarParte` — o cadastro de quem assina um documento avulso sem ser
 * cliente do escritório (17/09/2026): parte contrária, testemunha, advogado
 * externo, ou outro papel livre.
 */

import { describe, expect, it } from 'vitest'
import { PapelDaParte } from '@prisma/client'

import { validarParte, type CamposDeParte } from '@/lib/partes'

const COMPLETO: CamposDeParte = {
  nome: 'Fulano Advogado',
  email: 'fulano@exemplo.com.br',
  telefone: '(11) 90000-0000',
  papel: PapelDaParte.ADVOGADO,
  observacoes: 'Advogado da parte contrária',
}

describe('validarParte', () => {
  it('aceita o cadastro completo', () => {
    const resultado = validarParte(COMPLETO)

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(resultado.dados.nome).toBe('Fulano Advogado')
    expect(resultado.dados.email).toBe('fulano@exemplo.com.br')
    expect(resultado.dados.papel).toBe(PapelDaParte.ADVOGADO)
  })

  it('telefone e observações são opcionais', () => {
    const resultado = validarParte({ ...COMPLETO, telefone: '', observacoes: '' })

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(resultado.dados.telefone).toBeNull()
    expect(resultado.dados.observacoes).toBeNull()
  })

  it('exige nome com pelo menos duas letras', () => {
    const resultado = validarParte({ ...COMPLETO, nome: 'A' })

    expect(resultado.ok).toBe(false)
    if (resultado.ok) return
    expect(resultado.erros['nome']).toBeDefined()
  })

  it('e-mail é obrigatório — é para onde a D4Sign manda o convite', () => {
    const resultado = validarParte({ ...COMPLETO, email: '' })

    expect(resultado.ok).toBe(false)
    if (resultado.ok) return
    expect(resultado.erros['email']).toMatch(/e-mail/i)
  })

  it('recusa e-mail inválido', () => {
    const resultado = validarParte({ ...COMPLETO, email: 'nao-e-email' })
    expect(resultado.ok).toBe(false)
  })

  it('normaliza o e-mail para minúsculas', () => {
    const resultado = validarParte({ ...COMPLETO, email: 'Fulano@Exemplo.COM.BR' })

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    expect(resultado.dados.email).toBe('fulano@exemplo.com.br')
  })

  it('recusa papel que não existe na lista', () => {
    const resultado = validarParte({ ...COMPLETO, papel: 'INVENTADO' })

    expect(resultado.ok).toBe(false)
    if (resultado.ok) return
    expect(resultado.erros['papel']).toBeDefined()
  })

  it.each(Object.values(PapelDaParte))('aceita o papel %s', (papel) => {
    expect(validarParte({ ...COMPLETO, papel }).ok).toBe(true)
  })
})
