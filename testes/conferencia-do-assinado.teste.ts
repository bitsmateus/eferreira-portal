/**
 * O PDF assinado que volta da D4Sign tem que ser o documento completo, não só o
 * certificado (reportado pelo escritório em 25/09/2026).
 */

import { describe, expect, it } from 'vitest'

import { assinadoEstaCompleto, resumirPdf } from '@/lib/conferencia-do-assinado'
import { pdfMinimo } from './ajudas/pdf-minimo'

const CONTRATO = [
  [{ texto: 'CONTRATO DE PRESTACAO DE SERVICOS ADVOCATICIOS Pelo presente instrumento particular', x: 50, y: 700 }],
  [{ texto: 'Clausula segunda da atuacao profissional', x: 50, y: 700 }],
]
const PAGINA_DO_CERTIFICADO = [
  { texto: 'Certificado de assinaturas Documento criado por EFERREIRA ADVOGADOS', x: 50, y: 700 },
]

describe('resumirPdf', () => {
  it('conta as páginas e traz o texto do começo, só com letras e dígitos', async () => {
    const resumo = await resumirPdf(pdfMinimo(CONTRATO))

    expect(resumo.paginas).toBe(2)
    expect(resumo.textoDoInicio.startsWith('contratodeprestacao')).toBe(true)
  })
})

describe('assinadoEstaCompleto', () => {
  it('documento + certificado: completo', async () => {
    const original = await resumirPdf(pdfMinimo(CONTRATO))
    const assinado = await resumirPdf(pdfMinimo([...CONTRATO, PAGINA_DO_CERTIFICADO]))

    expect(assinadoEstaCompleto(original, assinado)).toEqual({ completo: true })
  })

  it('o mesmo documento, com o carimbo no lugar (sem página a mais): completo', async () => {
    const original = await resumirPdf(pdfMinimo(CONTRATO))
    expect(assinadoEstaCompleto(original, original)).toEqual({ completo: true })
  })

  it('só o certificado, com menos páginas que o original: incompleto', async () => {
    const original = await resumirPdf(pdfMinimo(CONTRATO))
    const soCertificado = await resumirPdf(pdfMinimo([PAGINA_DO_CERTIFICADO]))

    const veredito = assinadoEstaCompleto(original, soCertificado)
    expect(veredito.completo).toBe(false)
    if (veredito.completo) return
    expect(veredito.motivo).toMatch(/só o certificado/)
  })

  it('só o certificado, mesmo com o mesmo número de páginas (original de uma página): incompleto', async () => {
    const original = await resumirPdf(pdfMinimo([CONTRATO[0] ?? []]))
    const soCertificado = await resumirPdf(pdfMinimo([PAGINA_DO_CERTIFICADO]))

    expect(assinadoEstaCompleto(original, soCertificado).completo).toBe(false)
  })
})
