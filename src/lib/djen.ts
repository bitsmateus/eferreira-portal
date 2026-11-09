/**
 * DJEN — Diário de Justiça Eletrônico Nacional, do CNJ (09/11/2026).
 *
 * API pública de comunicações processuais (`comunicaapi.pje.jus.br`), sem
 * chave: consulta por OAB e período de disponibilização. É ela que alimenta a
 * fila de conferência (`src/lib/publicacoes.ts`).
 *
 * É conveniência, nunca autoridade — mesmo princípio de `cep.ts`: falha de
 * rede, tempo esgotado ou resposta estranha viram um erro descrito, e a
 * próxima consulta (a janela se sobrepõe) recupera o que faltou.
 *
 * Armadilha registrada: a API limita a 20 requisições por minuto
 * (`X-RateLimit-Limit: 20`). Por isso a consulta é só por OAB — uma ou duas
 * páginas por advogado — e não processo a processo.
 */

import { z } from 'zod'

import { somenteDigitos } from '@/lib/formatos'

const URL_PADRAO = 'https://comunicaapi.pje.jus.br/api/v1/comunicacao'
const LIMITE_DE_ESPERA_MS = 20_000
const ITENS_POR_PAGINA = 100
/** Trava contra laço infinito se a API responder `count` errado. */
const MAXIMO_DE_PAGINAS = 10

export type ComunicacaoDoDjen = {
  idDjen: string
  hash: string | null
  /** "AAAA-MM-DD" */
  disponibilizacao: string
  siglaTribunal: string
  orgao: string | null
  tipoComunicacao: string | null
  tipoDocumento: string | null
  classe: string | null
  /** Só dígitos. */
  numeroProcesso: string
  texto: string
  link: string | null
}

const texto = z
  .string()
  .nullish()
  .transform((valor) => {
    const limpo = (valor ?? '').trim()
    return limpo === '' ? null : limpo
  })

const esquemaDoItem = z.object({
  id: z.union([z.number(), z.string()]),
  hash: texto,
  data_disponibilizacao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  siglaTribunal: z.string().min(1),
  nomeOrgao: texto,
  tipoComunicacao: texto,
  tipoDocumento: texto,
  nomeClasse: texto,
  numero_processo: z.string().min(1),
  texto: z.string().nullish(),
  link: texto,
  ativo: z.boolean().nullish(),
})

const esquemaDaResposta = z.object({
  count: z.number().int().nonnegative(),
  items: z.array(z.unknown()),
})

/** O HTML que alguns tribunais mandam no texto vira texto corrido. */
export function limparTexto(bruto: string): string {
  return bruto
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/ /g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Lê uma página de resposta. Item malformado ou cancelado (`ativo: false`) é
 * descartado sem derrubar os outros. Exportado para teste.
 */
export function lerPagina(corpo: unknown): { total: number; itens: ComunicacaoDoDjen[] } | null {
  const resposta = esquemaDaResposta.safeParse(corpo)
  if (!resposta.success) return null

  const itens: ComunicacaoDoDjen[] = []
  for (const bruto of resposta.data.items) {
    const item = esquemaDoItem.safeParse(bruto)
    if (!item.success || item.data.ativo === false) continue

    const numeroProcesso = somenteDigitos(item.data.numero_processo)
    if (numeroProcesso === '') continue

    itens.push({
      idDjen: String(item.data.id),
      hash: item.data.hash,
      disponibilizacao: item.data.data_disponibilizacao,
      siglaTribunal: item.data.siglaTribunal.trim(),
      orgao: item.data.nomeOrgao,
      tipoComunicacao: item.data.tipoComunicacao,
      tipoDocumento: item.data.tipoDocumento,
      classe: item.data.nomeClasse,
      numeroProcesso,
      texto: limparTexto(item.data.texto ?? ''),
      link: item.data.link,
    })
  }
  return { total: resposta.data.count, itens }
}

export type ResultadoDaConsultaAoDjen =
  | { ok: true; itens: ComunicacaoDoDjen[] }
  | { ok: false; erro: string }

/** Todas as comunicações de uma OAB num período (dias civis, inclusive). */
export async function consultarPorOab(
  oab: { numero: string; uf: string },
  inicio: string,
  fim: string,
): Promise<ResultadoDaConsultaAoDjen> {
  const base = (process.env['DJEN_API_URL'] ?? '').trim() || URL_PADRAO
  const numero = somenteDigitos(oab.numero)
  const uf = oab.uf.trim().toUpperCase()
  const itens: ComunicacaoDoDjen[] = []

  for (let pagina = 1; pagina <= MAXIMO_DE_PAGINAS; pagina += 1) {
    const url = new URL(base)
    url.searchParams.set('numeroOab', numero)
    url.searchParams.set('ufOab', uf)
    url.searchParams.set('dataDisponibilizacaoInicio', inicio)
    url.searchParams.set('dataDisponibilizacaoFim', fim)
    url.searchParams.set('itensPorPagina', String(ITENS_POR_PAGINA))
    url.searchParams.set('pagina', String(pagina))

    let corpo: unknown
    try {
      const resposta = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(LIMITE_DE_ESPERA_MS),
        cache: 'no-store',
      })
      if (resposta.status === 429) {
        return { ok: false, erro: `DJEN: limite de consultas atingido (OAB ${uf}${numero}).` }
      }
      if (!resposta.ok) {
        return { ok: false, erro: `DJEN respondeu HTTP ${resposta.status} (OAB ${uf}${numero}).` }
      }
      corpo = await resposta.json()
    } catch (erro) {
      const motivo = erro instanceof Error ? erro.name : 'erro'
      return { ok: false, erro: `DJEN fora do ar ou lento (${motivo}, OAB ${uf}${numero}).` }
    }

    const lida = lerPagina(corpo)
    if (lida === null) {
      return { ok: false, erro: `Resposta inesperada do DJEN (OAB ${uf}${numero}).` }
    }

    itens.push(...lida.itens)
    if (pagina * ITENS_POR_PAGINA >= lida.total) break
  }

  return { ok: true, itens }
}
