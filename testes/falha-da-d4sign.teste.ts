import { describe, expect, it } from 'vitest'

import { FalhaNaD4Sign, descreverFalhaDaD4Sign } from '@/lib/d4sign'

describe('recusa da D4Sign em português (18/11/2026)', () => {
  it('limite mensal da chave de API vira recado claro, não erro genérico', () => {
    // O corpo que a D4Sign mandou em produção, com os acentos escapados.
    const corpo = '{"status":false,"error":"Esta chave da API j\\u00e1 atingiu o tempo limite para este m\\u00eas"}'
    const texto = descreverFalhaDaD4Sign(new FalhaNaD4Sign(401, corpo))
    expect(texto).toContain('limite de uso deste mês')
    expect(texto).toContain('falar com a D4Sign')
  })

  it('outra recusa mostra o motivo que a D4Sign deu', () => {
    const texto = descreverFalhaDaD4Sign(new FalhaNaD4Sign(400, '{"error":"Cofre inválido"}'))
    expect(texto).toBe('A D4Sign recusou (HTTP 400): Cofre inválido')
  })

  it('erro de rede não é confundido com recusa', () => {
    expect(descreverFalhaDaD4Sign(new TypeError('fetch failed'))).toContain('não respondeu')
  })
})
