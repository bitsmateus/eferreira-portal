import { describe, expect, it } from 'vitest'
import {
  diaEmSaoPaulo,
  formatarData,
  formatarDataExtenso,
  formatarDataHora,
  formatarDiaPorExtensoComSemana,
} from '@/lib/datas'

/**
 * Regra 11: guardar em UTC, exibir e calcular em America/Sao_Paulo.
 * Os casos abaixo usam instantes que caem em dias diferentes nos dois fusos —
 * é onde o erro aparece.
 */
describe('formatação no fuso de São Paulo', () => {
  it('formata a data de um instante do meio do dia', () => {
    expect(formatarData(new Date('2026-08-31T12:00:00.000Z'))).toBe('31/08/2026')
  })

  it('um instante já do dia seguinte em UTC ainda é o dia anterior em São Paulo', () => {
    // 01/01/2026 02:00 UTC = 31/12/2025 23:00 em São Paulo (UTC-3).
    const virada = new Date('2026-01-01T02:00:00.000Z')
    expect(formatarData(virada)).toBe('31/12/2025')
    expect(diaEmSaoPaulo(virada)).toBe('2025-12-31')
  })

  it('formata data e hora', () => {
    // 12:12 UTC = 09:12 em São Paulo — a hora do andamento do protótipo.
    expect(formatarDataHora(new Date('2026-08-31T12:12:00.000Z'))).toBe(
      '31/08/2026, 09:12',
    )
  })

  it('normaliza a meia-noite para 00, não 24', () => {
    // 03:00 UTC = 00:00 em São Paulo.
    expect(formatarDataHora(new Date('2026-08-31T03:00:00.000Z'))).toBe(
      '31/08/2026, 00:00',
    )
  })

  it('escreve a data por extenso como na área do cliente', () => {
    expect(formatarDataExtenso(new Date('2026-08-31T12:00:00.000Z'))).toBe(
      '31 de agosto de 2026',
    )
    expect(formatarDataExtenso(new Date('2026-07-03T12:00:00.000Z'))).toBe(
      '3 de julho de 2026',
    )
  })

  it('escreve o subtítulo do painel com o dia da semana', () => {
    // 31/08/2026 é uma segunda-feira, como no protótipo.
    expect(
      formatarDiaPorExtensoComSemana(new Date('2026-08-31T12:00:00.000Z')),
    ).toBe('Segunda-feira, 31 de agosto de 2026')
  })

  it('não depende do fuso do servidor', () => {
    const fusoOriginal = process.env['TZ']
    try {
      process.env['TZ'] = 'UTC'
      expect(formatarData(new Date('2026-01-01T02:00:00.000Z'))).toBe('31/12/2025')
      process.env['TZ'] = 'Asia/Tokyo'
      expect(formatarData(new Date('2026-01-01T02:00:00.000Z'))).toBe('31/12/2025')
    } finally {
      if (fusoOriginal === undefined) {
        delete process.env['TZ']
      } else {
        process.env['TZ'] = fusoOriginal
      }
    }
  })
})
