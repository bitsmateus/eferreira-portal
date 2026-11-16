import { describe, expect, it } from 'vitest'

import { ehTitulo, minutaEmWord, paragrafosDaMinuta } from '@/lib/minuta-em-word'

describe('minuta em Word', () => {
  it('reconhece título pela linha curta em maiúsculas', () => {
    expect(ehTitulo('DOS PEDIDOS')).toBe(true)
    expect(ehTitulo('I – DOS FATOS')).toBe(true)
    expect(ehTitulo('O Reclamante foi admitido em 2022.')).toBe(false)
    expect(ehTitulo('123')).toBe(false)
  })

  it('quebra em parágrafos e separa o título do texto que vem colado nele', () => {
    expect(paragrafosDaMinuta('EXCELENTÍSSIMO SENHOR\n\nDOS FATOS\nO autor\ncontratou.\n\n\nPede deferimento.')).toEqual([
      'EXCELENTÍSSIMO SENHOR',
      'DOS FATOS',
      'O autor contratou.',
      'Pede deferimento.',
    ])
  })

  it('gera um .docx de verdade com o timbre atrás do texto', async () => {
    const arquivo = await minutaEmWord('EXCELENTÍSSIMO SENHOR\n\nTexto da peça.')
    // Um .docx é um ZIP: começa com "PK".
    expect(arquivo.subarray(0, 2).toString('latin1')).toBe('PK')
    const conteudo = arquivo.toString('latin1')
    expect(conteudo).toContain('word/media/')
    expect(conteudo).toContain('word/header')
  })
})
