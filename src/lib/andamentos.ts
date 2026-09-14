/**
 * Andamentos — Anexo I, item 2.4.
 *
 * O andamento é o que o cliente lê na área de consulta: data, situação e um
 * texto escrito para quem não é advogado. O escritório confirmou (14/09/2026)
 * que o cliente recebe **a mensagem resumo** e, se não bastar, fala com o
 * atendimento — por isso não há status interno e a descrição é obrigatória.
 *
 * Regra 6: andamento sem autor identificado é inútil como prova de
 * diligência, então `autorId` não é opcional em lugar nenhum deste arquivo.
 * Regra 11: a data é dia civil, guardada em UTC e exibida em São Paulo.
 * Regra 12: o lançamento é manual. Captura automática de movimentações nos
 * tribunais está fora do contrato — não existe aqui nem "preparada para".
 */

import { AcaoAuditoria, type Prisma } from '@prisma/client'
import { z } from 'zod'

import { exigirEquipe, filtroDeAndamentos, filtroDeCasos, type SessaoServidor } from '@/lib/autorizacao'
import { prisma } from '@/lib/prisma'
import { registrarAuditoria } from '@/lib/auditoria'
import { diaCivilParaData, diaEmSaoPaulo } from '@/lib/datas'
import { errosPorCampo, type ResultadoDeFormulario } from '@/lib/formulario'

// ---------------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------------

const dataDoAndamento = z
  .string()
  .trim()
  .transform((valor, contexto) => {
    if (valor === '') {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe a data do andamento.',
      })
      return z.NEVER
    }

    const data = diaCivilParaData(valor)
    if (data === null) {
      contexto.addIssue({ code: z.ZodIssueCode.custom, message: 'Data inválida.' })
      return z.NEVER
    }

    // Andamento é registro do que já aconteceu. Data futura seria previsão, e
    // previsão na linha do tempo do cliente vira promessa.
    if (valor > diaEmSaoPaulo(new Date())) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A data do andamento não pode estar no futuro.',
      })
      return z.NEVER
    }

    return data
  })

export const esquemaDeAndamento = z.object({
  data: dataDoAndamento,
  statusId: z
    .string()
    .trim()
    .min(1, 'Escolha a situação do processo.'),
  descricao: z
    .string()
    .trim()
    .min(10, 'Escreva o que aconteceu, pensando em quem não é advogado.')
    .max(2000, 'Descrição longa demais.'),
})

export type DadosDeAndamento = z.output<typeof esquemaDeAndamento>
export type CamposDeAndamento = Record<keyof z.input<typeof esquemaDeAndamento>, string>

export function validarAndamento(
  campos: CamposDeAndamento,
): ResultadoDeFormulario<DadosDeAndamento> {
  const conferido = esquemaDeAndamento.safeParse(campos)
  if (!conferido.success) {
    return { ok: false, erros: errosPorCampo(conferido.error) }
  }
  return { ok: true, dados: conferido.data }
}

// ---------------------------------------------------------------------------
// Status configuráveis
// ---------------------------------------------------------------------------

/**
 * A lista do escritório, em ordem. Veio da dependência 3.5 e está cadastrada
 * por migração — não é constante no código, justamente para o escritório poder
 * mudá-la sem depender de uma nova versão do sistema.
 */
export async function listarStatus() {
  return prisma.statusAndamento.findMany({
    where: { ativo: true },
    select: { id: true, nome: true, ordem: true },
    orderBy: { ordem: 'asc' },
  })
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

const RESUMO = {
  id: true,
  data: true,
  descricao: true,
  criadoEm: true,
  status: { select: { id: true, nome: true } },
  autor: { select: { nome: true } },
  caso: {
    select: {
      id: true,
      numeroProcesso: true,
      assunto: true,
      cliente: { select: { id: true, nome: true } },
    },
  },
} satisfies Prisma.AndamentoSelect

export type LinhaDeAndamento = Prisma.AndamentoGetPayload<{ select: typeof RESUMO }>

/** A linha do tempo de um caso, do mais recente para o mais antigo. */
export async function listarAndamentosDoCaso(
  sessao: SessaoServidor,
  casoId: string,
): Promise<LinhaDeAndamento[]> {
  return prisma.andamento.findMany({
    where: filtroDeAndamentos(sessao, { casoId }),
    select: RESUMO,
    orderBy: [{ data: 'desc' }, { criadoEm: 'desc' }],
  })
}

/** Os últimos andamentos de todos os casos — o bloco do painel. */
export async function listarUltimosAndamentos(
  sessao: SessaoServidor,
  quantidade = 8,
): Promise<LinhaDeAndamento[]> {
  return prisma.andamento.findMany({
    where: filtroDeAndamentos(sessao),
    select: RESUMO,
    orderBy: [{ data: 'desc' }, { criadoEm: 'desc' }],
    take: quantidade,
  })
}

export async function contarAndamentos(sessao: SessaoServidor): Promise<number> {
  return prisma.andamento.count({ where: filtroDeAndamentos(sessao) })
}

// ---------------------------------------------------------------------------
// Escrita
// ---------------------------------------------------------------------------

export type ResultadoDeAndamento =
  | { situacao: 'lancado'; andamentoId: string }
  | { situacao: 'caso_nao_encontrado' }
  /** O status escolhido não existe ou foi desativado pelo escritório. */
  | { situacao: 'status_invalido' }

export async function lancarAndamento(
  sessao: SessaoServidor,
  casoId: string,
  dados: DadosDeAndamento,
  emailDoAutor: string | null,
): Promise<ResultadoDeAndamento> {
  exigirEquipe(sessao)

  // Regra 2: só se lança andamento em caso que ESTA sessão enxerga.
  const caso = await prisma.caso.findFirst({
    where: filtroDeCasos(sessao, { id: casoId }),
    select: { id: true, clienteId: true },
  })
  if (caso === null) return { situacao: 'caso_nao_encontrado' }

  // O `statusId` vem de um <select>, e o navegador manda o que quiser.
  const status = await prisma.statusAndamento.findFirst({
    where: { id: dados.statusId, ativo: true },
    select: { id: true, nome: true },
  })
  if (status === null) return { situacao: 'status_invalido' }

  const andamentoId = await prisma.$transaction(async (transacao) => {
    const criado = await transacao.andamento.create({
      data: {
        casoId: caso.id,
        data: dados.data,
        statusId: status.id,
        descricao: dados.descricao,
        autorId: sessao.usuarioId,
      },
      select: { id: true },
    })

    await registrarAuditoria(
      {
        usuarioId: sessao.usuarioId,
        usuarioEmail: emailDoAutor,
        acao: AcaoAuditoria.CRIACAO,
        entidade: 'andamento',
        entidadeId: criado.id,
        detalhes: {
          casoId: caso.id,
          clienteId: caso.clienteId,
          status: status.nome,
          data: dados.data.toISOString(),
        },
      },
      transacao,
    )

    return criado.id
  })

  return { situacao: 'lancado', andamentoId }
}
