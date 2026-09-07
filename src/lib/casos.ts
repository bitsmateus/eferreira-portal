/**
 * Casos — Anexo I, item 2.2.
 *
 * Um cliente tem vários casos; cada caso tem identificação própria e o
 * respectivo número de processo. O caso é o registro interno; "número do
 * processo" é um campo dele — nunca chame o caso de "processo".
 *
 * Regra 2: o cliente ao qual o caso é vinculado é sempre reconferido contra o
 * filtro da sessão. Um `clienteId` no corpo do formulário não é autorização.
 */

import { AcaoAuditoria, type Prisma, SituacaoCaso } from '@prisma/client'
import { z } from 'zod'

import { exigirEquipe, filtroDeCasos, filtroDeClientes, type SessaoServidor } from '@/lib/autorizacao'
import { prisma } from '@/lib/prisma'
import { registrarAuditoria } from '@/lib/auditoria'
import { normalizarNumeroDeProcesso, somenteDigitos } from '@/lib/formatos'
import { errosPorCampo, type ResultadoDeFormulario } from '@/lib/formulario'

// ---------------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------------

const opcional = z
  .string()
  .trim()
  .max(180, 'Texto longo demais para este campo.')
  .transform((valor) => (valor === '' ? null : valor))

/**
 * O número do processo é opcional: o protótipo prevê caso em fase
 * pré-processual, que ainda não tem número. Quando existe, é guardado
 * normalizado, para que a mesma numeração com e sem máscara não vire dois
 * casos diferentes.
 */
const numeroDoProcesso = z
  .string()
  .trim()
  .max(60, 'Número de processo longo demais.')
  .transform((valor, contexto) => {
    if (valor === '') return null

    const digitos = somenteDigitos(valor)
    if (digitos.length === 0) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'O número do processo precisa ter dígitos.',
      })
      return z.NEVER
    }

    return normalizarNumeroDeProcesso(valor)
  })

export const esquemaDeCaso = z.object({
  numeroProcesso: numeroDoProcesso,
  assunto: z
    .string()
    .trim()
    .min(3, 'Descreva o assunto do caso.')
    .max(180, 'Assunto longo demais.'),
  vara: opcional,
  parteContraria: opcional,
  situacao: z.nativeEnum(SituacaoCaso).default(SituacaoCaso.EM_ANDAMENTO),
  responsavelId: z
    .string()
    .trim()
    .transform((valor) => (valor === '' ? null : valor)),
})

export type DadosDeCaso = z.output<typeof esquemaDeCaso>
export type CamposDeCaso = Record<keyof z.input<typeof esquemaDeCaso>, string>

export function validarCaso(campos: CamposDeCaso): ResultadoDeFormulario<DadosDeCaso> {
  const conferido = esquemaDeCaso.safeParse(campos)
  if (!conferido.success) {
    return { ok: false, erros: errosPorCampo(conferido.error) }
  }
  return { ok: true, dados: conferido.data }
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

const RESUMO = {
  id: true,
  numeroProcesso: true,
  assunto: true,
  vara: true,
  situacao: true,
  criadoEm: true,
  cliente: { select: { id: true, nome: true, documento: true } },
  responsavel: { select: { nome: true } },
  andamentos: {
    select: { data: true },
    orderBy: { data: 'desc' as const },
    take: 1,
  },
} satisfies Prisma.CasoSelect

export type LinhaDeCaso = Prisma.CasoGetPayload<{ select: typeof RESUMO }>

/**
 * Busca de caso por número do processo, assunto ou nome do cliente. Como na
 * lista de clientes, um termo só de dígitos é tratado como numeração.
 */
function condicaoDaBusca(termo: string): Prisma.CasoWhereInput | undefined {
  const limpo = termo.trim()
  if (limpo === '') return undefined

  const digitos = somenteDigitos(limpo)
  const temLetra = /\p{L}/u.test(limpo)

  if (!temLetra && digitos.length >= 3) {
    return {
      OR: [
        { numeroProcesso: { contains: digitos } },
        { cliente: { documento: { contains: digitos } } },
      ],
    }
  }

  return {
    OR: [
      { assunto: { contains: limpo, mode: 'insensitive' } },
      { cliente: { nome: { contains: limpo, mode: 'insensitive' } } },
      { numeroProcesso: { contains: limpo, mode: 'insensitive' } },
    ],
  }
}

export async function listarCasos(
  sessao: SessaoServidor,
  termo: string,
): Promise<LinhaDeCaso[]> {
  return prisma.caso.findMany({
    where: filtroDeCasos(sessao, condicaoDaBusca(termo)),
    select: RESUMO,
    orderBy: { criadoEm: 'desc' },
    take: 200,
  })
}

export async function contarCasos(sessao: SessaoServidor): Promise<number> {
  return prisma.caso.count({ where: filtroDeCasos(sessao) })
}

/** Devolve null quando a sessão não pode ver este caso. */
export async function obterCaso(sessao: SessaoServidor, id: string) {
  return prisma.caso.findFirst({
    where: filtroDeCasos(sessao, { id }),
    include: {
      cliente: {
        select: { id: true, nome: true, documento: true, tipoPessoa: true },
      },
      responsavel: { select: { id: true, nome: true } },
    },
  })
}

export type CasoDaFicha = NonNullable<Awaited<ReturnType<typeof obterCaso>>>

/** Operadores e administradores que podem ser responsáveis por um caso. */
export async function listarResponsaveis(sessao: SessaoServidor) {
  exigirEquipe(sessao)

  return prisma.usuario.findMany({
    where: {
      perfil: { in: ['OPERADOR', 'ADMINISTRADOR'] },
      situacao: 'ATIVO',
    },
    select: { id: true, nome: true },
    orderBy: { nome: 'asc' },
  })
}

// ---------------------------------------------------------------------------
// Escrita
// ---------------------------------------------------------------------------

export type ResultadoDeCaso =
  | { situacao: 'criado'; casoId: string }
  | { situacao: 'cliente_nao_encontrado' }
  /** A numeração já está em outro caso — o número do processo é único. */
  | { situacao: 'numero_repetido'; casoId: string }

export async function criarCaso(
  sessao: SessaoServidor,
  clienteId: string,
  dados: DadosDeCaso,
  emailDoAutor: string | null,
): Promise<ResultadoDeCaso> {
  exigirEquipe(sessao)

  // Regra 2: o vínculo só vale se ESTA sessão enxerga ESTE cliente.
  const cliente = await prisma.cliente.findFirst({
    where: filtroDeClientes(sessao, { id: clienteId }),
    select: { id: true },
  })
  if (cliente === null) return { situacao: 'cliente_nao_encontrado' }

  if (dados.numeroProcesso !== null) {
    const repetido = await prisma.caso.findUnique({
      where: { numeroProcesso: dados.numeroProcesso },
      select: { id: true },
    })
    if (repetido !== null) {
      return { situacao: 'numero_repetido', casoId: repetido.id }
    }
  }

  const casoId = await prisma.$transaction(async (transacao) => {
    const criado = await transacao.caso.create({
      data: { ...dados, clienteId: cliente.id },
      select: { id: true },
    })

    await registrarAuditoria(
      {
        usuarioId: sessao.usuarioId,
        usuarioEmail: emailDoAutor,
        acao: AcaoAuditoria.CRIACAO,
        entidade: 'caso',
        entidadeId: criado.id,
        detalhes: {
          clienteId: cliente.id,
          assunto: dados.assunto,
          numeroProcesso: dados.numeroProcesso,
        },
      },
      transacao,
    )

    return criado.id
  })

  return { situacao: 'criado', casoId }
}

export type ResultadoDeEdicaoDeCaso =
  | { situacao: 'atualizado' }
  | { situacao: 'nao_encontrado' }
  | { situacao: 'numero_repetido'; casoId: string }

export async function atualizarCaso(
  sessao: SessaoServidor,
  id: string,
  dados: DadosDeCaso,
  emailDoAutor: string | null,
): Promise<ResultadoDeEdicaoDeCaso> {
  exigirEquipe(sessao)

  const alvo = await prisma.caso.findFirst({
    where: filtroDeCasos(sessao, { id }),
    select: { id: true },
  })
  if (alvo === null) return { situacao: 'nao_encontrado' }

  if (dados.numeroProcesso !== null) {
    const repetido = await prisma.caso.findFirst({
      where: { numeroProcesso: dados.numeroProcesso, id: { not: id } },
      select: { id: true },
    })
    if (repetido !== null) {
      return { situacao: 'numero_repetido', casoId: repetido.id }
    }
  }

  await prisma.$transaction(async (transacao) => {
    await transacao.caso.update({ where: { id }, data: dados })

    await registrarAuditoria(
      {
        usuarioId: sessao.usuarioId,
        usuarioEmail: emailDoAutor,
        acao: AcaoAuditoria.ATUALIZACAO,
        entidade: 'caso',
        entidadeId: id,
        detalhes: {
          assunto: dados.assunto,
          numeroProcesso: dados.numeroProcesso,
          situacao: dados.situacao,
        },
      },
      transacao,
    )
  })

  return { situacao: 'atualizado' }
}
