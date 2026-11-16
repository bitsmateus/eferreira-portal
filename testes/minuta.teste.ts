import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { AreaDoCaso } from '@prisma/client'
import { describe, expect, it } from 'vitest'

import { especializacaoDoAgente, lerAgente, normalizarTexto } from '@/lib/agentes'
import { AREAS, PASTA_DA_AREA, ROTULO_DA_AREA, lerArea } from '@/lib/areas'
import { extrairTextoEFontes, montarMensagemDoStreaming } from '@/lib/ia'
import {
  MARCA_DA_NOTA,
  MINUTA_TRAVADA_MS,
  lerFontes,
  minutaEmAndamento,
  montarPedidoDaMinuta,
  separarMinutaENota,
  type DadosDaMinuta,
} from '@/lib/minuta'

const PASTA = join(process.cwd(), 'src', 'agentes')

describe('agentes do escritório', () => {
  it('há uma pasta com instruções e modelo para cada área', async () => {
    expect(new Set(AREAS)).toEqual(new Set(Object.values(AreaDoCaso)))
    for (const area of AREAS) {
      const agente = await lerAgente(area)
      expect(agente.instrucoes.startsWith('AGENTE 0')).toBe(true)
      expect(agente.especializacao.startsWith('ESCOPO ESPECIALIZADO')).toBe(true)
      expect(agente.modelo.length).toBeGreaterThan(1000)
      expect(ROTULO_DA_AREA[area]).not.toBe('')
    }
  })

  it('as petições de referência não carregam dado pessoal (LGPD)', () => {
    for (const area of AREAS) {
      const modelo = readFileSync(join(PASTA, PASTA_DA_AREA[area], 'modelo.txt'), 'utf8')
      // CPF, RG com dígitos, e-mail, CEP e Renavam: tudo virou marcador.
      expect(modelo, area).not.toMatch(/\d{3}\.\d{3}\.\d{3}[-/]\d{2}/)
      expect(modelo, area).not.toMatch(/RG[^A-Za-z[\n]{0,15}\d{5}/)
      expect(modelo, area).not.toMatch(/[\w.]+@[\w.]+/)
      expect(modelo, area).not.toMatch(/Renavam nº \d/)
      // CNPJ só o do DETRAN, órgão público citado como réu na peça de trânsito.
      const cnpjs = modelo.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g) ?? []
      expect(cnpjs.filter((c) => c !== '15.519.361/0001-16'), area).toEqual([])
    }
  })

  it('normaliza o texto que vem do Word', () => {
    expect(normalizarTexto('﻿linha 1\r\nlinha 2\r\n')).toBe('linha 1\nlinha 2')
  })

  it('separa a parte especializada do núcleo comum', () => {
    expect(especializacaoDoAgente('NÚCLEO\nESCOPO ESPECIALIZADO\nÁrea')).toBe('ESCOPO ESPECIALIZADO\nÁrea')
    expect(especializacaoDoAgente('sem marca')).toBe('sem marca')
  })

  it('só aceita área da lista', () => {
    expect(lerArea('TRABALHISTA')).toBe(AreaDoCaso.TRABALHISTA)
    expect(lerArea('trabalhista')).toBeNull()
    expect(lerArea('')).toBeNull()
    expect(lerArea(undefined)).toBeNull()
  })
})

const DADOS: DadosDaMinuta = {
  area: AreaDoCaso.CONSUMIDOR,
  hoje: '2026-11-16',
  pesquisaNaWeb: true,
  publicacao: {
    siglaTribunal: 'TJSP',
    orgao: 'Vara de teste',
    classe: null,
    tipoComunicacao: 'Intimação',
    tipoDocumento: 'Despacho',
    numeroProcesso: '00000000020268260000',
    disponibilizacao: '2026-11-10',
    texto: 'Manifeste-se a parte autora sobre a contestação.',
  },
  caso: {
    assunto: 'Cobrança indevida',
    numeroProcesso: '00000000020268260000',
    vara: null,
    parteContraria: 'Empresa Exemplo',
    cliente: 'Cliente de Teste',
  },
  analise: null,
}

describe('pedido da minuta', () => {
  const agente = { instrucoes: 'AGENTE DE TESTE', especializacao: 'ESCOPO', modelo: 'PETIÇÃO [NOME DO AUTOR]' }

  it('leva o agente, a publicação, o caso e o modelo, com a marca da nota', () => {
    const { sistema, usuario } = montarPedidoDaMinuta(agente, DADOS)
    expect(sistema.startsWith('AGENTE DE TESTE')).toBe(true)
    expect(sistema).toContain('busca e leitura de páginas na web disponíveis')
    expect(sistema).toContain('2026-11-16')
    expect(usuario).toContain('ÁREA: Consumidor')
    expect(usuario).toContain(MARCA_DA_NOTA)
    expect(usuario).toContain('Manifeste-se a parte autora')
    expect(usuario).toContain('Cliente de Teste')
    expect(usuario).toContain('PETIÇÃO [NOME DO AUTOR]')
    expect(usuario).toContain('0000000-00.2026.8.26.0000')
  })

  it('sem pesquisa, manda declarar a pesquisa pendente', () => {
    const { sistema } = montarPedidoDaMinuta(agente, { ...DADOS, pesquisaNaWeb: false })
    expect(sistema).toContain('declare a pesquisa de precedentes como pendente')
  })

  it('publicação sem caso não inventa caso', () => {
    const { usuario } = montarPedidoDaMinuta(agente, { ...DADOS, caso: null })
    expect(usuario).toContain('não está ligada a um caso')
    expect(usuario).not.toContain('Cliente de Teste')
  })
})

describe('resposta da minuta', () => {
  it('separa minuta e nota pela marca', () => {
    expect(separarMinutaENota(`PEÇA\n\n${MARCA_DA_NOTA}\nPendências`)).toEqual({ minuta: 'PEÇA', nota: 'Pendências' })
    expect(separarMinutaENota('só peça')).toEqual({ minuta: 'só peça', nota: null })
    expect(separarMinutaENota(`PEÇA\n${MARCA_DA_NOTA}\n  `)).toEqual({ minuta: 'PEÇA', nota: null })
  })

  it('lê as fontes gravadas e descarta o que não tem formato', () => {
    expect(lerFontes([{ url: 'https://stj.jus.br', titulo: 'STJ' }, { url: 1 }, 'x'])).toEqual([
      { url: 'https://stj.jus.br', titulo: 'STJ' },
    ])
    expect(lerFontes(null)).toEqual([])
  })

  it('pedido antigo demais não trava o botão', () => {
    const agora = new Date('2026-11-16T12:00:00Z')
    expect(minutaEmAndamento(null, agora)).toBe(false)
    expect(minutaEmAndamento(new Date(agora.getTime() - 60_000), agora)).toBe(true)
    expect(minutaEmAndamento(new Date(agora.getTime() - MINUTA_TRAVADA_MS - 1), agora)).toBe(false)
  })
})

describe('streaming da Anthropic', () => {
  it('remonta texto, ferramenta, raciocínio e citações a partir dos eventos', () => {
    const { conteudo, parada, erro } = montarMensagemDoStreaming([
      { type: 'message_start', message: {} },
      { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'signature_delta', signature: 'assinatura' } },
      { type: 'content_block_stop', index: 0 },
      { type: 'content_block_start', index: 1, content_block: { type: 'server_tool_use', id: 's1', name: 'web_search', input: {} } },
      { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '{"query":' } },
      { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '"tema 1082"}' } },
      { type: 'content_block_stop', index: 1 },
      {
        type: 'content_block_start',
        index: 2,
        content_block: { type: 'web_search_tool_result', tool_use_id: 's1', content: [{ type: 'web_search_result', url: 'https://stj.jus.br/a', title: 'Tema 1082' }] },
      },
      { type: 'content_block_stop', index: 2 },
      { type: 'content_block_start', index: 3, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 3, delta: { type: 'text_delta', text: 'EXCELENTÍSSIMO ' } },
      { type: 'content_block_delta', index: 3, delta: { type: 'citations_delta', citation: { url: 'https://stj.jus.br/a', title: 'Tema 1082' } } },
      { type: 'content_block_delta', index: 3, delta: { type: 'text_delta', text: 'SENHOR' } },
      { type: 'content_block_stop', index: 3 },
      { type: 'message_delta', delta: { stop_reason: 'end_turn' } },
      { type: 'message_stop' },
    ])
    expect(erro).toBeNull()
    expect(parada).toBe('end_turn')
    expect(conteudo[0]).toEqual({ type: 'thinking', thinking: '', signature: 'assinatura' })
    expect(conteudo[1]?.['input']).toEqual({ query: 'tema 1082' })
    expect(conteudo[3]?.['text']).toBe('EXCELENTÍSSIMO SENHOR')

    const { texto, fontes, buscas } = extrairTextoEFontes([conteudo])
    expect(texto).toBe('EXCELENTÍSSIMO SENHOR')
    expect(buscas).toBe(1)
    expect(fontes).toEqual([{ url: 'https://stj.jus.br/a', titulo: 'Tema 1082' }])
  })

  it('erro no meio do streaming vira mensagem', () => {
    const { erro } = montarMensagemDoStreaming([{ type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }])
    expect(erro).toBe('Overloaded')
  })

  it('junta o texto de turnos retomados depois de pause_turn', () => {
    const { texto } = extrairTextoEFontes([
      [{ type: 'text', text: 'Parte 1. ' }],
      [{ type: 'text', text: 'Parte 2.' }],
    ])
    expect(texto).toBe('Parte 1. Parte 2.')
  })
})
