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

import {
  TipoDocumento,
  TipoDeObjeto,
  type NaturezaDoHonorarioPersonalizado,
  type TipoPessoa,
} from '@prisma/client'

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

/**
 * O que o contrato precisa saber do caso.
 *
 * Só dado do contrato: assunto e parte contrária do caso não entram mais — a
 * cláusula de objeto do escritório (21/09/2026) traz a descrição da demanda
 * num campo próprio, `descricaoDoObjeto`, em que o operador já identifica as
 * partes e o número do processo.
 */
export type CasoParaDocumento = {
  parcelas: readonly { numero: number; valorEmCentavos: number; vencimento: Date }[]
  honorariosEmCentavos: number | null
  percentualExito: number | null
  percentualProveitoEconomico: number | null
  referenciaDaEconomia: string | null
  prazoDePagamentoDaEconomia: number | null
  tipoDeObjeto: TipoDeObjeto | null
  descricaoDoObjeto: string | null
  honorariosPersonalizados: boolean
  personalizadoServicos: string | null
  personalizadoValorOuPercentual: string | null
  personalizadoBaseDeCalculo: string | null
  personalizadoCondicaoDeExigibilidade: string | null
  personalizadoPagamento: string | null
  personalizadoNatureza: NaturezaDoHonorarioPersonalizado | null
  personalizadoRelacaoComAsDemais: string | null
  personalizadoCondicoesEspecificas: string | null
}

// ---------------------------------------------------------------------------
// Quais partes do contrato valem para o caso
//
// O objeto tem cinco variações e os honorários quatro blocos combináveis, mais
// um bloco comum — tudo em arquivos próprios em `src/modelos/`, com o texto
// do escritório intacto (regra 10). A escolha do que entra é aqui, e é a MESMA
// para a geração e para os testes: uma composição só.
// ---------------------------------------------------------------------------

const ARQUIVO_DO_OBJETO: Record<TipoDeObjeto, string> = {
  [TipoDeObjeto.CONSUMIDOR_PLANO_DE_SAUDE]: 'contrato-objeto-consumidor-plano-de-saude',
  [TipoDeObjeto.TRABALHISTA]: 'contrato-objeto-trabalhista',
  [TipoDeObjeto.CIVEL]: 'contrato-objeto-civel',
  [TipoDeObjeto.REVISIONAL]: 'contrato-objeto-revisional',
  [TipoDeObjeto.PERSONALIZADO]: 'contrato-objeto-personalizado',
}

/** O arquivo com a cláusula de objeto do caso, ou nulo se o tipo não foi escolhido. */
export function arquivoDoObjeto(tipo: TipoDeObjeto | null): string | null {
  return tipo === null ? null : ARQUIVO_DO_OBJETO[tipo]
}

/**
 * Os arquivos da cláusula de honorários, na ordem do escritório: fixos, êxito,
 * proveito econômico, personalizados — e por último o bloco comum, que vale
 * qualquer que seja a combinação. Vazio quando nenhuma modalidade foi marcada.
 */
export function arquivosDosHonorarios(
  caso: Pick<
    CasoParaDocumento,
    | 'honorariosEmCentavos'
    | 'percentualExito'
    | 'percentualProveitoEconomico'
    | 'honorariosPersonalizados'
  >,
): string[] {
  const blocos: string[] = []

  if (caso.honorariosEmCentavos !== null) blocos.push('contrato-honorarios-fixos')
  if (caso.percentualExito !== null) blocos.push('contrato-honorarios-exito')
  if (caso.percentualProveitoEconomico !== null) {
    blocos.push('contrato-honorarios-economia')
  }
  if (caso.honorariosPersonalizados) blocos.push('contrato-honorarios-personalizados')

  return blocos.length === 0 ? [] : [...blocos, 'contrato-honorarios-comuns']
}

/**
 * O que falta escolher no caso antes de o contrato poder existir — e que não
 * é marcador de texto: escolher o tipo de objeto e marcar ao menos uma
 * modalidade de honorários. O que falta DENTRO de uma modalidade escolhida (o
 * percentual, o prazo, os campos do personalizado) é dito pelos marcadores.
 */
export function lacunasDoContrato(
  caso: Pick<
    CasoParaDocumento,
    | 'tipoDeObjeto'
    | 'honorariosEmCentavos'
    | 'percentualExito'
    | 'percentualProveitoEconomico'
    | 'honorariosPersonalizados'
  >,
): string[] {
  const lacunas: string[] = []

  if (caso.tipoDeObjeto === null) lacunas.push('tipo de objeto do contrato')
  if (arquivosDosHonorarios(caso).length === 0) {
    lacunas.push(
      'ao menos uma modalidade de honorários (fixos, êxito, proveito econômico ou personalizados)',
    )
  }

  return lacunas
}

const ORDINAIS = [
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

function parcelasEmOrdem(parcelas: CasoParaDocumento['parcelas']) {
  return [...parcelas].sort((a, b) => a.numero - b.numero)
}

function ordinalDaParcela(indice: number, numero: number): string {
  return ORDINAIS[indice] ?? `${numero}ª`
}

/**
 * O "mediante [FORMA_DE_PAGAMENTO]" do bloco de honorários fixos.
 *
 * Nulo sem parcela cadastrada: o modelo do escritório pede também o
 * vencimento, e "à vista" sem data não diz quando o honorário vence. Quem
 * cadastra o valor fixo informa ao menos uma parcela — a única, se for à vista.
 */
export function formaDePagamentoDosFixos(
  parcelas: CasoParaDocumento['parcelas'],
): string | null {
  const ordenadas = parcelasEmOrdem(parcelas)

  if (ordenadas.length === 0) return null
  if (ordenadas.length === 1) return 'parcela única'

  const trechos = ordenadas.map(
    (parcela, indice) =>
      `a ${ordinalDaParcela(indice, parcela.numero)} de ${formatarReais(
        parcela.valorEmCentavos,
      )} (${reaisPorExtenso(parcela.valorEmCentavos)})`,
  )

  return `${ordenadas.length}(${porExtensoSimples(ordenadas.length)}) parcelas, sendo ${trechos.join(', ')}`
}

/** O "com vencimento [VENCIMENTOS]" do mesmo bloco. Nulo sem parcela. */
export function vencimentosDosFixos(
  parcelas: CasoParaDocumento['parcelas'],
): string | null {
  const ordenadas = parcelasEmOrdem(parcelas)
  const primeira = ordenadas[0]

  if (primeira === undefined) return null
  if (ordenadas.length === 1) return `em ${formatarDataCurta(primeira.vencimento)}`

  return ordenadas
    .map(
      (parcela, indice) =>
        `a ${ordinalDaParcela(indice, parcela.numero)} em ${formatarDataCurta(
          parcela.vencimento,
        )}`,
    )
    .join(', ')
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
    valores['caso.descricaoDoObjeto'] = ouNulo(caso.descricaoDoObjeto)

    // Bloco 1 — fixos.
    valores['honorarios.valorFormatado'] =
      caso.honorariosEmCentavos === null
        ? null
        : formatarReais(caso.honorariosEmCentavos)
    valores['honorarios.valorPorExtenso'] =
      caso.honorariosEmCentavos === null
        ? null
        : reaisPorExtenso(caso.honorariosEmCentavos)
    valores['honorarios.formaDePagamento'] = formaDePagamentoDosFixos(caso.parcelas)
    valores['honorarios.vencimentos'] = vencimentosDosFixos(caso.parcelas)

    // Bloco 2 — êxito.
    valores['honorarios.percentualExito'] =
      caso.percentualExito === null ? null : String(caso.percentualExito)

    // Bloco 3 — proveito econômico.
    valores['honorarios.percentualEconomia'] =
      caso.percentualProveitoEconomico === null
        ? null
        : String(caso.percentualProveitoEconomico)
    valores['honorarios.referenciaDaEconomia'] = ouNulo(caso.referenciaDaEconomia)
    valores['honorarios.prazoDePagamentoDaEconomia'] =
      caso.prazoDePagamentoDaEconomia === null
        ? null
        : String(caso.prazoDePagamentoDaEconomia)

    // Bloco 4 — personalizados.
    valores['honorarios.personalizado.servicos'] = ouNulo(caso.personalizadoServicos)
    valores['honorarios.personalizado.valorOuPercentual'] = ouNulo(
      caso.personalizadoValorOuPercentual,
    )
    valores['honorarios.personalizado.baseDeCalculo'] = ouNulo(
      caso.personalizadoBaseDeCalculo,
    )
    valores['honorarios.personalizado.condicaoDeExigibilidade'] = ouNulo(
      caso.personalizadoCondicaoDeExigibilidade,
    )
    valores['honorarios.personalizado.pagamento'] = ouNulo(caso.personalizadoPagamento)
    valores['honorarios.personalizado.natureza'] =
      caso.personalizadoNatureza === null
        ? null
        : NATUREZA_POR_EXTENSO[caso.personalizadoNatureza]
    valores['honorarios.personalizado.relacaoComAsDemais'] = ouNulo(
      caso.personalizadoRelacaoComAsDemais,
    )
    valores['honorarios.personalizado.condicoesEspecificas'] = ouNulo(
      caso.personalizadoCondicoesEspecificas,
    )
  }

  return valores
}

/** Como a natureza entra na frase "Esta remuneração será ... em relação a". */
const NATUREZA_POR_EXTENSO: Record<NaturezaDoHonorarioPersonalizado, string> = {
  CUMULATIVA: 'cumulativa',
  SUBSTITUTIVA: 'substitutiva',
  COMPENSAVEL: 'compensável',
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
  'caso.descricaoDoObjeto': 'descrição do objeto do contrato',
  'honorarios.valorFormatado': 'valor dos honorários fixos',
  'honorarios.valorPorExtenso': 'valor dos honorários fixos',
  'honorarios.formaDePagamento': 'ao menos uma parcela dos honorários fixos (com o vencimento)',
  'honorarios.vencimentos': 'ao menos uma parcela dos honorários fixos (com o vencimento)',
  'honorarios.percentualExito': 'percentual de êxito',
  'honorarios.percentualEconomia': 'percentual sobre o proveito econômico',
  'honorarios.referenciaDaEconomia':
    'referência da economia (obrigação, valor discutido e data-base)',
  'honorarios.prazoDePagamentoDaEconomia': 'prazo de pagamento da economia, em dias',
  'honorarios.personalizado.servicos': 'personalizados: serviços ou etapas',
  'honorarios.personalizado.valorOuPercentual': 'personalizados: valor ou percentual',
  'honorarios.personalizado.baseDeCalculo':
    'personalizados: base de cálculo (ou "não se aplica")',
  'honorarios.personalizado.condicaoDeExigibilidade':
    'personalizados: condição de exigibilidade',
  'honorarios.personalizado.pagamento': 'personalizados: forma de pagamento e vencimentos',
  'honorarios.personalizado.natureza':
    'personalizados: se é cumulativa, substitutiva ou compensável',
  'honorarios.personalizado.relacaoComAsDemais':
    'personalizados: relação com as demais modalidades',
  'honorarios.personalizado.condicoesEspecificas': 'personalizados: condições específicas',
}

/**
 * Os rótulos que só se resolvem editando o CASO — a mensagem de "falta" leva
 * para lá, e não para o cadastro do cliente.
 */
export const ROTULOS_DO_CASO: ReadonlySet<string> = new Set(
  Object.entries(ROTULO_DO_MARCADOR)
    .filter(([marcador]) => marcador.startsWith('caso.') || marcador.startsWith('honorarios.'))
    .map(([, rotulo]) => rotulo),
)

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
  // Os comentários saem ANTES de encaixar as partes. Um `{{>parte}}` citado
  // dentro do comentário do modelo seria trocado pelo arquivo da parte — que
  // tem comentário próprio, cujo `-->` fecharia o comentário de fora e faria o
  // resto da nota interna aparecer impresso no contrato.
  return semComentarios(modelo).replace(
    PARTE,
    (inteiro, nome: string) => partes[nome] ?? inteiro,
  )
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
