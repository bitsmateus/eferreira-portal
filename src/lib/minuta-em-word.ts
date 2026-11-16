/**
 * A minuta em Word, no papel timbrado do escritório (pedido de 16/11/2026:
 * "sim, crie em word com o timbre").
 *
 * O timbre entra como o escritório usa no Word: a imagem da página inteira
 * (`src/modelos/timbre.png` — monograma, marca d'água e contatos no pé),
 * presa no cabeçalho, ancorada na página e atrás do texto. Assim ela se
 * repete em toda página e o advogado edita a peça por cima, sem mexer nela.
 * Margens, fonte e entrelinha são as dos documentos em PDF (`src/lib/pdf.ts`
 * e `src/modelos/estilo.css`): 4,14cm no topo, 2,75cm no pé, 3cm dos lados,
 * Times New Roman 11pt, entrelinha 1,5, justificado.
 *
 * Só a peça vai para o Word. A nota de revisão é interna à equipe e o agente
 * do escritório manda não deixar aviso interno no corpo da peça.
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import {
  AlignmentType,
  Document,
  Header,
  HorizontalPositionRelativeFrom,
  ImageRun,
  Packer,
  Paragraph,
  TextRun,
  VerticalPositionRelativeFrom,
} from 'docx'

const CM_EM_TWIPS = 567
/** A4 em twips (1/20 de ponto). */
const A4 = { largura: 11906, altura: 16838 }
/** A4 em pixels a 96 dpi — a unidade do `transformation` da biblioteca. */
const A4_EM_PIXELS = { largura: 794, altura: 1123 }

let timbreMemorizado: Buffer | null = null

async function timbre(): Promise<Buffer> {
  if (timbreMemorizado === null) {
    timbreMemorizado = await readFile(join(process.cwd(), 'src', 'modelos', 'timbre.png'))
  }
  return timbreMemorizado
}

/**
 * Linha curta toda em maiúsculas é título ("EXCELENTÍSSIMO…", "DOS PEDIDOS",
 * "I – DOS FATOS") e sai em negrito. Exportado para teste.
 */
export function ehTitulo(linha: string): boolean {
  const limpa = linha.trim()
  if (limpa.length < 3 || limpa.length > 160) return false
  if (!/[A-ZÀ-Ý]/.test(limpa)) return false
  return limpa === limpa.toUpperCase()
}

/** Quebra o texto em parágrafos: linha em branco separa, linha simples continua. Exportado para teste. */
export function paragrafosDaMinuta(texto: string): string[] {
  return texto
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .flatMap((bloco) => {
      const linhas = bloco.split('\n').map((linha) => linha.trim()).filter((linha) => linha !== '')
      // Título seguido de texto no mesmo bloco: o título vira parágrafo próprio.
      const saida: string[] = []
      let corrente: string[] = []
      for (const linha of linhas) {
        if (ehTitulo(linha)) {
          if (corrente.length > 0) saida.push(corrente.join(' '))
          corrente = []
          saida.push(linha)
        } else {
          corrente.push(linha)
        }
      }
      if (corrente.length > 0) saida.push(corrente.join(' '))
      return saida
    })
}

export async function minutaEmWord(texto: string): Promise<Buffer> {
  const imagem = await timbre()

  const cabecalho = new Header({
    children: [
      new Paragraph({
        children: [
          new ImageRun({
            type: 'png',
            data: imagem,
            transformation: { width: A4_EM_PIXELS.largura, height: A4_EM_PIXELS.altura },
            floating: {
              horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: 0 },
              verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: 0 },
              behindDocument: true,
              allowOverlap: true,
            },
            altText: { name: 'Papel timbrado', description: 'Papel timbrado do escritório', title: 'Timbre' },
          }),
        ],
      }),
    ],
  })

  const paragrafos = paragrafosDaMinuta(texto).map((conteudo) => {
    const titulo = ehTitulo(conteudo)
    return new Paragraph({
      alignment: titulo ? AlignmentType.LEFT : AlignmentType.JUSTIFIED,
      spacing: { line: 360, after: 160 },
      keepNext: titulo,
      children: [new TextRun({ text: conteudo, bold: titulo })],
    })
  })

  const documento = new Document({
    creator: 'Portal do Cliente — E. Ferreira',
    title: 'Minuta',
    styles: {
      default: { document: { run: { font: 'Times New Roman', size: 22 } } },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: A4.largura, height: A4.altura },
            margin: {
              top: Math.round(4.14 * CM_EM_TWIPS),
              bottom: Math.round(2.75 * CM_EM_TWIPS),
              left: 3 * CM_EM_TWIPS,
              right: 3 * CM_EM_TWIPS,
              header: 0,
              footer: 0,
            },
          },
        },
        headers: { default: cabecalho },
        children: paragrafos,
      },
    ],
  })

  return Packer.toBuffer(documento)
}
