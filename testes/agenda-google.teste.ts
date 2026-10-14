import { describe, expect, it } from 'vitest'

import { linkParaGoogleAgenda, somarMinutos } from '@/lib/agenda-link'
import { corpoDoEventoNaAgenda } from '@/lib/google-agenda'

const prazo = new Date('2026-10-20T12:00:00Z')

describe('somarMinutos', () => {
  it('soma e não passa da meia-noite', () => {
    expect(somarMinutos('14:30', 60)).toBe('15:30')
    expect(somarMinutos('23:30', 60)).toBe('23:59')
  })
})

describe('linkParaGoogleAgenda', () => {
  it('com horário: data e hora de São Paulo', () => {
    const url = new URL(
      linkParaGoogleAgenda({ assunto: 'Audiência', prazoDeEntrega: prazo, horario: '14:30', responsavelNome: 'Ana' }),
    )
    expect(url.searchParams.get('dates')).toBe('20261020T143000/20261020T153000')
    expect(url.searchParams.get('ctz')).toBe('America/Sao_Paulo')
    expect(url.searchParams.get('text')).toBe('Audiência')
  })

  it('sem horário: dia inteiro, fim no dia seguinte', () => {
    const url = new URL(
      linkParaGoogleAgenda({ assunto: 'Recurso', prazoDeEntrega: prazo, horario: null, responsavelNome: 'Ana' }),
    )
    expect(url.searchParams.get('dates')).toBe('20261020/20261021')
  })
})

describe('corpoDoEventoNaAgenda', () => {
  const base = { assunto: 'Audiência', prazoDeEntrega: prazo, responsavelNome: 'Ana', tituloDoCaso: 'Caso X' }

  it('com horário usa dateTime no fuso de São Paulo', () => {
    const corpo = corpoDoEventoNaAgenda({ ...base, horario: '09:00' })
    expect(corpo['start']).toEqual({ dateTime: '2026-10-20T09:00:00', timeZone: 'America/Sao_Paulo' })
    expect(corpo['end']).toEqual({ dateTime: '2026-10-20T10:00:00', timeZone: 'America/Sao_Paulo' })
  })

  it('sem horário usa date (dia inteiro)', () => {
    const corpo = corpoDoEventoNaAgenda({ ...base, horario: null })
    expect(corpo['start']).toEqual({ date: '2026-10-20' })
    expect(corpo['end']).toEqual({ date: '2026-10-21' })
  })
})
