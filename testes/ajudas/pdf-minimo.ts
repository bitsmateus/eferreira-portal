/**
 * Um PDF de verdade, mínimo, com texto em posições conhecidas — para testar a
 * leitura das marcas de assinatura sem precisar do Chromium.
 *
 * `paginas` é uma lista de páginas A4; cada página, uma lista de textos com
 * a posição em PONTOS a partir do canto INFERIOR esquerdo (como o PDF guarda).
 */
export type TextoNoPdf = { texto: string; x: number; y: number }

export function pdfMinimo(paginas: readonly (readonly TextoNoPdf[])[]): Uint8Array {
  const objetos: string[] = []
  // 1 = catálogo, 2 = páginas, 3 = fonte; depois, por página: página + conteúdo.
  const idsDasPaginas = paginas.map((_, i) => 4 + i * 2)

  objetos[1] = '<< /Type /Catalog /Pages 2 0 R >>'
  objetos[2] = `<< /Type /Pages /Kids [${idsDasPaginas.map((id) => `${id} 0 R`).join(' ')}] /Count ${paginas.length} >>`
  objetos[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'

  paginas.forEach((textos, i) => {
    const idPagina = 4 + i * 2
    const idConteudo = idPagina + 1
    const fluxo = textos
      .map((t) => `BT /F1 10 Tf ${t.x} ${t.y} Td (${t.texto}) Tj ET`)
      .join('\n')
    objetos[idPagina] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents ${idConteudo} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`
    objetos[idConteudo] = `<< /Length ${fluxo.length} >>\nstream\n${fluxo}\nendstream`
  })

  let saida = '%PDF-1.4\n'
  const posicoes: number[] = []
  for (let id = 1; id < objetos.length; id += 1) {
    posicoes[id] = saida.length
    saida += `${id} 0 obj\n${objetos[id]}\nendobj\n`
  }

  const inicioDaTabela = saida.length
  saida += `xref\n0 ${objetos.length}\n0000000000 65535 f \n`
  for (let id = 1; id < objetos.length; id += 1) {
    saida += `${String(posicoes[id]).padStart(10, '0')} 00000 n \n`
  }
  saida += `trailer\n<< /Size ${objetos.length} /Root 1 0 R >>\nstartxref\n${inicioDaTabela}\n%%EOF\n`

  return new TextEncoder().encode(saida)
}
