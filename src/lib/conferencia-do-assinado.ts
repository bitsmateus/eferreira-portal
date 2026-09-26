/**
 * Conferir que o PDF que voltou da D4Sign é o documento ASSINADO COMPLETO —
 * e não só a página do certificado de assinaturas.
 *
 * O escritório reportou (25/09/2026) que o download dos documentos assinados
 * trazia só o certificado. O portal arquiva o que a D4Sign devolve; sem uma
 * conferência, um arquivo errado entrava na pasta do cliente como "assinado",
 * e o original (com o texto do contrato) ficava sem versão assinada.
 *
 * A regra é simples e não depende do formato do certificado: o assinado tem
 * que ter, no mínimo, as mesmas páginas do original que foi enviado, e o texto
 * do começo do original tem que estar nele.
 */

export type ResumoDoPdf = {
  paginas: number
  /** O texto das primeiras páginas: só letras e dígitos, em minúscula. */
  textoDoInicio: string
}

async function abrir(pdf: Uint8Array) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  return pdfjs.getDocument({ data: new Uint8Array(pdf), useSystemFonts: true, verbosity: 0 }).promise
}

function normalizar(texto: string): string {
  // Só letras e dígitos: espaço, hífen de quebra e pontuação mudam de um leitor
  // de PDF para outro e não podem reprovar um documento bom.
  return texto.toLocaleLowerCase('pt-BR').replace(/[^\p{L}\p{N}]/gu, '')
}

export async function resumirPdf(pdf: Uint8Array): Promise<ResumoDoPdf> {
  const documento = await abrir(pdf)

  let texto = ''
  const ate = Math.min(documento.numPages, 2)
  for (let numero = 1; numero <= ate; numero += 1) {
    const pagina = await documento.getPage(numero)
    const conteudo = await pagina.getTextContent()
    texto += ` ${conteudo.items.map((item) => ('str' in item ? item.str : '')).join(' ')}`
  }

  const resumo = { paginas: documento.numPages, textoDoInicio: normalizar(texto) }
  await documento.cleanup()
  return resumo
}

export type VereditoDoAssinado = { completo: true } | { completo: false; motivo: string }

/** Quantos caracteres do começo do original têm que aparecer no assinado. */
const TRECHO_CONFERIDO = 60

export function assinadoEstaCompleto(original: ResumoDoPdf, assinado: ResumoDoPdf): VereditoDoAssinado {
  if (assinado.paginas < original.paginas) {
    return {
      completo: false,
      motivo: `O arquivo da D4Sign tem ${assinado.paginas} página(s) e o documento enviado tem ${original.paginas}: parece ser só o certificado de assinaturas.`,
    }
  }

  // Sem texto no original (digitalização em imagem) não há o que comparar: a
  // conferência de páginas acima é tudo o que dá para exigir.
  const trecho = original.textoDoInicio.slice(0, TRECHO_CONFERIDO)
  if (trecho.length >= 20 && !assinado.textoDoInicio.includes(trecho)) {
    return {
      completo: false,
      motivo:
        'O arquivo da D4Sign não traz o começo do documento enviado: parece ser só o certificado de assinaturas.',
    }
  }

  return { completo: true }
}
