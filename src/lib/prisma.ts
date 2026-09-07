import { PrismaClient } from '@prisma/client'

const global_ = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  global_.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['warn', 'error']
        : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  global_.prisma = prisma
}

/**
 * Verdadeiro quando o erro é violação de índice único (P2002).
 *
 * Checar antes de inserir resolve o caso do dia a dia, mas entre a checagem e
 * a escrita cabe outra requisição. Quem garante que não há dois clientes com o
 * mesmo CPF é o índice único do banco — este auxiliar existe para traduzir a
 * recusa dele na mesma resposta que a checagem daria.
 */
export function ehViolacaoDeUnicidade(erro: unknown): boolean {
  return (
    typeof erro === 'object' &&
    erro !== null &&
    'code' in erro &&
    (erro as { code?: unknown }).code === 'P2002'
  )
}
