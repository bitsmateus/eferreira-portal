/**
 * Anexar vários arquivos de uma vez (25/09/2026): a conferência da lista
 * inteira, antes de gravar qualquer coisa.
 */

import { describe, expect, it } from 'vitest'

import {
  LIMITE_DE_ARQUIVOS_POR_ENVIO,
  TAMANHO_MAXIMO_BYTES,
} from '@/lib/arquivos'
import { validarArquivos } from '@/lib/documentos'

const pdf = (nome: string, tamanho = 10) =>
  new File([new Uint8Array(tamanho)], nome, { type: 'application/pdf' })

describe('validarArquivos', () => {
  it('aceita vários arquivos e devolve cada um com nome e tipo', () => {
    const resultado = validarArquivos([pdf('a.pdf'), pdf('b.pdf')])

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    expect(resultado.dados.map((item) => item.nome)).toEqual(['a.pdf', 'b.pdf'])
    expect(resultado.dados[0]?.tipoConteudo).toBe('application/pdf')
  })

  it('lista vazia (ou só arquivos vazios) pede para escolher', () => {
    expect(validarArquivos([]).ok).toBe(false)
    expect(validarArquivos([pdf('vazio.pdf', 0)]).ok).toBe(false)
  })

  it('um arquivo ruim recusa o lote inteiro, dizendo qual é', () => {
    const resultado = validarArquivos([
      pdf('bom.pdf'),
      new File([new Uint8Array(5)], 'programa.exe', { type: 'application/x-msdownload' }),
    ])

    expect(resultado.ok).toBe(false)
    if (resultado.ok) return
    expect(resultado.mensagem).toContain('"programa.exe"')
    expect(resultado.mensagem).toMatch(/não aceito/i)
  })

  it('cada arquivo respeita o limite individual', () => {
    const resultado = validarArquivos([pdf('enorme.pdf', TAMANHO_MAXIMO_BYTES + 1)])

    expect(resultado.ok).toBe(false)
    if (resultado.ok) return
    expect(resultado.mensagem).toContain('"enorme.pdf"')
  })

  it('há um teto de quantidade por envio', () => {
    const muitos = Array.from({ length: LIMITE_DE_ARQUIVOS_POR_ENVIO + 1 }, (_, i) => pdf(`${i}.pdf`))
    const resultado = validarArquivos(muitos)

    expect(resultado.ok).toBe(false)
    if (resultado.ok) return
    expect(resultado.mensagem).toContain(String(LIMITE_DE_ARQUIVOS_POR_ENVIO))
  })
})
