/**
 * GET /api/v1/status — a lista de situações de andamento do escritório.
 *
 * Sem ela não dá para lançar andamento pela API: `statusId` é obrigatório e os
 * identificadores vêm do banco, não do código — o escritório pode mudar a
 * lista sem nova versão do sistema (dependência 3.5).
 */

import type { NextRequest } from 'next/server'
import { PermissaoApi } from '@prisma/client'

import { exigirCredencial, responder } from '@/lib/api'
import { listarStatus } from '@/lib/andamentos'

export async function GET(requisicao: NextRequest) {
  const autenticada = await exigirCredencial(requisicao, PermissaoApi.CONSULTAR)
  if (!autenticada.ok) return autenticada.resposta

  const status = await listarStatus()

  return responder({
    status: status.map((situacao) => ({
      id: situacao.id,
      nome: situacao.nome,
      ordem: situacao.ordem,
    })),
  })
}
