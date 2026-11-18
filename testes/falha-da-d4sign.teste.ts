import { afterEach, describe, expect, it, vi } from 'vitest'

import { FalhaNaD4Sign, descreverFalhaDaD4Sign, esquecerSaldo, saldoGuardado } from '@/lib/d4sign'

const CONFIGURACAO = { url: 'https://d4sign.teste/api/v1', tokenApi: 't', cryptKey: 'c', cofre: 'x' }

describe('saldo guardado — poupa a chave de API (18/11/2026)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    esquecerSaldo()
  })

  it('pergunta uma vez e reaproveita por 10 minutos; depois do envio pergunta de novo', async () => {
    const chamadas = vi.fn(async () => new Response(JSON.stringify({ credit: '50', sent: '19' }), { status: 200 }))
    vi.stubGlobal('fetch', chamadas)

    expect((await saldoGuardado(CONFIGURACAO, 0))?.restantes).toBe(31)
    expect((await saldoGuardado(CONFIGURACAO, 9 * 60_000))?.restantes).toBe(31)
    expect(chamadas).toHaveBeenCalledTimes(1)

    await saldoGuardado(CONFIGURACAO, 11 * 60_000)
    expect(chamadas).toHaveBeenCalledTimes(2)

    esquecerSaldo()
    await saldoGuardado(CONFIGURACAO, 11 * 60_000 + 1)
    expect(chamadas).toHaveBeenCalledTimes(3)
  })

  it('falha também é guardada: não martela a D4Sign a cada recarga', async () => {
    const chamadas = vi.fn(async () => new Response('{"error":"limite"}', { status: 401 }))
    vi.stubGlobal('fetch', chamadas)

    expect(await saldoGuardado(CONFIGURACAO, 0)).toBeNull()
    expect(await saldoGuardado(CONFIGURACAO, 4 * 60_000)).toBeNull()
    expect(chamadas).toHaveBeenCalledTimes(1)
  })
})

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
