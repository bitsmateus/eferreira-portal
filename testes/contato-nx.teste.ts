/**
 * Sincronização do cliente com o contato da NX: procura pelo número; achou,
 * atualiza; não achou, cria. E nunca derruba o cadastro.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { cliente } = vi.hoisted(() => ({
  cliente: {
    atual: null as Record<string, unknown> | null,
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: { cliente: { findUnique: async () => cliente.atual } },
}))
vi.mock('@/lib/auditoria', () => ({ registrarAuditoria: async () => undefined }))

import { numeroParaNx, sincronizarContatoNx } from '@/lib/contato-nx'

const AUTOR = { usuarioId: 'u1', usuarioEmail: 'op@exemplo.invalido' }

function umCliente(telefone: string | null) {
  return {
    nome: 'Joana Ribeiro da Silva',
    documento: '11144477735',
    tipoPessoa: 'FISICA',
    email: 'joana@exemplo.invalido',
    telefone,
    cep: '01310100',
    endereco: 'Avenida Paulista, 1000',
    cidade: 'São Paulo',
    uf: 'SP',
  }
}

describe('numeroParaNx', () => {
  it('põe o 55 na frente do número nacional e não duplica', () => {
    expect(numeroParaNx('11999998888')).toBe('5511999998888')
    expect(numeroParaNx('5511999998888')).toBe('5511999998888')
    expect(numeroParaNx('(11) 99999-8888')).toBe('5511999998888')
  })

  it('sem número utilizável, devolve null', () => {
    expect(numeroParaNx(null)).toBeNull()
    expect(numeroParaNx('123')).toBeNull()
  })
})

describe('sincronizarContatoNx', () => {
  const chamadas: { caminho: string; corpo: Record<string, unknown>; auth: string }[] = []

  function dublarNx(respostaDaBusca: number, respostaDaEscrita = 200) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        const caminho = url.split('/').pop() ?? ''
        chamadas.push({
          caminho,
          corpo: JSON.parse(String(init.body)) as Record<string, unknown>,
          auth: String((init.headers as Record<string, string>).Authorization),
        })
        const status = caminho === 'showcontact' ? respostaDaBusca : respostaDaEscrita
        return new Response('{}', { status })
      }),
    )
  }

  beforeEach(() => {
    chamadas.length = 0
    cliente.atual = umCliente('11999998888')
    process.env.NX_API_URL = 'https://nx.exemplo.invalido/api/external/abc/'
    process.env.NX_API_TOKEN = 'token-de-teste'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.NX_API_URL
    delete process.env.NX_API_TOKEN
  })

  it('contato existe: busca e depois ATUALIZA, com o token no Bearer', async () => {
    dublarNx(200)
    const resultado = await sincronizarContatoNx('c1', AUTOR)

    expect(resultado).toEqual({ situacao: 'atualizado' })
    expect(chamadas.map((c) => c.caminho)).toEqual(['showcontact', 'updateContact'])
    expect(chamadas[1]?.auth).toBe('Bearer token-de-teste')
    expect(chamadas[1]?.corpo).toMatchObject({
      name: 'Joana Ribeiro da Silva',
      number: '5511999998888',
      cpf: '111.444.777-35',
      estado: 'SP',
    })
  })

  it('contato não existe (404): CRIA', async () => {
    dublarNx(404)
    const resultado = await sincronizarContatoNx('c1', AUTOR)

    expect(resultado).toEqual({ situacao: 'criado' })
    expect(chamadas.map((c) => c.caminho)).toEqual(['showcontact', 'createContact'])
  })

  it('sem telefone não fala com a NX', async () => {
    cliente.atual = umCliente(null)
    dublarNx(200)

    expect(await sincronizarContatoNx('c1', AUTOR)).toEqual({ situacao: 'sem_telefone' })
    expect(chamadas).toHaveLength(0)
  })

  it('sem as variáveis, fica desligado e não fala com a NX', async () => {
    delete process.env.NX_API_URL
    dublarNx(200)

    expect(await sincronizarContatoNx('c1', AUTOR)).toEqual({ situacao: 'desligado' })
    expect(chamadas).toHaveLength(0)
  })

  it('NX fora do ar não lança: devolve falhou sem o token no motivo', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('rede'))))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const resultado = await sincronizarContatoNx('c1', AUTOR)

    expect(resultado.situacao).toBe('falhou')
    expect(JSON.stringify(resultado)).not.toContain('token-de-teste')
  })

  it('resposta de erro na escrita vira falhou, não exceção', async () => {
    dublarNx(404, 500)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    expect((await sincronizarContatoNx('c1', AUTOR)).situacao).toBe('falhou')
  })
})
