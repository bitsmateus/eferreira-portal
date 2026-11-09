/**
 * Esteira de acompanhamento (09/11/2026): prazo sugerido, leitura do DJEN,
 * leitura da resposta da IA e junção das OABs.
 *
 * Nenhum destes testes toca a internet: o `fetch` é dublado. Os textos das
 * publicações são inventados — nada de processo de verdade no repositório.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  ESQUEMA_DA_ANALISE,
  lerAnalise,
  prazoSugerido,
  type AnaliseDaPublicacao,
} from '@/lib/analise-da-publicacao'
import { consultarPorOab, lerPagina, limparTexto, type ComunicacaoDoDjen } from '@/lib/djen'
import {
  descreverRecusa,
  iaConfigurada,
  lerRespostaDaAnthropic,
  lerRespostaDaOpenai,
  pedirObjeto,
} from '@/lib/ia'
import {
  diaDaPublicacao,
  ehDiaUtil,
  emRecesso,
  pascoa,
  proximoDiaUtil,
  vencimentoDoPrazo,
} from '@/lib/prazos'
import { chaveDaOab, juntarPorComunicacao } from '@/lib/publicacoes'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('prazo sugerido', () => {
  it('calcula a Páscoa', () => {
    expect(pascoa(2026)).toBe('2026-04-05')
    expect(pascoa(2027)).toBe('2027-03-28')
  })

  it('não conta fim de semana, feriado nacional, feriado móvel nem recesso', () => {
    expect(ehDiaUtil('2026-11-07')).toBe(false) // sábado
    expect(ehDiaUtil('2026-11-20')).toBe(false) // Consciência Negra
    expect(ehDiaUtil('2026-02-16')).toBe(false) // segunda de Carnaval
    expect(ehDiaUtil('2026-04-03')).toBe(false) // Sexta-feira Santa
    expect(ehDiaUtil('2026-06-04')).toBe(false) // Corpus Christi
    expect(ehDiaUtil('2027-01-20')).toBe(false) // recesso
    expect(emRecesso('2026-12-20')).toBe(true)
    expect(emRecesso('2026-12-19')).toBe(false)
    expect(ehDiaUtil('2026-11-09')).toBe(true)
  })

  it('a publicação é o primeiro dia útil depois da disponibilização', () => {
    expect(diaDaPublicacao('2026-11-05')).toBe('2026-11-06')
    expect(diaDaPublicacao('2026-11-06')).toBe('2026-11-09') // sexta → segunda
    expect(proximoDiaUtil('2026-11-19')).toBe('2026-11-23') // pula o feriado de sexta
  })

  it('conta dias úteis a partir do dia seguinte à publicação', () => {
    // Disponibilizada 05/11 (qui), publicada 06/11 (sex), prazo de 15 dias
    // úteis começa 09/11 e pula o feriado de 20/11.
    expect(vencimentoDoPrazo('2026-11-05', 15, 'uteis')).toBe('2026-11-30')
    expect(vencimentoDoPrazo('2026-11-05', 1, 'uteis')).toBe('2026-11-09')
  })

  it('suspende a contagem no recesso de fim de ano', () => {
    expect(vencimentoDoPrazo('2026-12-15', 5, 'uteis')).toBe('2027-01-25')
  })

  it('em dias corridos, o vencimento em dia não útil passa para o próximo útil', () => {
    expect(vencimentoDoPrazo('2026-11-05', 10, 'corridos')).toBe('2026-11-16')
    expect(vencimentoDoPrazo('2026-11-05', 8, 'corridos')).toBe('2026-11-16') // cairia num sábado
  })

  it('recusa quantidade absurda', () => {
    expect(vencimentoDoPrazo('2026-11-05', 0, 'uteis')).toBeNull()
    expect(vencimentoDoPrazo('2026-11-05', 2.5, 'uteis')).toBeNull()
    expect(vencimentoDoPrazo('2026-11-05', 1000, 'uteis')).toBeNull()
  })
})

const ITEM = {
  id: 900000001,
  data_disponibilizacao: '2026-11-05',
  siglaTribunal: 'TJSP',
  tipoComunicacao: 'Intimação',
  nomeOrgao: '1ª Vara Cível',
  texto: 'Processo 0000000-00.2026.8.26.0000<br>Intime-se o autor para&nbsp;réplica.',
  numero_processo: '00000000020268260000',
  link: 'https://exemplo.invalido/doc',
  tipoDocumento: 'Despacho',
  nomeClasse: 'Procedimento Comum Cível',
  ativo: true,
  hash: 'abc',
}

describe('leitura do DJEN', () => {
  it('lê a página e limpa o HTML do texto', () => {
    const lida = lerPagina({ status: 'success', count: 1, items: [ITEM] })
    expect(lida?.total).toBe(1)
    expect(lida?.itens[0]).toMatchObject({
      idDjen: '900000001',
      disponibilizacao: '2026-11-05',
      numeroProcesso: '00000000020268260000',
      tipoDocumento: 'Despacho',
      texto: 'Processo 0000000-00.2026.8.26.0000\nIntime-se o autor para réplica.',
    })
  })

  it('descarta item cancelado ou malformado sem derrubar os outros', () => {
    const lida = lerPagina({
      count: 3,
      items: [ITEM, { ...ITEM, id: 2, ativo: false }, { id: 3, siglaTribunal: 'TJSP' }],
    })
    expect(lida?.itens.map((i) => i.idDjen)).toEqual(['900000001'])
  })

  it('resposta fora do formato vira null', () => {
    expect(lerPagina({ mensagem: 'erro' })).toBeNull()
    expect(lerPagina(null)).toBeNull()
  })

  it('limparTexto junta espaços e respeita parágrafos', () => {
    expect(limparTexto('<p>A</p><p>B</p>')).toBe('A\nB')
    expect(limparTexto('a   b')).toBe('a b')
  })

  it('pagina até o total e manda OAB e período na URL', async () => {
    const urls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: URL) => {
        urls.push(String(url))
        const pagina = Number(url.searchParams.get('pagina'))
        const itens = Array.from({ length: pagina === 1 ? 100 : 20 }, (_, i) => ({
          ...ITEM,
          id: pagina * 1000 + i,
        }))
        return new Response(JSON.stringify({ count: 120, items: itens }), { status: 200 })
      }),
    )

    const resultado = await consultarPorOab({ numero: '378.532', uf: 'sp' }, '2026-11-01', '2026-11-05')
    expect(resultado.ok && resultado.itens.length).toBe(120)
    expect(urls).toHaveLength(2)
    expect(urls[0]).toContain('numeroOab=378532')
    expect(urls[0]).toContain('ufOab=SP')
    expect(urls[0]).toContain('dataDisponibilizacaoInicio=2026-11-01')
  })

  it('limite de consultas e falha de rede viram erro descrito, sem lançar', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 429 })))
    const limitado = await consultarPorOab({ numero: '1', uf: 'SP' }, '2026-11-01', '2026-11-05')
    expect(limitado).toEqual({ ok: false, erro: expect.stringContaining('limite') })

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed')
      }),
    )
    const fora = await consultarPorOab({ numero: '1', uf: 'SP' }, '2026-11-01', '2026-11-05')
    expect(fora.ok).toBe(false)
  })
})

describe('junção das OABs', () => {
  it('a mesma comunicação em duas OABs vira uma, com as duas OABs', () => {
    const comunicacao = lerPagina({ count: 1, items: [ITEM] })?.itens[0] as ComunicacaoDoDjen
    const juntas = juntarPorComunicacao([
      { oab: 'SP378532', itens: [comunicacao] },
      { oab: 'SP453976', itens: [comunicacao] },
    ])
    expect(juntas.size).toBe(1)
    expect(juntas.get('900000001')?.oabs).toEqual(['SP378532', 'SP453976'])
    expect(chaveDaOab('378.532', 'sp')).toBe('SP378532')
  })
})

const ANALISE: AnaliseDaPublicacao = {
  tipo: 'intimacao',
  resumo: 'O juiz intimou o autor para réplica.',
  providencia: 'Apresentar réplica à contestação',
  exigeManifestacao: true,
  prazoEmDias: 15,
  contagem: 'uteis',
  dataDaAudiencia: null,
  textoParaCliente: 'O processo seguiu: vamos responder à defesa da outra parte.',
}

describe('análise da IA', () => {
  it('aceita a resposta no formato e calcula o prazo no portal, não na IA', () => {
    const analise = lerAnalise(ANALISE)
    expect(analise).not.toBeNull()
    expect(prazoSugerido(analise as AnaliseDaPublicacao, '2026-11-05')).toBe('2026-11-30')
  })

  it('audiência designada vira o prazo sugerido', () => {
    expect(prazoSugerido({ ...ANALISE, dataDaAudiencia: '2026-12-02' }, '2026-11-05')).toBe('2026-12-02')
  })

  it('sem prazo, sem sugestão', () => {
    expect(prazoSugerido({ ...ANALISE, prazoEmDias: null, contagem: null }, '2026-11-05')).toBeNull()
  })

  it('recusa resposta fora do formato', () => {
    expect(lerAnalise({ ...ANALISE, tipo: 'qualquer' })).toBeNull()
    expect(lerAnalise({ ...ANALISE, prazoEmDias: -3 })).toBeNull()
    expect(lerAnalise('texto solto')).toBeNull()
  })

  it('o esquema não usa o que a Anthropic recusa', () => {
    // HTTP 400 "Invalid schema" de 09/11/2026: enum dentro de tipo misto
    // (`type: ['string', 'null']`). Toda propriedade com enum tem tipo único.
    const problemas: string[] = []
    const visitar = (no: unknown, caminho: string): void => {
      if (typeof no !== 'object' || no === null) return
      const n = no as Record<string, unknown>
      if (Array.isArray(n['enum']) && Array.isArray(n['type'])) problemas.push(caminho)
      if (n['type'] === 'object' && n['additionalProperties'] !== false) problemas.push(`${caminho} (additionalProperties)`)
      for (const [chave, valor] of Object.entries(n)) visitar(valor, `${caminho}.${chave}`)
    }
    visitar(ESQUEMA_DA_ANALISE, 'esquema')
    expect(problemas).toEqual([])
  })

  it('lê o objeto da Anthropic e da OpenAI', () => {
    expect(
      lerRespostaDaAnthropic({
        content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: JSON.stringify(ANALISE) }],
      }),
    ).toEqual(ANALISE)
    expect(lerRespostaDaAnthropic({ content: [{ type: 'text', text: 'não é json' }] })).toBeNull()
    expect(lerRespostaDaOpenai({ choices: [{ message: { content: JSON.stringify(ANALISE) } }] })).toEqual(ANALISE)
    expect(lerRespostaDaOpenai({ choices: [{ message: { content: 'não é json' } }] })).toBeNull()
  })

  it('sem chave, a IA fica desligada e não chama ninguém', async () => {
    vi.stubEnv('IA_PROVEDOR', '')
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    const chamada = vi.fn()
    vi.stubGlobal('fetch', chamada)
    expect(iaConfigurada()).toBe(false)
    const resposta = await pedirObjeto({ sistema: 's', usuario: 'u', nome: 'n', descricao: 'd', esquema: {} })
    expect(resposta.ok).toBe(false)
    expect(chamada).not.toHaveBeenCalled()
  })

  it('OpenAI sem modelo definido conta como desligada', () => {
    vi.stubEnv('IA_PROVEDOR', 'openai')
    vi.stubEnv('OPENAI_API_KEY', 'sk-teste')
    vi.stubEnv('IA_MODELO', '')
    expect(iaConfigurada()).toBe(false)
  })

  it('a recusa traz o motivo do provedor, e falta de saldo ganha dica', () => {
    const semSaldo = {
      type: 'error',
      error: { type: 'invalid_request_error', message: 'Your credit balance is too low to access the Anthropic API.' },
    }
    expect(descreverRecusa('Anthropic', 400, semSaldo, 'sk-x')).toMatch(/^Anthropic respondeu HTTP 400: sem saldo/)
    expect(
      descreverRecusa('Anthropic', 404, { error: { message: 'model: claude-x not found' } }, 'sk-x'),
    ).toBe('Anthropic respondeu HTTP 404: model: claude-x not found')
    expect(descreverRecusa('OpenAI', 500, null, 'sk-x')).toBe('OpenAI respondeu HTTP 500.')
    expect(
      descreverRecusa('OpenAI', 401, { error: { message: 'Incorrect API key provided: sk-segredo' } }, 'sk-segredo'),
    ).not.toContain('sk-segredo')
  })

  it('manda o workspace da Anthropic só quando configurado', async () => {
    vi.stubEnv('IA_PROVEDOR', 'anthropic')
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-teste')
    const cabecalhos: Record<string, string>[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        cabecalhos.push(init.headers as Record<string, string>)
        return new Response('{}', { status: 500 })
      }),
    )
    const pedido = { sistema: 's', usuario: 'u', nome: 'n', descricao: 'd', esquema: {} }

    vi.stubEnv('ANTHROPIC_WORKSPACE_ID', '')
    await pedirObjeto(pedido)
    vi.stubEnv('ANTHROPIC_WORKSPACE_ID', 'wrkspc_123')
    await pedirObjeto(pedido)

    expect(cabecalhos[0]).not.toHaveProperty('anthropic-workspace-id')
    expect(cabecalhos[1]).toHaveProperty('anthropic-workspace-id', 'wrkspc_123')
  })

  it('a chave não aparece na mensagem de erro', async () => {
    vi.stubEnv('IA_PROVEDOR', 'anthropic')
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-segredo-que-nao-pode-vazar')
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"x"}', { status: 401 })))
    const resposta = await pedirObjeto({ sistema: 's', usuario: 'u', nome: 'n', descricao: 'd', esquema: {} })
    expect(resposta.ok).toBe(false)
    expect(JSON.stringify(resposta)).not.toContain('segredo-que-nao-pode-vazar')
  })
})
