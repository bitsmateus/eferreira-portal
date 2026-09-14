/**
 * O que o cliente vê — Anexo I, itens 1.d e 2.4.
 *
 * Regra 3, o requisito número um: um cliente enxerga exclusivamente os
 * próprios casos. Repare no que estas funções **não** recebem: nenhum
 * `clienteId`. Não há parâmetro para alguém adulterar — o recorte sai inteiro
 * de `filtroDeCasos` e `filtroDeDocumentos`, montados a partir da sessão, que
 * por sua vez foi conferida contra o banco em `exigirSessaoDeCliente`.
 *
 * A seleção também é menor de propósito. O cliente lê **a mensagem resumo** do
 * andamento — foi o que o escritório definiu em 14/09/2026 — e não precisa
 * saber qual operador a lançou nem quando ela foi digitada. O que não é
 * selecionado não corre o risco de aparecer numa tela por descuido.
 */

import type { Prisma } from '@prisma/client'

import { filtroDeCasos, filtroDeDocumentos, type SessaoServidor } from '@/lib/autorizacao'
import { prisma } from '@/lib/prisma'

const CASO_DO_CLIENTE = {
  id: true,
  numeroProcesso: true,
  assunto: true,
  vara: true,
  situacao: true,
  andamentos: {
    select: {
      id: true,
      data: true,
      descricao: true,
      status: { select: { nome: true } },
    },
    orderBy: [{ data: 'desc' }, { criadoEm: 'desc' }],
  },
} satisfies Prisma.CasoSelect

export type CasoDoCliente = Prisma.CasoGetPayload<{ select: typeof CASO_DO_CLIENTE }>

/** Os casos do cliente da sessão — e, por construção, só eles. */
export async function meusCasos(sessao: SessaoServidor): Promise<CasoDoCliente[]> {
  return prisma.caso.findMany({
    where: filtroDeCasos(sessao),
    select: CASO_DO_CLIENTE,
    // Em andamento antes de arquivado; depois, o mais recente primeiro.
    orderBy: [{ situacao: 'asc' }, { criadoEm: 'desc' }],
  })
}

const DOCUMENTO_DO_CLIENTE = {
  id: true,
  tipo: true,
  nome: true,
  tipoConteudo: true,
  tamanhoBytes: true,
  assinadoEm: true,
  criadoEm: true,
  casoId: true,
  caso: { select: { id: true, numeroProcesso: true, assunto: true } },
} satisfies Prisma.DocumentoSelect

export type DocumentoDoCliente = Prisma.DocumentoGetPayload<{
  select: typeof DOCUMENTO_DO_CLIENTE
}>

/**
 * A pasta única do cliente, vista pelo cliente. Quem enviou cada arquivo fica
 * de fora: é informação de operação do escritório.
 */
export async function meusDocumentos(
  sessao: SessaoServidor,
): Promise<DocumentoDoCliente[]> {
  return prisma.documento.findMany({
    where: filtroDeDocumentos(sessao),
    select: DOCUMENTO_DO_CLIENTE,
    orderBy: { criadoEm: 'desc' },
  })
}
