import { describe, expect, it } from 'vitest'

import { chaveDaOrigem, origemValida } from '@/lib/acesso-do-atendimento'

/**
 * A parte do atendimento que dá para provar sem banco. A consulta protegida
 * pelo código é provada contra o Postgres em
 * `testes-de-banco/atendimento-com-codigo.teste.ts`.
 */

describe('chaveDaOrigem', () => {
  it('é a mesma para a mesma conversa e diferente entre conversas', () => {
    expect(chaveDaOrigem('5511999990001-1')).toBe(chaveDaOrigem('5511999990001-1'))
    expect(chaveDaOrigem('5511999990001-1')).not.toBe(chaveDaOrigem('5511999990002-1'))
  })

  it('ignora espaço nas pontas', () => {
    expect(chaveDaOrigem('  5511999990001-1 ')).toBe(chaveDaOrigem('5511999990001-1'))
  })

  it('não guarda o telefone: só uma impressão digital com prefixo api:', () => {
    const chave = chaveDaOrigem('5511999990001-1')
    expect(chave).toMatch(/^api:[0-9a-f]{24}$/)
    expect(chave).not.toContain('5511999990001')
  })

  // O portal grava o IP no mesmo campo. Um IP nunca começa com "api:", então
  // a chave de uma conversa não colide com a de um visitante do site.
  it('não se confunde com um endereço IP', () => {
    expect(chaveDaOrigem('198.51.100.7').startsWith('api:')).toBe(true)
  })
})

describe('origemValida', () => {
  it('aceita um identificador de tamanho razoável', () => {
    expect(origemValida('5511999990001-12')).toBe(true)
  })

  it('recusa vazio, curto demais e longo demais', () => {
    expect(origemValida('')).toBe(false)
    expect(origemValida('   ')).toBe(false)
    expect(origemValida('abc')).toBe(false)
    expect(origemValida('x'.repeat(81))).toBe(false)
  })
})
