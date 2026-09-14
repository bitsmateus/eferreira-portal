/**
 * Preenchimento dos modelos do escritório — Anexo I, passo 3.
 *
 * Regra 10: o texto jurídico vem dos arquivos em `src/modelos/` e não é
 * alterado aqui. Este arquivo só troca marcador por valor.
 *
 * Marcador que não encontra valor **não vira texto vazio**: a função devolve
 * a lista do que falta e o documento não é gerado. Procuração com o nome da
 * mãe em branco é documento imprestável, e é melhor descobrir isso na tela do
 * operador do que na hora da assinatura.
 */

import { TipoDocumento, type TipoPessoa } from '@prisma/client'

import { ESCRITORIO } from '@/lib/escritorio'
import { formatarDataExtenso } from '@/lib/datas'
import { formatarDocumento } from '@/lib/documento'
import { formatarCep } from '@/lib/formatos'
import { formatarReais, reaisPorExtenso } from '@/lib/extenso'

/** Modelos disponíveis hoje. O termo de acordo ficou fora do escopo. */
export const MODELOS = {
  PROCURACAO: 'procuracao',
  DECLARACAO: 'declaracao',
  CONTRATO: 'contrato-de-prestacao-de-servicos',
} as const

export type NomeDoModelo = (typeof MODELOS)[keyof typeof MODELOS]

export const MODELO_DO_TIPO: Partial<Record<TipoDocumento, NomeDoModelo>> = {
  [TipoDocumento.PROCURACAO]: MODELOS.PROCURACAO,
  [TipoDocumento.DECLARACAO]: MODELOS.DECLARACAO,
  [TipoDocumento.CONTRATO]: MODELOS.CONTRATO,
}

// ---------------------------------------------------------------------------
// O que entra no documento
// ---------------------------------------------------------------------------

export type ClienteParaDocumento = {
  nome: string
  tipoPessoa: TipoPessoa
  documento: string
  nacionalidade: string | null
  estadoCivil: string | null
  nomeMae: string | null
  rg: string | null
  email: string | null
  endereco: string | null
  cidade: string | null
  uf: string | null
  cep: string | null
}

/**
 * O sócio que assina pela empresa.
 *
 * Na procuração nova ele **não** é fundido ao cliente: a empresa aparece com
 * razão social e CNPJ, e ele logo depois, com nome, RG e CPF próprios — "neste
 * ato representada por seu sócio FULANO". São duas pessoas no mesmo parágrafo,
 * e misturá-las produziria uma procuração em que ninguém sabe quem assinou.
 */
export type RepresentanteParaDocumento = {
  nome: string
  documento: string
  nacionalidade: string | null
  rg: string | null
  /** "sócio", "sócio administrador", "presidente" — como no contrato social. */
  qualificacao: string | null
}

export type CasoParaDocumento = {
  assunto: string
  parteContraria: string | null
  honorariosEmCentavos: number | null
  parcelas: readonly { numero: number; valorEmCentavos: number; vencimento: Date }[]
}

/** Escreve a cláusula 2.1 a partir das parcelas cadastradas. */
export function condicoesDePagamento(
  caso: Pick<CasoParaDocumento, 'honorariosEmCentavos' | 'parcelas'>,
): string {
  const parcelas = [...caso.parcelas].sort((a, b) => a.numero - b.numero)

  if (parcelas.length === 0) return 'à vista.'

  if (parcelas.length === 1) {
    const unica = parcelas[0]
    if (unica === undefined) return 'à vista.'
    return `parcela única de ${formatarReais(unica.valorEmCentavos)} (${reaisPorExtenso(
      unica.valorEmCentavos,
    )}) para o dia ${formatarDataCurta(unica.vencimento)}.`
  }

  const ordinais = [
    'primeira',
    'segunda',
    'terceira',
    'quarta',
    'quinta',
    'sexta',
    'sétima',
    'oitava',
    'nona',
    'décima',
  ]

  const trechos = parcelas.map((parcela, indice) => {
    const ordinal = ordinais[indice] ?? `${parcela.numero}ª`
    return `a ${ordinal} de ${formatarReais(parcela.valorEmCentavos)} (${reaisPorExtenso(
      parcela.valorEmCentavos,
    )}) para o dia ${formatarDataCurta(parcela.vencimento)}`
  })

  const quantidade = `${parcelas.length}(${porExtensoSimples(parcelas.length)}) parcelas`
  return `${quantidade} com ${trechos.join(', ')}.`
}

function porExtensoSimples(numero: number): string {
  const nomes = [
    'zero',
    'uma',
    'duas',
    'três',
    'quatro',
    'cinco',
    'seis',
    'sete',
    'oito',
    'nove',
    'dez',
  ]
  return nomes[numero] ?? String(numero)
}

/** 09/10/2025 — formato usado dentro das cláusulas. */
function formatarDataCurta(data: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(data)
}

// ---------------------------------------------------------------------------
// Montagem dos valores
// ---------------------------------------------------------------------------

/** Campo em branco ou só com espaços conta como não preenchido. */
function ouNulo(valor: string | null): string | null {
  if (valor === null) return null
  const limpo = valor.trim()
  return limpo === '' ? null : limpo
}

/**
 * Monta o dicionário de marcador → valor. Campo não preenchido vira `null`, e
 * é o `preencherModelo` que decide o que fazer com isso.
 */
export function valoresDoDocumento(
  cliente: ClienteParaDocumento,
  representante: RepresentanteParaDocumento | null,
  caso: CasoParaDocumento | null,
  emitidoEm: Date,
): Record<string, string | null> {
  const valores: Record<string, string | null> = {
    'cliente.nome': ouNulo(cliente.nome),
    'cliente.nacionalidade': ouNulo(cliente.nacionalidade),
    'cliente.estadoCivil': ouNulo(cliente.estadoCivil),
    'cliente.nomeMae': ouNulo(cliente.nomeMae),
    'cliente.rg': ouNulo(cliente.rg),
    'cliente.documentoFormatado': formatarDocumento(cliente.documento),
    'cliente.email': ouNulo(cliente.email),
    'cliente.endereco': ouNulo(cliente.endereco),
    'cliente.cidade': ouNulo(cliente.cidade),
    'cliente.uf': ouNulo(cliente.uf),
    'cliente.cepFormatado': cliente.cep === null ? null : formatarCep(cliente.cep),

    // A cidade da assinatura sai do cadastro do CLIENTE, não do escritório —
    // decisão do escritório em 14/09/2026, e é o que o modelo novo faz: sede
    // do outorgante em São Paulo, escritório em Mogi das Cruzes, documento
    // assinado em São Paulo.
    localDaAssinatura: ouNulo(cliente.cidade),
    dataPorExtenso: formatarDataExtenso(emitidoEm),
  }

  if (representante !== null) {
    valores['representante.nome'] = ouNulo(representante.nome)
    valores['representante.documentoFormatado'] = formatarDocumento(
      representante.documento,
    )
    valores['representante.nacionalidade'] = ouNulo(representante.nacionalidade)
    valores['representante.rg'] = ouNulo(representante.rg)
    valores['representante.qualificacao'] = ouNulo(representante.qualificacao)
  }

  for (const [chave, valor] of Object.entries(ESCRITORIO)) {
    valores[`escritorio.${chave}`] = valor
  }

  if (caso !== null) {
    valores['caso.assunto'] = ouNulo(caso.assunto)
    // No modelo: "conclusão de AÇÃO DE DIVORCIO CONSENSUAL contra Danila".
    // Sem parte contrária, a frase tem que fechar sem sobrar "contra".
    // O espaço vem junto com o valor: sem parte contrária, a frase fecha em
    // "...conclusão de AÇÃO X, abrangendo", sem espaço solto antes da vírgula.
    valores['caso.contraParteContraria'] =
      caso.parteContraria === null ? '' : ` contra ${caso.parteContraria}`

    valores['honorarios.valorFormatado'] =
      caso.honorariosEmCentavos === null
        ? null
        : formatarReais(caso.honorariosEmCentavos)
    valores['honorarios.valorPorExtenso'] =
      caso.honorariosEmCentavos === null
        ? null
        : reaisPorExtenso(caso.honorariosEmCentavos)
    valores['honorarios.condicoesDePagamento'] = condicoesDePagamento(caso)
  }

  return valores
}

// ---------------------------------------------------------------------------
// Preenchimento
// ---------------------------------------------------------------------------

const MARCADOR = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g

/**
 * Tira os comentários HTML antes de qualquer coisa.
 *
 * Não é cosmético: os comentários dos modelos trazem notas internas — de onde
 * o arquivo veio, e até que o contrato do escritório tem duas cláusulas
 * numeradas como 9ª. Nada disso pode viajar dentro de um documento que o
 * cliente assina. De quebra, impede que um exemplo de marcador escrito num
 * comentário seja confundido com marcador de verdade.
 */
function semComentarios(modelo: string): string {
  return modelo.replace(/<!--[\s\S]*?-->/g, '')
}

/** Nome legível de cada marcador, para a mensagem de "está faltando". */
const ROTULO_DO_MARCADOR: Record<string, string> = {
  'cliente.nome': 'nome do cliente',
  'cliente.nacionalidade': 'nacionalidade',
  'cliente.estadoCivil': 'estado civil',
  'cliente.nomeMae': 'nome da mãe',
  'cliente.rg': 'RG',
  'cliente.email': 'e-mail',
  'cliente.endereco': 'endereço',
  'cliente.cidade': 'cidade',
  'cliente.uf': 'UF',
  'cliente.cepFormatado': 'CEP',
  localDaAssinatura: 'cidade do cliente (é ela que sai na assinatura)',
  'representante.nome': 'nome do sócio',
  'representante.documentoFormatado': 'CPF do sócio',
  'representante.nacionalidade': 'nacionalidade do sócio',
  'representante.rg': 'RG do sócio',
  'representante.qualificacao': 'qualificação do sócio (sócio, presidente)',
  'caso.assunto': 'assunto do caso',
  'honorarios.valorFormatado': 'valor dos honorários',
  'honorarios.valorPorExtenso': 'valor dos honorários',
  'honorarios.condicoesDePagamento': 'condições de pagamento',
}

export function rotuloDoMarcador(marcador: string): string {
  return ROTULO_DO_MARCADOR[marcador] ?? marcador
}

/** Escapa o valor antes de entrar no HTML — o nome vem de quem digitou. */
function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export type ResultadoDoPreenchimento =
  | { ok: true; html: string }
  /** Nomes legíveis e sem repetição do que falta preencher. */
  | { ok: false; faltando: string[] }

export function preencherModelo(
  modelo: string,
  valores: Record<string, string | null>,
): ResultadoDoPreenchimento {
  const faltando = new Set<string>()

  const html = semComentarios(modelo).replace(MARCADOR, (_inteiro, marcador: string) => {
    const valor = valores[marcador]

    // `null` é campo não preenchido — impede a geração. String vazia é vazio
    // de propósito, como o trecho "contra fulano" num caso sem parte
    // contrária: o documento sai completo sem ele.
    if (valor === undefined || valor === null) {
      faltando.add(rotuloDoMarcador(marcador))
      return ''
    }

    return escaparHtml(valor)
  })

  if (faltando.size > 0) {
    return { ok: false, faltando: [...faltando] }
  }

  return { ok: true, html }
}

/**
 * Encaixa as partes variáveis do modelo.
 *
 * A procuração muda de bloco conforme o cliente seja pessoa física ou
 * jurídica: a qualificação do outorgante e a assinatura. Em vez de duplicar
 * o modelo inteiro — e ficar com dois textos de poderes que um dia divergem
 * sem ninguém perceber —, o modelo traz `{{>outorgante}}` e
 * `{{>assinatura}}`, e cada pedaço é um arquivo próprio em `src/modelos/`,
 * legível e corrigível pelo escritório como qualquer outro.
 *
 * As partes entram ANTES dos marcadores, para que os `{{campo}}` de dentro
 * delas sejam preenchidos no mesmo passo que os do modelo.
 */
const PARTE = /\{\{>\s*([a-zA-Z0-9_-]+)\s*\}\}/g

export function aplicarPartes(
  modelo: string,
  partes: Record<string, string>,
): string {
  return modelo.replace(PARTE, (inteiro, nome: string) => partes[nome] ?? inteiro)
}

/** Lista os marcadores que um modelo usa. Serve para conferir cobertura. */
export function marcadoresDoModelo(modelo: string): string[] {
  const encontrados = new Set<string>()
  for (const par of semComentarios(modelo).matchAll(MARCADOR)) {
    const marcador = par[1]
    if (marcador !== undefined) encontrados.add(marcador)
  }
  return [...encontrados]
}
