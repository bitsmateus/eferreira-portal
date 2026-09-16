import { describe, expect, it } from 'vitest'
import { TipoDocumento } from '@prisma/client'

import { TIPOS_GERAVEIS, ehTipoGeravel, exigeCaso } from '@/lib/geracao'
import { montarPagina } from '@/lib/pdf'

describe('quais documentos o sistema gera', () => {
  it('gera contrato, procuração e declaração', () => {
    expect([...TIPOS_GERAVEIS].sort()).toEqual([
      TipoDocumento.CONTRATO,
      TipoDocumento.DECLARACAO,
      TipoDocumento.PROCURACAO,
    ])
  })

  // Anexo é arquivo que a equipe sobe, não documento que o sistema escreve.
  it('não gera anexo', () => {
    expect(ehTipoGeravel(TipoDocumento.ANEXO)).toBe(false)
  })

  it('recusa tipo que não existe', () => {
    expect(ehTipoGeravel('SENTENCA')).toBe(false)
    expect(ehTipoGeravel('')).toBe(false)
  })

  // O contrato cita o objeto da ação e os honorários; os outros dois falam só
  // do cliente.
  it('só o contrato exige um caso', () => {
    expect(exigeCaso(TipoDocumento.CONTRATO)).toBe(true)
    expect(exigeCaso(TipoDocumento.PROCURACAO)).toBe(false)
    expect(exigeCaso(TipoDocumento.DECLARACAO)).toBe(false)
  })
})

describe('montarPagina', () => {
  it('embute o CSS e declara o português', () => {
    const pagina = montarPagina(
      '<p>corpo</p>',
      'body{margin:0}',
      'Procuração',
      'data:image/png;base64,TIMBRE',
    )

    expect(pagina).toContain('<!doctype html>')
    expect(pagina).toContain('lang="pt-BR"')
    expect(pagina).toContain('<meta charset="utf-8">')
    expect(pagina).toContain('body{margin:0}')
    expect(pagina).toContain('<p>corpo</p>')
    expect(pagina).toContain('<title>Procuração</title>')
    // A marca d'água do timbre entra embutida, atrás do texto — cabeçalho e
    // rodapé vão por outro caminho (headerTemplate/footerTemplate do
    // Chromium, em src/lib/pdf.ts), não pelo corpo do HTML.
    expect(pagina).toContain('data:image/png;base64,TIMBRE')
    expect(pagina).toContain('class="marca-dagua"')
  })

  // A prévia e o PDF passam por aqui. Se a folha de estilo não entrasse, o
  // documento sairia sem formatação e ninguém notaria até imprimir.
  it('sempre traz a folha de estilo', () => {
    expect(montarPagina('<p>x</p>', '@page{size:A4}', 't', '')).toContain(
      '@page{size:A4}',
    )
  })
})
