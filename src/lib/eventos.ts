/**
 * Eventos do caso — prazos e tarefas internas da equipe (05/10/2026).
 *
 * Pedido do escritório: "criar evento" com responsável, assunto/atividade,
 * data de criação e prazo de entrega. Na primeira resposta isto foi RECUSADO
 * por bater exatamente com "gestão de prazos, tarefas e agenda da equipe" —
 * Anexo II, item 2 (Fases futuras), fora do contrato original (regra 12). O
 * escritório e o dono do sistema acordaram, separadamente, contratar isto
 * como módulo adicional; é por isso que este arquivo existe, e não uma
 * reinterpretação da regra 12. Ver CLAUDE.md, "Estado atual".
 *
 * É interno à equipe, não ao cliente: o Anexo I nunca previu isto na área de
 * consulta, e por isso TODA função abaixo começa chamando `exigirEquipe` —
 * nenhuma aceita sessão de perfil CLIENTE. Também não é um documento dentro
 * da pasta do caso: é registro próprio, com responsável e prazo, como a
 * recusa original já descrevia que o módulo deveria ser.
 */

import { AcaoAuditoria, PerfilUsuario, SituacaoUsuario, type Prisma } from '@prisma/client'
import { z } from 'zod'

import { exigirEquipe, filtroDeCasos, type SessaoServidor } from '@/lib/autorizacao'
import { prisma } from '@/lib/prisma'
import { registrarAuditoria } from '@/lib/auditoria'
import { diaCivilParaData } from '@/lib/datas'
import { errosPorCampo, type ResultadoDeFormulario } from '@/lib/formulario'

// ---------------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------------

const prazoDeEntrega = z
  .string()
  .trim()
  .transform((valor, contexto) => {
    if (valor === '') {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe o prazo de entrega.',
      })
      return z.NEVER
    }

    const data = diaCivilParaData(valor)
    if (data === null) {
      contexto.addIssue({ code: z.ZodIssueCode.custom, message: 'Data inválida.' })
      return z.NEVER
    }

    return data
  })

export const esquemaDeEvento = z.object({
  responsavelId: z.string().trim().min(1, 'Escolha o responsável.'),
  assunto: z
    .string()
    .trim()
    .min(3, 'Descreva o assunto ou a atividade.')
    .max(180, 'Assunto longo demais.'),
  prazoDeEntrega,
})

export type DadosDeEvento = z.output<typeof esquemaDeEvento>
export type CamposDeEvento = Record<keyof z.input<typeof esquemaDeEvento>, string>

export function validarEvento(campos: CamposDeEvento): ResultadoDeFormulario<DadosDeEvento> {
  const conferido = esquemaDeEvento.safeParse(campos)
  if (!conferido.success) {
    return { ok: false, erros: errosPorCampo(conferido.error) }
  }
  return { ok: true, dados: conferido.data }
}

/**
 * Confere que o responsável escolhido existe e é da equipe do escritório —
 * mesma conferência de `responsavelEhValido` em `src/lib/casos.ts`. O id vem
 * de um `<select>` do navegador, então nada aqui confia nele sem checar.
 */
async function responsavelEhValido(responsavelId: string): Promise<boolean> {
  const encontrado = await prisma.usuario.findFirst({
    where: {
      id: responsavelId,
      perfil: { in: [PerfilUsuario.OPERADOR, PerfilUsuario.ADMINISTRADOR] },
      situacao: SituacaoUsuario.ATIVO,
    },
    select: { id: true },
  })
  return encontrado !== null
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

const RESUMO = {
  id: true,
  assunto: true,
  prazoDeEntrega: true,
  cumpridoEm: true,
  criadoEm: true,
  responsavel: { select: { id: true, nome: true } },
  criadoPor: { select: { nome: true } },
} satisfies Prisma.EventoSelect

export type LinhaDeEvento = Prisma.EventoGetPayload<{ select: typeof RESUMO }>

/** Os eventos de um caso: pendentes primeiro (pelo prazo mais próximo), cumpridos depois. */
export async function listarEventosDoCaso(
  sessao: SessaoServidor,
  casoId: string,
): Promise<LinhaDeEvento[]> {
  exigirEquipe(sessao)

  return prisma.evento.findMany({
    where: { casoId, caso: filtroDeCasos(sessao) },
    select: RESUMO,
    orderBy: [{ cumpridoEm: { sort: 'asc', nulls: 'first' } }, { prazoDeEntrega: 'asc' }],
  })
}

// ---------------------------------------------------------------------------
// Escrita
// ---------------------------------------------------------------------------

export type ResultadoDeEvento =
  | { situacao: 'criado'; eventoId: string }
  | { situacao: 'caso_nao_encontrado' }
  | { situacao: 'responsavel_invalido' }

export async function criarEvento(
  sessao: SessaoServidor,
  casoId: string,
  dados: DadosDeEvento,
  emailDoAutor: string | null,
): Promise<ResultadoDeEvento> {
  exigirEquipe(sessao)

  // Regra 2: só se cria evento em caso que ESTA sessão enxerga.
  const caso = await prisma.caso.findFirst({
    where: filtroDeCasos(sessao, { id: casoId }),
    select: { id: true, clienteId: true },
  })
  if (caso === null) return { situacao: 'caso_nao_encontrado' }

  if (!(await responsavelEhValido(dados.responsavelId))) {
    return { situacao: 'responsavel_invalido' }
  }

  const eventoId = await prisma.$transaction(async (transacao) => {
    const criado = await transacao.evento.create({
      data: {
        casoId: caso.id,
        responsavelId: dados.responsavelId,
        assunto: dados.assunto,
        prazoDeEntrega: dados.prazoDeEntrega,
        criadoPorId: sessao.usuarioId,
      },
      select: { id: true },
    })

    await registrarAuditoria(
      {
        usuarioId: sessao.usuarioId,
        usuarioEmail: emailDoAutor,
        acao: AcaoAuditoria.CRIACAO,
        entidade: 'evento',
        entidadeId: criado.id,
        detalhes: {
          casoId: caso.id,
          clienteId: caso.clienteId,
          responsavelId: dados.responsavelId,
          assunto: dados.assunto,
          prazoDeEntrega: dados.prazoDeEntrega.toISOString(),
        },
      },
      transacao,
    )

    return criado.id
  })

  return { situacao: 'criado', eventoId }
}

export type ResultadoDeConclusaoDeEvento =
  | { situacao: 'atualizado' }
  | { situacao: 'nao_encontrado' }

/**
 * Marca ou desmarca o evento como cumprido. Repetir o mesmo estado (marcar de
 * novo o que já está cumprido, ou desmarcar o que já está pendente) não grava
 * nada — não é fato novo, mesmo padrão de `encerraOCaso` em `andamentos.ts`.
 */
export async function definirCumprimentoDoEvento(
  sessao: SessaoServidor,
  eventoId: string,
  cumprido: boolean,
  emailDoAutor: string | null,
): Promise<ResultadoDeConclusaoDeEvento> {
  exigirEquipe(sessao)

  const evento = await prisma.evento.findFirst({
    where: { id: eventoId, caso: filtroDeCasos(sessao) },
    select: { id: true, casoId: true, cumpridoEm: true },
  })
  if (evento === null) return { situacao: 'nao_encontrado' }

  const jaNoEstadoPedido = cumprido ? evento.cumpridoEm !== null : evento.cumpridoEm === null
  if (jaNoEstadoPedido) return { situacao: 'atualizado' }

  await prisma.$transaction(async (transacao) => {
    await transacao.evento.update({
      where: { id: evento.id },
      data: { cumpridoEm: cumprido ? new Date() : null },
    })

    await registrarAuditoria(
      {
        usuarioId: sessao.usuarioId,
        usuarioEmail: emailDoAutor,
        acao: AcaoAuditoria.ATUALIZACAO,
        entidade: 'evento',
        entidadeId: evento.id,
        detalhes: { casoId: evento.casoId, cumprido },
      },
      transacao,
    )
  })

  return { situacao: 'atualizado' }
}

export type ResultadoDeExclusaoDeEvento =
  | { situacao: 'excluido' }
  | { situacao: 'nao_encontrado' }

export async function excluirEvento(
  sessao: SessaoServidor,
  eventoId: string,
  emailDoAutor: string | null,
): Promise<ResultadoDeExclusaoDeEvento> {
  exigirEquipe(sessao)

  const evento = await prisma.evento.findFirst({
    where: { id: eventoId, caso: filtroDeCasos(sessao) },
    select: { id: true, casoId: true, assunto: true },
  })
  if (evento === null) return { situacao: 'nao_encontrado' }

  await prisma.$transaction(async (transacao) => {
    await transacao.evento.delete({ where: { id: evento.id } })

    await registrarAuditoria(
      {
        usuarioId: sessao.usuarioId,
        usuarioEmail: emailDoAutor,
        acao: AcaoAuditoria.EXCLUSAO,
        entidade: 'evento',
        entidadeId: evento.id,
        detalhes: { casoId: evento.casoId, assunto: evento.assunto },
      },
      transacao,
    )
  })

  return { situacao: 'excluido' }
}
