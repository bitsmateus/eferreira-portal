import { describe, expect, it } from 'vitest'
import { SituacaoCaso } from '@prisma/client'

import { validarCaso } from '@/lib/casos'
import {
  formatarCep,
  formatarNumeroDeProcesso,
  formatarTelefone,
  normalizarNumeroDeProcesso,
} from '@/lib/formatos'

function campos(troca: Partial<Record<string, string>> = {}) {
  return {
    numeroProcesso: '0012845-63.2026.8.26.0100',
    assunto: 'Ação de cobrança',
    vara: '',
    parteContraria: '',
    situacao: SituacaoCaso.EM_ANDAMENTO,
    responsavelId: '',
    ...troca,
  } as Parameters<typeof validarCaso>[0]
}

describe('validarCaso', () => {
  it('guarda o número do processo normalizado, só com dígitos', () => {
    const resultado = validarCaso(campos())

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(resultado.dados.numeroProcesso).toBe('00128456320268260100')
  })

  // O índice único do caso é sobre esta coluna: se a máscara entrasse no
  // banco, o mesmo processo entraria duas vezes com grafias diferentes.
  it('reduz a mesma numeração com e sem máscara ao mesmo valor', () => {
    const comMascara = validarCaso(campos())
    const semMascara = validarCaso(campos({ numeroProcesso: '00128456320268260100' }))

    expect(comMascara.ok && semMascara.ok).toBe(true)
    if (!comMascara.ok || !semMascara.ok) return

    expect(comMascara.dados.numeroProcesso).toBe(semMascara.dados.numeroProcesso)
  })

  it('aceita caso sem número — fase pré-processual', () => {
    const resultado = validarCaso(campos({ numeroProcesso: '' }))

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(resultado.dados.numeroProcesso).toBeNull()
  })

  it('mantém numeração que não é CNJ como foi digitada', () => {
    const resultado = validarCaso(campos({ numeroProcesso: ' 2026/000123-PA ' }))

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(resultado.dados.numeroProcesso).toBe('2026/000123-PA')
  })

  it('recusa numeração sem nenhum dígito', () => {
    const resultado = validarCaso(campos({ numeroProcesso: 'a definir' }))

    expect(resultado.ok).toBe(false)
    if (resultado.ok) return

    expect(resultado.erros['numeroProcesso']).toMatch(/dígitos/i)
  })

  it('exige assunto — é a identificação própria do caso', () => {
    const resultado = validarCaso(campos({ assunto: '  ' }))

    expect(resultado.ok).toBe(false)
    if (resultado.ok) return

    expect(resultado.erros['assunto']).toMatch(/assunto/i)
  })

  it('recusa situação que não existe no domínio', () => {
    expect(validarCaso(campos({ situacao: 'GANHO' })).ok).toBe(false)
  })

  it('trata responsável em branco como sem responsável', () => {
    const resultado = validarCaso(campos({ responsavelId: '' }))

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(resultado.dados.responsavelId).toBeNull()
  })
})

describe('formatos', () => {
  it('formata o número do processo no padrão CNJ', () => {
    expect(formatarNumeroDeProcesso('00128456320268260100')).toBe(
      '0012845-63.2026.8.26.0100',
    )
  })

  it('devolve intacta a numeração que não é CNJ', () => {
    expect(formatarNumeroDeProcesso('2026/000123-PA')).toBe('2026/000123-PA')
    expect(normalizarNumeroDeProcesso('  2026/000123-PA  ')).toBe('2026/000123-PA')
  })

  it('formata telefone fixo e celular', () => {
    expect(formatarTelefone('11988124470')).toBe('(11) 98812-4470')
    expect(formatarTelefone('1132551090')).toBe('(11) 3255-1090')
  })

  it('devolve o telefone como veio quando não reconhece o formato', () => {
    expect(formatarTelefone('ramal 22')).toBe('ramal 22')
  })

  it('formata CEP', () => {
    expect(formatarCep('01310100')).toBe('01310-100')
    expect(formatarCep('0131010')).toBe('0131010')
  })
})

describe('validarCaso — situação (correções da revisão)', () => {
  it('trata situação em branco como "em andamento"', () => {
    const resultado = validarCaso(campos({ situacao: '' }))

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(resultado.dados.situacao).toBe(SituacaoCaso.EM_ANDAMENTO)
  })

  // Regra 1: mensagem de erro também é português. O `nativeEnum` do Zod, sem
  // errorMap, devolveria "Invalid enum value..." direto na tela.
  it('recusa situação inexistente com mensagem em português', () => {
    const resultado = validarCaso(campos({ situacao: 'GANHO' }))

    expect(resultado.ok).toBe(false)
    if (resultado.ok) return

    expect(resultado.erros['situacao']).toBe('Situação de caso inválida.')
  })

  it('aceita arquivado', () => {
    const resultado = validarCaso(campos({ situacao: SituacaoCaso.ARQUIVADO }))

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(resultado.dados.situacao).toBe(SituacaoCaso.ARQUIVADO)
  })
})
