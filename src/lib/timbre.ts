/**
 * O papel timbrado dos documentos gerados — regra 10: "com a logo no cabeçalho
 * e no rodapé".
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ESTE É O TIMBRE DE VERDADE DO ESCRITÓRIO
 *
 * Ele não foi desenhado aqui: veio dentro do `.docx` da procuração enviada em
 * 14/09/2026, como imagem de fundo de página inteira. É o mesmo arquivo que o
 * escritório usa no Word — monograma no alto, marca d'água ao centro, e no pé
 * o nome do advogado, a OAB, o telefone, o e-mail e o site.
 *
 * Por isso a dependência 3.2 fecha sem arquivo novo: o escritório já disse que
 * "a logo e a identidade visual é o que já está", e o que já está é isto.
 *
 * Como o rodapé impresso traz telefone, e-mail e site, esses três dados
 * aparecem no documento pela IMAGEM, e não por marcador. Se mudarem, é a
 * imagem que precisa ser trocada — `src/lib/escritorio.ts` sozinho não basta.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * A imagem entra embutida em base64 e não por caminho de arquivo. São ~76 KB
 * de texto, e em troca o HTML é autossuficiente: a prévia dentro do `iframe` e
 * o Chromium que imprime o PDF renderizam sem depender de o servidor servir um
 * arquivo estático que pode não estar lá.
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const CAMINHO = join(process.cwd(), 'src', 'modelos', 'timbre.png')

let memorizado: string | null = null

/** A imagem como `data:` URI. Lida uma vez por processo. */
export async function timbreEmBase64(): Promise<string> {
  if (memorizado !== null) return memorizado

  const bytes = await readFile(CAMINHO)
  memorizado = `data:image/png;base64,${bytes.toString('base64')}`
  return memorizado
}

/**
 * O fundo de página.
 *
 * `position: fixed` é o que faz a imagem se repetir em TODAS as páginas do
 * PDF — é assim que o Chromium trata elemento fixo ao imprimir, e é como o
 * Word repete o cabeçalho e o rodapé. Um `background-image` no `body` sairia
 * só na primeira página, e o contrato tem três.
 *
 * `aria-hidden` porque é decoração: quem usa leitor de tela não ganha nada
 * ouvindo "imagem" antes de cada documento.
 */
export function fundoTimbrado(dataUri: string): string {
  return `<img class="papel-timbrado" src="${dataUri}" alt="" aria-hidden="true">`
}
