/**
 * Tratamento da publicação pela IA — passo 3 da esteira de acompanhamento
 * (`docs/publicacoes.md`).
 *
 * A IA lê o inteiro teor e devolve tipo, resumo, providência, prazo em dias e
 * um texto curto para o cliente. Ela NÃO calcula a data do prazo: quem conta
 * os dias é `vencimentoDoPrazo` (`prazos.ts`), que é determinístico e
 * testado. Tudo é sugestão — a equipe confirma na fila de conferência, e o
 * texto para o cliente só chega a ele se alguém lançar o andamento.
 *
 * Sem arquivo à parte com "a minuta da peça": isso depende dos modelos de
 * petição do escritório, que ainda não chegaram (regra 10 — não se inventa
 * texto jurídico).
 */

import { z } from 'zod'

import { vencimentoDoPrazo, type Contagem } from '@/lib/prazos'

export const TIPOS_DE_ATO = [
  'despacho',
  'decisao',
  'sentenca',
  'acordao',
  'intimacao',
  'citacao',
  'audiencia',
  'outro',
] as const

export type TipoDeAto = (typeof TIPOS_DE_ATO)[number]

export const ROTULO_DO_TIPO_DE_ATO: Record<TipoDeAto, string> = {
  despacho: 'Despacho',
  decisao: 'Decisão',
  sentenca: 'Sentença',
  acordao: 'Acórdão',
  intimacao: 'Intimação',
  citacao: 'Citação',
  audiencia: 'Audiência',
  outro: 'Outro',
}

/** JSON Schema no formato estrito (todos os campos obrigatórios, nulo explícito). */
export const ESQUEMA_DA_ANALISE = {
  type: 'object',
  additionalProperties: false,
  required: [
    'tipo',
    'resumo',
    'providencia',
    'exigeManifestacao',
    'prazoEmDias',
    'contagem',
    'dataDaAudiencia',
    'textoParaCliente',
  ],
  properties: {
    tipo: { type: 'string', enum: [...TIPOS_DE_ATO] },
    resumo: {
      type: 'string',
      description: 'O que foi decidido ou determinado, em até 3 frases, para a equipe do escritório.',
    },
    providencia: {
      type: 'string',
      description:
        'O que o escritório precisa fazer (ex.: "Apresentar réplica à contestação"). "Nenhuma" se for só ciência.',
    },
    exigeManifestacao: { type: 'boolean' },
    prazoEmDias: {
      type: ['integer', 'null'],
      description: 'Prazo fixado ou legal para a providência, em dias. Nulo se não houver.',
    },
    contagem: {
      type: ['string', 'null'],
      enum: ['uteis', 'corridos', null],
      description: 'Prazos processuais do CPC e dos Juizados são em dias úteis.',
    },
    dataDaAudiencia: {
      type: ['string', 'null'],
      description: 'Data de audiência ou sessão designada, no formato AAAA-MM-DD. Nulo se não houver.',
    },
    textoParaCliente: {
      type: 'string',
      description:
        'Uma ou duas frases simples, sem juridiquês, para o cliente ler na área de consulta. Sem prazos internos nem estratégia.',
    },
  },
} as const

const esquema = z.object({
  tipo: z.enum(TIPOS_DE_ATO),
  resumo: z.string().trim().min(1).max(2000),
  providencia: z.string().trim().min(1).max(500),
  exigeManifestacao: z.boolean(),
  prazoEmDias: z.number().int().min(1).max(365).nullable(),
  contagem: z.enum(['uteis', 'corridos']).nullable(),
  dataDaAudiencia: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  textoParaCliente: z.string().trim().min(1).max(600),
})

export type AnaliseDaPublicacao = z.output<typeof esquema>

/** Confere o que a IA devolveu. `null` = resposta fora do formato. */
export function lerAnalise(bruto: unknown): AnaliseDaPublicacao | null {
  const conferido = esquema.safeParse(bruto)
  return conferido.success ? conferido.data : null
}

/**
 * O dia sugerido para a tarefa: a audiência, se houver; senão o vencimento
 * do prazo contado a partir da disponibilização. `null` se não há prazo.
 */
export function prazoSugerido(analise: AnaliseDaPublicacao, disponibilizacao: string): string | null {
  if (analise.dataDaAudiencia !== null && analise.dataDaAudiencia >= disponibilizacao) {
    return analise.dataDaAudiencia
  }
  if (analise.prazoEmDias === null) return null
  const contagem: Contagem = analise.contagem ?? 'uteis'
  return vencimentoDoPrazo(disponibilizacao, analise.prazoEmDias, contagem)
}

export const INSTRUCOES_DO_SISTEMA = [
  'Você é assistente jurídico de um escritório de advocacia brasileiro.',
  'Recebe o inteiro teor de uma comunicação publicada no Diário de Justiça Eletrônico Nacional (DJEN)',
  'e devolve uma análise objetiva para a equipe conferir.',
  'Não invente fatos, prazos ou datas que não estejam no texto ou na lei processual.',
  'Se o texto não fixar prazo e não houver prazo legal evidente, use prazoEmDias nulo.',
  'O texto para o cliente é lido por leigos: frases curtas, sem siglas, sem estratégia do escritório.',
].join(' ')

export function mensagemDoUsuario(publicacao: {
  siglaTribunal: string
  orgao: string | null
  tipoComunicacao: string | null
  tipoDocumento: string | null
  classe: string | null
  numeroProcesso: string
  disponibilizacao: string
  texto: string
}): string {
  return [
    `Tribunal: ${publicacao.siglaTribunal}`,
    `Órgão: ${publicacao.orgao ?? '—'}`,
    `Classe: ${publicacao.classe ?? '—'}`,
    `Tipo de comunicação: ${publicacao.tipoComunicacao ?? '—'} / ${publicacao.tipoDocumento ?? '—'}`,
    `Processo: ${publicacao.numeroProcesso}`,
    `Disponibilizada em: ${publicacao.disponibilizacao}`,
    '',
    'Inteiro teor:',
    // Teto para não mandar acórdão de 200 páginas inteiro numa chamada só.
    publicacao.texto.slice(0, 60_000),
  ].join('\n')
}
