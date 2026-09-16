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
 * `src/modelos/timbre.png` é o arquivo original, guardado como origem; nada em
 * tempo de execução o lê mais — ver o recorte em três partes, abaixo.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ─────────────────────────────────────────────────────────────────────────
 * O TIMBRE VIRA TRÊS IMAGENS, NÃO UMA (16/09/2026)
 *
 * Era uma imagem só, do tamanho da página inteira (29,7cm), presa com
 * `position: fixed` para se repetir em toda página do PDF. Funcionava na
 * primeira página e ia se deslocando nas seguintes, até o cabeçalho e o
 * rodapé aparecerem no meio do texto de um contrato de várias páginas —
 * exatamente o que o escritório reportou como documento "quebrado".
 *
 * A causa: o Chromium, ao paginar impressão, repete elemento com
 * `position: fixed` no ritmo da ÁREA ÚTIL da página (a altura entre as
 * margens, ~22,81cm aqui) — não no ritmo da FOLHA INTEIRA (29,7cm). Com a
 * imagem do tamanho da folha inteira, cada repetição avança 22,81cm enquanto
 * a próxima página física só começa 29,7cm depois: o descompasso (6,89cm por
 * página) se acumula, e por volta da quarta ou quinta página o cabeçalho e o
 * rodapé de um ciclo aparecem sobrepostos ao texto de outra página. Conferido
 * de forma empírica: inspecionando a árvore de operadores do PDF gerado, a
 * mesma imagem aparecia pintada 2 ou 3 vezes dentro da janela de uma única
 * página física, em posições que não coincidem com o início de cada folha.
 *
 * A correção separa o que é MARGEM do que é ÁREA DE TEXTO:
 *
 * - `cabecalho` e `rodape` são as faixas que vivem dentro das margens (topo e
 *   pé) e agora entram pelo `headerTemplate`/`footerTemplate` do Chromium
 *   (ver `src/lib/pdf.ts`) — o mecanismo nativo dele para repetir conteúdo em
 *   toda página impressa, sem o descompasso acima, porque não depende de
 *   `position: fixed` nem do ritmo da área útil.
 * - `marcaDagua` é a faixa central, que vive DENTRO da área de texto. Ela
 *   continua em `position: fixed` no HTML do corpo (`fundoDeMarcaDagua`,
 *   abaixo), mas agora com a ALTURA exata da área útil (22,81cm) — em vez de
 *   lutar contra o descompasso, a imagem passa a ter o mesmo tamanho do
 *   ritmo de repetição, e as duas coisas coincidem em toda página.
 *
 * As três vêm de um recorte único do arquivo original (script fora do
 * repositório), nos limites das margens já usadas pelo CSS: topo 4,14cm,
 * pé 2,75cm, o que sobra (22,81cm) é a faixa central. Cabeçalho e rodapé não
 * foram tocados — é o mesmo recorte de pixel a pixel do arquivo do
 * escritório.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ─────────────────────────────────────────────────────────────────────────
 * A MARCA D'ÁGUA FICOU MAIS FRACA (16/09/2026)
 *
 * No arquivo original, a marca d'água central chegava a 58% de escurecimento
 * (148 de 255) — forte o bastante para, num contrato de várias cláusulas,
 * cruzar bem no meio de um parágrafo e parecer um traço horizontal solto no
 * meio do texto. Pedido do escritório: mantê-la, só que bem mais sutil. A
 * faixa central (o que hoje é `timbre-marca-dagua.png`) teve a escuridão de
 * cada pixel reduzida a 25% do valor original; cabeçalho e rodapé não foram
 * tocados por essa redução.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * As imagens entram embutidas em base64 e não por caminho de arquivo. Em
 * troca o HTML é autossuficiente: a prévia dentro do `iframe` e o Chromium
 * que imprime o PDF renderizam sem depender de o servidor servir um arquivo
 * estático que pode não estar lá.
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const PASTA_MODELOS = join(process.cwd(), 'src', 'modelos')

export interface Timbre {
  /** Monograma, dentro da margem do topo (4,14cm). */
  cabecalho: string
  /** Faixa central, do tamanho exato da área útil da página (22,81cm). */
  marcaDagua: string
  /** Advogado, OAB, telefone, e-mail e site, dentro da margem do pé (2,75cm). */
  rodape: string
}

let memorizado: Timbre | null = null

async function comoDataUri(nomeDoArquivo: string): Promise<string> {
  const bytes = await readFile(join(PASTA_MODELOS, nomeDoArquivo))
  return `data:image/png;base64,${bytes.toString('base64')}`
}

/** As três faixas do timbre, como `data:` URI. Lidas uma vez por processo. */
export async function timbreEmBase64(): Promise<Timbre> {
  if (memorizado !== null) return memorizado

  const [cabecalho, marcaDagua, rodape] = await Promise.all([
    comoDataUri('timbre-cabecalho.png'),
    comoDataUri('timbre-marca-dagua.png'),
    comoDataUri('timbre-rodape.png'),
  ])

  memorizado = { cabecalho, marcaDagua, rodape }
  return memorizado
}

/**
 * A faixa central do timbre, atrás do texto do documento.
 *
 * `position: fixed` é o que faz a imagem se repetir em toda página do PDF —
 * é assim que o Chromium trata elemento fixo ao imprimir. A altura em
 * `estilo.css` (`.marca-dagua`) é a da ÁREA ÚTIL da página, de propósito: ver
 * o comentário no topo deste arquivo sobre por que isso é o que faz a
 * repetição coincidir com cada página física.
 *
 * `aria-hidden` porque é decoração: quem usa leitor de tela não ganha nada
 * ouvindo "imagem" antes de cada documento.
 */
export function fundoDeMarcaDagua(dataUri: string): string {
  return `<img class="marca-dagua" src="${dataUri}" alt="" aria-hidden="true">`
}

/**
 * ARMADILHA REGISTRADA: o Chromium empurra o `headerTemplate`/`footerTemplate`
 * ~15pt (uns 0,53cm) para DENTRO da página — uma faixa "seguro de impressora"
 * que ele reserva perto da borda física, independente da margem pedida em
 * `page.pdf({ margin })`. Sem compensar isso, o cabeçalho nasce baixo demais
 * (sobra vazio no topo da folha, e a base do cabeçalho invade a área do
 * texto) e o rodapé nasce alto demais (o espelho do mesmo problema). Medido
 * comparando a matriz de transformação da imagem no PDF gerado contra a
 * medida pedida — ver a inspeção com `pdfjs-dist` usada para diagnosticar
 * este defeito. `deslocamento` desfaz isso: negativo empurra de volta para a
 * borda (cabeçalho), positivo empurra de volta para a borda oposta (rodapé).
 */
const COMPENSACAO_DA_BORDA = '15pt'

/**
 * HTML do `headerTemplate`/`footerTemplate` do Chromium (ver `gerarPdf`, em
 * `src/lib/pdf.ts`). `altura` tem que ser a MESMA medida passada em
 * `page.pdf({ margin })` para aquele lado (topo ou pé): o quadro que o
 * Chromium monta para o cabeçalho/rodapé não estica sozinho para caber a
 * margem — um `height: 100%` na imagem herdaria de um contêiner de altura
 * automática (praticamente zero) e a imagem sairia como uma lasca de menos
 * de 1pt, quase invisível. Com a altura explícita, a imagem preenche
 * exatamente a faixa reservada.
 */
export function templateDoTimbre(
  dataUri: string,
  altura: string,
  lado: 'cabecalho' | 'rodape',
): string {
  const deslocamento = lado === 'cabecalho' ? `-${COMPENSACAO_DA_BORDA}` : COMPENSACAO_DA_BORDA
  const estilo =
    `width:21cm;height:${altura};margin:0;padding:0;display:block;object-fit:fill;` +
    `position:relative;top:${deslocamento};-webkit-print-color-adjust:exact;`
  return `<img src="${dataUri}" style="${estilo}" alt="">`
}
