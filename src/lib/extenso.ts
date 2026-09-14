/**
 * Valor por extenso — a cláusula 2ª do contrato traz o número e o extenso
 * lado a lado: "R$ 1.750,00 (mil setecentos e cinquenta reais)".
 *
 * Em documento assinado, número e extenso divergentes viram disputa. Por isso
 * os dois saem do mesmo valor em centavos e esta função tem teste próprio.
 */

const UNIDADES = [
  '',
  'um',
  'dois',
  'três',
  'quatro',
  'cinco',
  'seis',
  'sete',
  'oito',
  'nove',
  'dez',
  'onze',
  'doze',
  'treze',
  'quatorze',
  'quinze',
  'dezesseis',
  'dezessete',
  'dezoito',
  'dezenove',
] as const

const DEZENAS = [
  '',
  '',
  'vinte',
  'trinta',
  'quarenta',
  'cinquenta',
  'sessenta',
  'setenta',
  'oitenta',
  'noventa',
] as const

const CENTENAS = [
  '',
  'cento',
  'duzentos',
  'trezentos',
  'quatrocentos',
  'quinhentos',
  'seiscentos',
  'setecentos',
  'oitocentos',
  'novecentos',
] as const

/** Escreve um número de 1 a 999. */
function ateNovecentosENoventaENove(numero: number): string {
  if (numero === 100) return 'cem'

  const centena = Math.floor(numero / 100)
  const resto = numero % 100

  const partes: string[] = []
  if (centena > 0) partes.push(CENTENAS[centena] ?? '')

  if (resto > 0) {
    if (resto < 20) {
      partes.push(UNIDADES[resto] ?? '')
    } else {
      const dezena = Math.floor(resto / 10)
      const unidade = resto % 10
      const escrita =
        unidade === 0
          ? (DEZENAS[dezena] ?? '')
          : `${DEZENAS[dezena] ?? ''} e ${UNIDADES[unidade] ?? ''}`
      partes.push(escrita)
    }
  }

  return partes.join(' e ')
}

/**
 * Junta os grupos de milhar. A conjunção antes do último grupo segue o uso
 * brasileiro: "mil e quinhentos", mas "mil duzentos e cinquenta".
 */
function porExtensoInteiro(numero: number): string {
  if (numero === 0) return 'zero'

  const grupos: { valor: number; singular: string; plural: string }[] = [
    { valor: 1_000_000_000, singular: 'bilhão', plural: 'bilhões' },
    { valor: 1_000_000, singular: 'milhão', plural: 'milhões' },
    { valor: 1_000, singular: 'mil', plural: 'mil' },
  ]

  const partes: string[] = []
  let restante = numero
  /** "mil" sozinho, sem número antes — o caso de 1.000 a 1.999. */
  let milSozinho = false

  for (const grupo of grupos) {
    const quantidade = Math.floor(restante / grupo.valor)
    if (quantidade > 0) {
      const nome = quantidade === 1 ? grupo.singular : grupo.plural
      const bare = grupo.valor === 1_000 && quantidade === 1
      const prefixo = bare ? '' : `${ateNovecentosENoventaENove(quantidade)} `
      partes.push(`${prefixo}${nome}`)
      milSozinho = bare
      restante -= quantidade * grupo.valor
    }
  }

  const gruposEscritos = partes.length

  if (restante > 0) {
    partes.push(ateNovecentosENoventaENove(restante))
  }

  if (partes.length === 1) return partes[0] ?? ''

  const ultima = partes[partes.length - 1] ?? ''
  const anteriores = partes.slice(0, -1).join(', ')

  // Três formas de emendar o último pedaço, todas tiradas de como o próprio
  // escritório escreve nos modelos que mandou:
  //
  //   "e"      quando o resto é redondo — "mil e quinhentos"
  //   nada     quando é "mil" sozinho    — "mil setecentos e cinquenta"
  //   vírgula  no restante               — "dez mil, novecentos e sessenta e oito"
  //
  // Sem resto, grupos se emendam com "e": "um milhão e quinhentos mil".
  if (restante === 0) return `${anteriores} e ${ultima}`
  if (restante < 100 || restante % 100 === 0) return `${anteriores} e ${ultima}`
  if (milSozinho && gruposEscritos === 1) return `${anteriores} ${ultima}`
  return `${anteriores}, ${ultima}`
}

/** 175000 → "R$ 1.750,00" */
export function formatarReais(centavos: number): string {
  const negativo = centavos < 0
  const absoluto = Math.abs(Math.trunc(centavos))
  const inteiros = Math.floor(absoluto / 100)
  const resto = absoluto % 100

  const comSeparador = inteiros.toLocaleString('pt-BR')
  const centavosEscritos = String(resto).padStart(2, '0')

  return `${negativo ? '-' : ''}R$ ${comSeparador},${centavosEscritos}`
}

/** 175000 → "mil setecentos e cinquenta reais" */
export function reaisPorExtenso(centavos: number): string {
  const absoluto = Math.abs(Math.trunc(centavos))
  const inteiros = Math.floor(absoluto / 100)
  const resto = absoluto % 100

  const partes: string[] = []

  if (inteiros > 0) {
    // Milhão e bilhão redondos pedem a preposição: "dois milhões DE reais".
    // Com resto, não: "um milhão e quinhentos mil reais".
    const preposicao = inteiros >= 1_000_000 && inteiros % 1_000_000 === 0 ? 'de ' : ''
    const moeda = inteiros === 1 ? 'real' : 'reais'
    partes.push(`${porExtensoInteiro(inteiros)} ${preposicao}${moeda}`)
  }

  if (resto > 0) {
    partes.push(`${porExtensoInteiro(resto)} ${resto === 1 ? 'centavo' : 'centavos'}`)
  }

  if (partes.length === 0) return 'zero reais'

  return partes.join(' e ')
}

/** Converte "1.750,00", "1750,00" ou "1750" para centavos. Null se inválido. */
export function reaisParaCentavos(texto: string): number | null {
  const limpo = texto.trim().replace(/^R\$\s*/i, '')
  if (limpo === '') return null

  // Formato brasileiro: ponto separa milhar, vírgula separa centavos.
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(limpo)) return null

  const semMilhar = limpo.replace(/\./g, '')
  const [inteiros = '0', centavos = ''] = semMilhar.split(',')

  const total = Number(inteiros) * 100 + Number(centavos.padEnd(2, '0'))
  return Number.isFinite(total) ? total : null
}
