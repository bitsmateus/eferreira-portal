import { describe, expect, it } from 'vitest'

import { validarEvento } from '@/lib/eventos'

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
    responsavelId: 'responsavel-1',
    assunto: 'Protocolar recurso',
    prazoDeEntrega: hojeEmSaoPaulo(5),
    ...troca,
  } as Parameters<typeof validarEvento>[0]
}

describe('validarEvento', () => {
  it('aceita um evento completo', () => {
    const resultado = validarEvento(campos())

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(resultado.dados.responsavelId).toBe('responsavel-1')
    expect(resultado.dados.assunto).toBe('Protocolar recurso')
    expect(resultado.dados.prazoDeEntrega).toBeInstanceOf(Date)
  })

  it('exige o responsável', () => {
    const resultado = validarEvento(campos({ responsavelId: '' }))

    expect(resultado.ok).toBe(false)
    if (resultado.ok) return

    expect(resultado.erros['responsavelId']).toMatch(/responsável/i)
  })

  it('recusa assunto curto demais', () => {
    expect(validarEvento(campos({ assunto: 'ok' })).ok).toBe(false)
  })

  it('recusa assunto só de espaços', () => {
    expect(validarEvento(campos({ assunto: '        ' })).ok).toBe(false)
  })

  it('recusa assunto longo demais', () => {
    expect(validarEvento(campos({ assunto: 'a'.repeat(181) })).ok).toBe(false)
  })

  it('tira espaço sobrando do assunto', () => {
    const resultado = validarEvento(campos({ assunto: '   Audiência de instrução   ' }))

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(resultado.dados.assunto).toBe('Audiência de instrução')
  })

  it('exige o prazo de entrega', () => {
    const resultado = validarEvento(campos({ prazoDeEntrega: '' }))

    expect(resultado.ok).toBe(false)
    if (resultado.ok) return

    expect(resultado.erros['prazoDeEntrega']).toMatch(/prazo/i)
  })

  it('recusa data inexistente', () => {
    expect(validarEvento(campos({ prazoDeEntrega: '2026-02-30' })).ok).toBe(false)
  })

  // Prazo é compromisso futuro — mas um lançamento atrasado (prazo que já
  // passou e só foi registrado depois) não é um caso proibido como o do
  // andamento, cujo texto é prova do que já aconteceu.
  it('aceita prazo no passado — lançamento feito depois do vencimento', () => {
    expect(validarEvento(campos({ prazoDeEntrega: '2025-03-14' })).ok).toBe(true)
  })

  it('aceita prazo no futuro', () => {
    expect(validarEvento(campos({ prazoDeEntrega: hojeEmSaoPaulo(30) })).ok).toBe(true)
  })

  it('junta os erros de campos diferentes em uma resposta só', () => {
    const resultado = validarEvento(
      campos({ responsavelId: '', assunto: 'x', prazoDeEntrega: '' }),
    )

    expect(resultado.ok).toBe(false)
    if (resultado.ok) return

    expect(Object.keys(resultado.erros).sort()).toEqual([
      'assunto',
      'prazoDeEntrega',
      'responsavelId',
    ])
  })
})
