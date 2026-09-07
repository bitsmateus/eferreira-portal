/**
 * Auditoria — regra 6: toda escrita registra quem fez, o quê, quando e sobre
 * qual registro. Andamento lançado sem autor identificado é andamento inútil
 * como prova de diligência.
 */

import type { Prisma } from '@prisma/client'
import type { AcaoAuditoria } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export type EntradaDeAuditoria = {
  usuarioId: string | null
  usuarioEmail: string | null
  acao: AcaoAuditoria
  /** Nome do modelo tocado: 'cliente', 'caso', 'andamento', 'documento', 'usuario'. */
  entidade: string
  entidadeId: string | null
  detalhes?: Prisma.InputJsonValue
  enderecoIp?: string | null
  agenteUsuario?: string | null
}

/**
 * Grava um registro de auditoria. Aceita um cliente de transação para que a
 * escrita e o seu registro caiam ou passem juntos.
 */
export async function registrarAuditoria(
  entrada: EntradaDeAuditoria,
  transacao?: Prisma.TransactionClient,
): Promise<void> {
  const banco = transacao ?? prisma

  await banco.auditoria.create({
    data: {
      usuarioId: entrada.usuarioId,
      usuarioEmail: entrada.usuarioEmail,
      acao: entrada.acao,
      entidade: entrada.entidade,
      entidadeId: entrada.entidadeId,
      ...(entrada.detalhes !== undefined ? { detalhes: entrada.detalhes } : {}),
      enderecoIp: entrada.enderecoIp ?? null,
      agenteUsuario: entrada.agenteUsuario ?? null,
    },
  })
}
