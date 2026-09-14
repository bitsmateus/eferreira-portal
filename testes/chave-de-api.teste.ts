import { afterEach, describe, expect, it } from 'vitest'

import {
  CARACTERES_DO_IDENTIFICADOR,
  PREFIXO_PRODUCAO,
  PREFIXO_TESTES,
  chaveDoCabecalho,
  gerarChave,
  hashDoSegredo,
  lerChave,
  mascarar,
  prefixoDoAmbiente,
  segredoConfere,
} from '@/lib/chave-de-api'
import { validarCredencial } from '@/lib/credenciais'

describe('gerarChave', () => {
  it('monta a chave nas três partes, e o segredo não sobra em lugar nenhum', () => {
    const nova = gerarChave(PREFIXO_PRODUCAO)

    expect(nova.chave.startsWith(PREFIXO_PRODUCAO)).toBe(true)
    expect(nova.chave).toContain(`${nova.identificador}_`)

    const lida = lerChave(nova.chave)
    expect(lida).not.toBeNull()
    expect(lida?.identificador).toBe(nova.identificador)

    // O que vai para o banco é só o hash: o segredo não aparece nele.
    expect(nova.segredoHash).not.toContain(lida?.segredo ?? 'impossível')
    expect(nova.segredoHash).toHaveLength(64)
  })

  it('o final guardado é mesmo o fim do segredo', () => {
    const nova = gerarChave(PREFIXO_TESTES)
    const lida = lerChave(nova.chave)
    expect(lida?.segredo.endsWith(nova.final)).toBe(true)
    expect(nova.final).toHaveLength(4)
  })

  it('nunca repete', () => {
    const chaves = new Set(Array.from({ length: 200 }, () => gerarChave().chave))
    expect(chaves.size).toBe(200)
  })

  /**
   * Este teste nasceu de um defeito de verdade: com identificador em
   * base64url, de vez em quando ele saía com um `_` no meio — o mesmo
   * caractere que separa as partes — e a chave era recusada sem motivo
   * aparente. Daí o alfabeto hexadecimal, e daí as 300 repetições.
   */
  it('o identificador é hexadecimal e de tamanho fixo, sempre', () => {
    for (let i = 0; i < 300; i += 1) {
      const nova = gerarChave()
      expect(nova.identificador).toHaveLength(CARACTERES_DO_IDENTIFICADOR)
      expect(nova.identificador).toMatch(/^[0-9a-f]+$/)
      expect(lerChave(nova.chave)?.identificador).toBe(nova.identificador)
    }
  })

  it('o segredo com `_` dentro continua sendo lido inteiro', () => {
    // base64url tem `_` no alfabeto, então isto acontece sozinho na prática.
    const chave = `${PREFIXO_TESTES}0123456789abcdef_ab_cd-ef_gh`
    expect(lerChave(chave)?.segredo).toBe('ab_cd-ef_gh')
  })
})

describe('lerChave', () => {
  it('recusa o que não tem a forma certa, sem dizer qual parte falhou', () => {
    const impossiveis = [
      '',
      'Bearer',
      'ef_live_',
      'ef_live_semseparador',
      'ef_live_curto_abc',
      'chave_de_outro_sistema_123456',
      // Identificador com tamanho errado, ainda que o resto pareça certo.
      'ef_live_a1b2c3_abcdefghijklmnop',
      // Tamanho certo, alfabeto errado.
      'ef_live_ZZZZZZZZZZZZZZZZ_abcdefghijklmnop',
    ]

    for (const impossivel of impossiveis) {
      expect(lerChave(impossivel)).toBeNull()
    }
  })

  it('tolera espaço em volta — copiar e colar cola espaço junto', () => {
    const nova = gerarChave(PREFIXO_TESTES)
    expect(lerChave(`  ${nova.chave}  `)?.identificador).toBe(nova.identificador)
  })
})

describe('segredoConfere', () => {
  it('confere o segredo certo e recusa o errado', () => {
    const hash = hashDoSegredo('segredo-de-verdade')
    expect(segredoConfere('segredo-de-verdade', hash)).toBe(true)
    expect(segredoConfere('segredo-de-mentira', hash)).toBe(false)
  })

  it('não estoura com hash de tamanho diferente', () => {
    expect(segredoConfere('qualquer', 'curto')).toBe(false)
    expect(segredoConfere('qualquer', '')).toBe(false)
  })
})

describe('mascarar', () => {
  it('mostra só o ambiente e os quatro últimos', () => {
    const mascarada = mascarar(PREFIXO_PRODUCAO, '4c21')
    expect(mascarada).toBe('ef_live_••••••4c21')
    expect(mascarada).not.toMatch(/[a-z0-9]{10}/)
  })
})

describe('chaveDoCabecalho', () => {
  it('lê o formato Bearer, sem ligar para maiúscula', () => {
    expect(chaveDoCabecalho('Bearer ef_live_abc')).toBe('ef_live_abc')
    expect(chaveDoCabecalho('bearer ef_live_abc')).toBe('ef_live_abc')
    expect(chaveDoCabecalho('  Bearer   ef_live_abc  ')).toBe('ef_live_abc')
  })

  it('recusa cabeçalho ausente ou de outro esquema', () => {
    expect(chaveDoCabecalho(null)).toBeNull()
    expect(chaveDoCabecalho('')).toBeNull()
    expect(chaveDoCabecalho('Basic dXNlcjpzZW5oYQ==')).toBeNull()
    expect(chaveDoCabecalho('ef_live_abc')).toBeNull()
    expect(chaveDoCabecalho('Bearer')).toBeNull()
  })
})

describe('prefixoDoAmbiente', () => {
  const original = process.env['AMBIENTE_DA_API']

  afterEach(() => {
    if (original === undefined) delete process.env['AMBIENTE_DA_API']
    else process.env['AMBIENTE_DA_API'] = original
  })

  it('só "producao" gera chave de produção', () => {
    process.env['AMBIENTE_DA_API'] = 'producao'
    expect(prefixoDoAmbiente()).toBe(PREFIXO_PRODUCAO)
  })

  /**
   * Instalação mal configurada tem de errar para o lado inofensivo: uma chave
   * que não vale em produção atrapalha um integrador; uma que vale sem
   * ninguém ter pedido atrapalha um cliente.
   */
  it('qualquer outro valor, inclusive vazio, gera chave de testes', () => {
    for (const valor of ['', 'homologacao', 'PRODUCAO', 'prod', 'teste']) {
      process.env['AMBIENTE_DA_API'] = valor
      expect(prefixoDoAmbiente()).toBe(PREFIXO_TESTES)
    }

    delete process.env['AMBIENTE_DA_API']
    expect(prefixoDoAmbiente()).toBe(PREFIXO_TESTES)
  })
})

describe('validarCredencial', () => {
  it('aceita nome e permissões conhecidas', () => {
    const resultado = validarCredencial({
      nome: 'Site institucional',
      permissoes: ['CONSULTAR'],
    })

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    expect(resultado.dados.permissoes).toEqual(['CONSULTAR'])
  })

  // O navegador manda o que quiser nos checkboxes.
  it('descarta permissão inventada em vez de gravá-la', () => {
    const resultado = validarCredencial({
      nome: 'Integração curiosa',
      permissoes: ['CONSULTAR', 'APAGAR_TUDO', 'ADMINISTRAR'],
    })

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    expect(resultado.dados.permissoes).toEqual(['CONSULTAR'])
  })

  it('recusa credencial sem permissão nenhuma', () => {
    const resultado = validarCredencial({ nome: 'Chave inútil', permissoes: [] })
    expect(resultado.ok).toBe(false)
    if (resultado.ok) return
    expect(resultado.erros['permissoes']).toMatch(/permissão/i)
  })

  it('recusa nome curto demais para dizer quem usa a chave', () => {
    const resultado = validarCredencial({ nome: 'x', permissoes: ['CONSULTAR'] })
    expect(resultado.ok).toBe(false)
  })
})
