/**
 * O aviso automático da D4Sign (25/09/2026): a rota é pública, então o que
 * importa provar é a porta — sem segredo certo, nada é consultado.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { POST } from '@/app/api/d4sign/retorno/route'

vi.mock('@/lib/assinaturas', () => ({
  conferirAssinaturaPorRetorno: vi.fn(async () => ({ situacao: 'aguardando' })),
}))

import { conferirAssinaturaPorRetorno } from '@/lib/assinaturas'

const UUID = '01a0d046-9109-75d1-aa52-b5780d13d394'

function aviso(chave: string | null, corpo: string): NextRequest {
  const url = new URL('https://portal.exemplo.invalido/api/d4sign/retorno')
  if (chave !== null) url.searchParams.set('chave', chave)
  return new NextRequest(url, { method: 'POST', body: corpo })
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.mocked(conferirAssinaturaPorRetorno).mockClear()
})

describe('POST /api/d4sign/retorno', () => {
  it('sem segredo configurado a rota nem existe', async () => {
    vi.stubEnv('D4SIGN_RETORNO_SEGREDO', '')

    const resposta = await POST(aviso('qualquer', JSON.stringify({ uuid: UUID })))
    expect(resposta.status).toBe(404)
    expect(conferirAssinaturaPorRetorno).not.toHaveBeenCalled()
  })

  it('chave errada ou ausente: 401, e nada é consultado', async () => {
    vi.stubEnv('D4SIGN_RETORNO_SEGREDO', 'segredo-certo')

    expect((await POST(aviso('segredo-errado', UUID))).status).toBe(401)
    expect((await POST(aviso(null, UUID))).status).toBe(401)
    expect(conferirAssinaturaPorRetorno).not.toHaveBeenCalled()
  })

  it('chave certa: confere o documento do aviso (JSON, formulário ou texto)', async () => {
    vi.stubEnv('D4SIGN_RETORNO_SEGREDO', 'segredo-certo')

    for (const corpo of [
      JSON.stringify({ uuid: UUID, type_post: '1' }),
      `uuid=${UUID}&type_post=1`,
      `documento ${UUID.toUpperCase()} finalizado`,
    ]) {
      const resposta = await POST(aviso('segredo-certo', corpo))
      expect(resposta.status).toBe(200)
    }

    expect(conferirAssinaturaPorRetorno).toHaveBeenCalledTimes(3)
    // O UUID é normalizado; o corpo não decide mais nada além de qual documento olhar.
    expect(conferirAssinaturaPorRetorno).toHaveBeenCalledWith(UUID)
  })

  it('aviso sem UUID é ignorado com 200 (a D4Sign não reenvia)', async () => {
    vi.stubEnv('D4SIGN_RETORNO_SEGREDO', 'segredo-certo')

    const resposta = await POST(aviso('segredo-certo', 'sem documento nenhum'))
    expect(resposta.status).toBe(200)
    expect(conferirAssinaturaPorRetorno).not.toHaveBeenCalled()
  })

  it('erro na conferência devolve 500, para a D4Sign tentar de novo', async () => {
    vi.stubEnv('D4SIGN_RETORNO_SEGREDO', 'segredo-certo')
    vi.mocked(conferirAssinaturaPorRetorno).mockRejectedValueOnce(new Error('rede'))

    expect((await POST(aviso('segredo-certo', UUID))).status).toBe(500)
  })
})
