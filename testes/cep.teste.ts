/**
 * A busca de endereço pelo CEP.
 *
 * Nenhum destes testes toca a internet: o `fetch` é dublado. O que está sendo
 * provado não é o ViaCEP — é a promessa que esta camada faz a quem a chama:
 * **qualquer coisa que dê errado vira `null`**, porque cadastrar um cliente
 * não pode depender de um serviço de terceiro estar no ar.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

import { buscarEnderecoPorCep, enderecoParaOCampo } from '@/lib/cep'

function responder(corpo: unknown, situacao = 200) {
  return new Response(JSON.stringify(corpo), { status: situacao })
}

const PAULISTA = {
  cep: '01310-100',
  logradouro: 'Avenida Paulista',
  complemento: 'de 612 a 1510 - lado par',
  bairro: 'Bela Vista',
  localidade: 'São Paulo',
  uf: 'SP',
}

describe('buscarEnderecoPorCep', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('devolve logradouro, bairro, cidade e UF', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => responder(PAULISTA)),
    )

    expect(await buscarEnderecoPorCep('01310-100')).toEqual({
      logradouro: 'Avenida Paulista',
      bairro: 'Bela Vista',
      cidade: 'São Paulo',
      uf: 'SP',
    })
  })

  it('aceita o CEP com pontuação ou sem', async () => {
    const chamadas: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (endereco: string) => {
        chamadas.push(endereco)
        return responder(PAULISTA)
      }),
    )

    await buscarEnderecoPorCep('01310-100')
    await buscarEnderecoPorCep('01310100')

    expect(chamadas).toHaveLength(2)
    for (const chamada of chamadas) expect(chamada).toContain('01310100')
  })

  // CEP incompleto não vira consulta: seria uma chamada de rede por tecla
  // digitada, e nenhuma delas daria resposta útil.
  it('nem consulta quando o CEP não tem oito dígitos', async () => {
    const chamado = vi.fn()
    vi.stubGlobal('fetch', chamado)

    expect(await buscarEnderecoPorCep('0131')).toBeNull()
    expect(await buscarEnderecoPorCep('')).toBeNull()
    expect(await buscarEnderecoPorCep('013101000000')).toBeNull()
    expect(chamado).not.toHaveBeenCalled()
  })

  // O ViaCEP responde 200 com `erro` quando o CEP não existe. Sem esta
  // conferência, um CEP inventado viraria endereço vazio no cadastro.
  it('trata o CEP inexistente, com `erro` booleano ou em texto', async () => {
    for (const erro of [true, 'true']) {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => responder({ erro })),
      )
      expect(await buscarEnderecoPorCep('00000000')).toBeNull()
    }
  })

  it('devolve null quando o serviço responde erro de HTTP', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => responder({}, 500)),
    )

    expect(await buscarEnderecoPorCep('01310100')).toBeNull()
  })

  // Serviço fora do ar, rede caída, tempo esgotado: o cadastro continua.
  it('devolve null quando a chamada falha', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('rede fora')
      }),
    )

    expect(await buscarEnderecoPorCep('01310100')).toBeNull()
  })

  it('devolve null quando a resposta não é JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>manutenção</html>', { status: 200 })),
    )

    expect(await buscarEnderecoPorCep('01310100')).toBeNull()
  })

  // Cidade e UF são o motivo de esta busca existir — são elas que vão para a
  // assinatura dos documentos. Resposta sem elas não serve para nada.
  it('devolve null quando falta cidade ou UF', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => responder({ logradouro: 'Rua Sem Nome', bairro: 'Centro' })),
    )

    expect(await buscarEnderecoPorCep('01310100')).toBeNull()
  })

  // CEP de cidade inteira não tem logradouro, e isso é resposta legítima:
  // cidade e UF continuam servindo.
  it('aceita CEP sem logradouro, desde que tenha cidade e UF', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        responder({ logradouro: '', bairro: '', localidade: 'Mogi das Cruzes', uf: 'sp' }),
      ),
    )

    expect(await buscarEnderecoPorCep('08780000')).toEqual({
      logradouro: '',
      bairro: '',
      cidade: 'Mogi das Cruzes',
      uf: 'SP',
    })
  })
})

describe('enderecoParaOCampo', () => {
  /**
   * O campo do cadastro guarda "logradouro, número, complemento e bairro", e o
   * CEP não conhece o número. A vírgula no fim é de propósito: deixa claro que
   * falta coisa. "Avenida Paulista, Bela Vista" pareceria pronto e iria assim
   * para a procuração, sem número nenhum.
   */
  it('deixa a vírgula esperando pelo número', () => {
    expect(
      enderecoParaOCampo({
        logradouro: 'Avenida Paulista',
        bairro: 'Bela Vista',
        cidade: 'São Paulo',
        uf: 'SP',
      }),
    ).toBe('Avenida Paulista, ')
  })

  it('não inventa texto quando não há logradouro', () => {
    expect(
      enderecoParaOCampo({
        logradouro: '',
        bairro: '',
        cidade: 'Mogi das Cruzes',
        uf: 'SP',
      }),
    ).toBe('')
  })

  // O bairro fica FORA do campo de propósito: entrando no meio do texto, ele
  // ficaria antes do número, na ordem errada.
  it('não inclui o bairro', () => {
    expect(
      enderecoParaOCampo({
        logradouro: 'Avenida Paulista',
        bairro: 'Bela Vista',
        cidade: 'São Paulo',
        uf: 'SP',
      }),
    ).not.toContain('Bela Vista')
  })
})
