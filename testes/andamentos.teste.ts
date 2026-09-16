import { describe, expect, it } from 'vitest'

import { SENTINELA_STATUS_PERSONALIZADO, validarAndamento } from '@/lib/andamentos'

function hojeEmSaoPaulo(deslocamentoEmDias = 0): string {
  const data = new Date(Date.now() + deslocamentoEmDias * 24 * 60 * 60 * 1000)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(data)
}

function campos(troca: Partial<Record<string, string>> = {}) {
  return {
    data: hojeEmSaoPaulo(),
    statusId: 'processo-distribuido',
    statusPersonalizado: '',
    descricao: 'Petição inicial distribuída à 3ª Vara Cível. Custas recolhidas.',
    ...troca,
  } as Parameters<typeof validarAndamento>[0]
}

describe('validarAndamento', () => {
  it('aceita um lançamento completo', () => {
    const resultado = validarAndamento(campos())

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(resultado.dados.statusId).toBe('processo-distribuido')
    expect(resultado.dados.data).toBeInstanceOf(Date)
  })

  it('exige a data', () => {
    const resultado = validarAndamento(campos({ data: '' }))

    expect(resultado.ok).toBe(false)
    if (resultado.ok) return

    expect(resultado.erros['data']).toMatch(/data/i)
  })

  it('recusa data inexistente', () => {
    expect(validarAndamento(campos({ data: '2026-02-30' })).ok).toBe(false)
  })

  // Andamento registra o que já aconteceu. Data futura na linha do tempo do
  // cliente seria previsão — e previsão vira promessa.
  it('recusa data no futuro', () => {
    const resultado = validarAndamento(campos({ data: hojeEmSaoPaulo(2) }))

    expect(resultado.ok).toBe(false)
    if (resultado.ok) return

    expect(resultado.erros['data']).toMatch(/futuro/i)
  })

  it('aceita a data de hoje em São Paulo, a qualquer hora', () => {
    expect(validarAndamento(campos({ data: hojeEmSaoPaulo() })).ok).toBe(true)
  })

  it('aceita data antiga — lançamento atrasado é comum', () => {
    expect(validarAndamento(campos({ data: '2025-03-14' })).ok).toBe(true)
  })

  it('exige a situação', () => {
    const resultado = validarAndamento(campos({ statusId: '' }))

    expect(resultado.ok).toBe(false)
    if (resultado.ok) return

    expect(resultado.erros['statusId']).toMatch(/situação/i)
  })

  // A descrição é o que o cliente lê. "ok" ou "andou" não informa nada.
  it('recusa descrição curta demais', () => {
    const resultado = validarAndamento(campos({ descricao: 'ok' }))

    expect(resultado.ok).toBe(false)
    if (resultado.ok) return

    expect(resultado.erros['descricao']).toMatch(/advogado/i)
  })

  it('recusa descrição só de espaços', () => {
    expect(validarAndamento(campos({ descricao: '              ' })).ok).toBe(false)
  })

  it('recusa descrição longa demais', () => {
    expect(validarAndamento(campos({ descricao: 'a'.repeat(2001) })).ok).toBe(false)
  })

  it('tira espaço sobrando da descrição', () => {
    const resultado = validarAndamento(
      campos({ descricao: '   Contestação apresentada pela parte contrária.   ' }),
    )

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(resultado.dados.descricao).toBe(
      'Contestação apresentada pela parte contrária.',
    )
  })

  it('junta os erros de campos diferentes em uma resposta só', () => {
    const resultado = validarAndamento(
      campos({ data: '', statusId: '', descricao: 'x' }),
    )

    expect(resultado.ok).toBe(false)
    if (resultado.ok) return

    expect(Object.keys(resultado.erros).sort()).toEqual([
      'data',
      'descricao',
      'statusId',
    ])
  })
})

// ---------------------------------------------------------------------------
// Situação personalizada
// ---------------------------------------------------------------------------

describe('situação personalizada', () => {
  it('exige o texto quando a sentinela é escolhida', () => {
    const resultado = validarAndamento(
      campos({ statusId: SENTINELA_STATUS_PERSONALIZADO, statusPersonalizado: '' }),
    )

    expect(resultado.ok).toBe(false)
    if (resultado.ok) return

    expect(resultado.erros['statusPersonalizado']).toMatch(/personalizada/i)
  })

  // Só de espaços é, na prática, vazio — mesma régua da descrição.
  it('só espaços conta como vazio', () => {
    const resultado = validarAndamento(
      campos({ statusId: SENTINELA_STATUS_PERSONALIZADO, statusPersonalizado: '   ' }),
    )

    expect(resultado.ok).toBe(false)
  })

  it('aceita a sentinela com texto preenchido', () => {
    const resultado = validarAndamento(
      campos({
        statusId: SENTINELA_STATUS_PERSONALIZADO,
        statusPersonalizado: '  Aguardando perícia  ',
      }),
    )

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(resultado.dados.statusPersonalizado).toBe('Aguardando perícia')
  })

  // Fora da sentinela, o texto personalizado não é olhado — pode vir
  // preenchido por acidente (campo escondido na tela) sem quebrar nada.
  it('sem a sentinela, o texto personalizado é ignorado', () => {
    const resultado = validarAndamento(
      campos({ statusId: 'processo-distribuido', statusPersonalizado: 'lixo qualquer' }),
    )

    expect(resultado.ok).toBe(true)
  })

  it('exige texto longo demais para a situação personalizada', () => {
    const resultado = validarAndamento(
      campos({
        statusId: SENTINELA_STATUS_PERSONALIZADO,
        statusPersonalizado: 'a'.repeat(61),
      }),
    )

    expect(resultado.ok).toBe(false)
  })
})
