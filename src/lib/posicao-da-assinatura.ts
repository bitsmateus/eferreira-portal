/**
 * Onde cada pessoa assina no PDF — para mandar à D4Sign (`addpins`).
 *
 * Sem isto a D4Sign escolhe o lugar do carimbo de assinatura sozinha, e o
 * escritório reportou (24/09/2026) que as assinaturas ficavam "fora do local
 * para assinatura" em contrato, procuração e declaração.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * COMO SE ACHA O LUGAR
 *
 * O texto de cada documento varia de tamanho, então a página e a altura do
 * bloco de assinatura mudam de documento para documento — coordenada fixa não
 * serve. Em vez disso, cada bloco de assinatura dos modelos leva uma MARCA
 * invisível (`[[assina:parte]]`, `[[assina:escritorio]]`: texto de 1px, quase
 * branco, logo acima da linha), e aqui o PDF pronto é lido para achar em que
 * página e em que ponto cada marca ficou. O que se mede é o arquivo real,
 * o mesmo que a D4Sign vai receber.
 *
 * Documento AVULSO (anexo) não tem marca: quem escolhe é o operador, na tela
 * de envio — página, lado e altura (`PosicaoEscolhida`).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * O QUE AINDA NÃO FOI CONFERIDO CONTRA A D4SIGN DE VERDADE
 *
 * A documentação do `addpins` pede a posição em MILÍMETROS, com o tamanho da
 * página, mas não diz de que ponto do carimbo ela vale (canto ou centro). Por
 * isso os dois ajustes abaixo existem e são configuráveis por variável de
 * ambiente — e o envio com posição fica DESLIGADO até alguém ligar
 * `D4SIGN_POSICIONAR_ASSINATURA=1` e conferir num envio de teste (que gasta
 * crédito, e por isso não foi feito). Quem for ligar:
 *  1. ligar "Ativar posição da assinatura" no cofre, no painel da D4Sign;
 *  2. mandar um documento de teste para um endereço do escritório;
 *  3. se o carimbo cair deslocado, acertar `D4SIGN_PIN_AJUSTE_X_MM` e
 *     `D4SIGN_PIN_AJUSTE_Y_MM` — sem mexer no código.
 * `npm run d4sign:posicoes -- arquivo.pdf` mostra o que seria enviado, sem
 * falar com a D4Sign.
 * ─────────────────────────────────────────────────────────────────────────
 */

const MM_POR_PONTO = 25.4 / 72

export type MarcaNoPdf = { chave: string; xMm: number; yMm: number }

export type PaginaDoPdf = {
  numero: number
  larguraMm: number
  alturaMm: number
  marcas: MarcaNoPdf[]
}

const MARCA = /\[\[assina:([a-z]+)\]\]/

/**
 * Lê o PDF: o tamanho de cada página e onde estão as marcas de assinatura.
 * `y` é medido do TOPO da página, em milímetros, como o `addpins` pede.
 */
export async function lerPaginasDoPdf(pdf: Uint8Array): Promise<PaginaDoPdf[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const documento = await pdfjs.getDocument({
    data: new Uint8Array(pdf),
    useSystemFonts: true,
    verbosity: 0,
  }).promise

  const paginas: PaginaDoPdf[] = []

  for (let numero = 1; numero <= documento.numPages; numero += 1) {
    const pagina = await documento.getPage(numero)
    const visao = pagina.getViewport({ scale: 1 })
    const texto = await pagina.getTextContent()

    const marcas: MarcaNoPdf[] = []
    for (const item of texto.items) {
      if (!('str' in item)) continue
      const achada = MARCA.exec(item.str)
      if (achada === null || achada[1] === undefined) continue

      const [, , , , x, y] = item.transform as number[]
      marcas.push({
        chave: achada[1],
        // Centro do texto: o bloco de assinatura é centralizado.
        xMm: ((x ?? 0) + item.width / 2) * MM_POR_PONTO,
        yMm: (visao.height - (y ?? 0)) * MM_POR_PONTO,
      })
    }

    paginas.push({
      numero,
      larguraMm: visao.width * MM_POR_PONTO,
      alturaMm: visao.height * MM_POR_PONTO,
      marcas,
    })
  }

  await documento.cleanup()
  return paginas
}

// ---------------------------------------------------------------------------
// Pins — o formato do `addpins`
// ---------------------------------------------------------------------------

export type PinDaAssinatura = {
  email: string
  page: string
  page_width: string
  page_height: string
  position_x: string
  position_y: string
  /** "0" assinatura, "1" rubrica, "2" selo. */
  type: '0'
}

export type AjusteDoPin = { xMm: number; yMm: number }

/**
 * Do ponto medido (centro da linha de assinatura) ao ponto que a D4Sign quer.
 * Os padrões supõem que a posição é o canto superior esquerdo do carimbo e que
 * o carimbo tem uns 40 x 14 mm: centraliza em cima da linha e sobe uma altura.
 * É suposição — ver o comentário do topo.
 */
export function ajusteDoAmbiente(
  ambiente: Record<string, string | undefined> = process.env,
): AjusteDoPin {
  const numero = (valor: string | undefined, padrao: number) => {
    const lido = Number((valor ?? '').replace(',', '.'))
    return valor === undefined || valor.trim() === '' || Number.isNaN(lido) ? padrao : lido
  }
  return {
    xMm: numero(ambiente['D4SIGN_PIN_AJUSTE_X_MM'], -20),
    yMm: numero(ambiente['D4SIGN_PIN_AJUSTE_Y_MM'], -14),
  }
}

export function posicionamentoLigado(
  ambiente: Record<string, string | undefined> = process.env,
): boolean {
  return (ambiente['D4SIGN_POSICIONAR_ASSINATURA'] ?? '').trim() === '1'
}

function pin(
  email: string,
  pagina: PaginaDoPdf,
  xMm: number,
  yMm: number,
  ajuste: AjusteDoPin,
): PinDaAssinatura {
  const limitar = (valor: number, maximo: number) =>
    Math.max(0, Math.min(maximo, valor))
  const arredondar = (valor: number) => (Math.round(valor * 10) / 10).toString()

  return {
    email,
    page: String(pagina.numero),
    page_width: arredondar(pagina.larguraMm),
    page_height: arredondar(pagina.alturaMm),
    position_x: arredondar(limitar(xMm + ajuste.xMm, pagina.larguraMm)),
    position_y: arredondar(limitar(yMm + ajuste.yMm, pagina.alturaMm)),
    type: '0',
  }
}

/** A marca `chave` mais ao final do documento (o bloco de assinatura é o último). */
function ultimaMarca(
  paginas: readonly PaginaDoPdf[],
  chave: string,
): { pagina: PaginaDoPdf; marca: MarcaNoPdf } | null {
  for (let i = paginas.length - 1; i >= 0; i -= 1) {
    const pagina = paginas[i]
    const marca = pagina?.marcas.filter((m) => m.chave === chave).at(-1)
    if (pagina !== undefined && marca !== undefined) return { pagina, marca }
  }
  return null
}

/** Pins dos signatários que têm marca no documento gerado pelo sistema. */
export function pinsPelasMarcas(
  paginas: readonly PaginaDoPdf[],
  signatarios: readonly { email: string; chave: string }[],
  ajuste: AjusteDoPin,
): PinDaAssinatura[] {
  const pins: PinDaAssinatura[] = []
  for (const signatario of signatarios) {
    const achada = ultimaMarca(paginas, signatario.chave)
    // Sem marca (documento antigo, gerado antes das marcas): a D4Sign
    // escolhe, como sempre escolheu.
    if (achada === null) continue
    pins.push(pin(signatario.email, achada.pagina, achada.marca.xMm, achada.marca.yMm, ajuste))
  }
  return pins
}

// ---------------------------------------------------------------------------
// Documento avulso — a escolha do operador
// ---------------------------------------------------------------------------

export type PosicaoEscolhida = {
  /** 0 = a última página. */
  pagina: number
  lado: 'esquerda' | 'centro' | 'direita'
  /** Distância do topo da página, em % da altura (5 a 95). */
  alturaEmPercentual: number
}

const FRACAO_DO_LADO = { esquerda: 0.27, centro: 0.5, direita: 0.73 } as const

/**
 * Posição de quem não escolheu: última página, perto do pé, e os signatários
 * lado a lado — sem isso todos os carimbos cairiam no mesmo ponto.
 */
export function posicaoPadrao(indice: number): PosicaoEscolhida {
  const lados = ['esquerda', 'direita', 'centro'] as const
  return { pagina: 0, lado: lados[indice % lados.length] ?? 'centro', alturaEmPercentual: 85 }
}

export function pinsDosAvulsos(
  paginas: readonly PaginaDoPdf[],
  avulsos: readonly { email: string; posicao?: PosicaoEscolhida | undefined }[],
  ajuste: AjusteDoPin,
): PinDaAssinatura[] {
  const pins: PinDaAssinatura[] = []

  avulsos.forEach((avulso, indice) => {
    const posicao = avulso.posicao ?? posicaoPadrao(indice)
    const pagina =
      posicao.pagina <= 0 || posicao.pagina > paginas.length
        ? paginas.at(-1)
        : paginas[posicao.pagina - 1]
    if (pagina === undefined) return

    pins.push(
      pin(
        avulso.email,
        pagina,
        pagina.larguraMm * FRACAO_DO_LADO[posicao.lado],
        (pagina.alturaMm * posicao.alturaEmPercentual) / 100,
        ajuste,
      ),
    )
  })

  return pins
}
