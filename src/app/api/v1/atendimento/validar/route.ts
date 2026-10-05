/**
 * POST /api/v1/atendimento/validar — confere o código que o cliente recebeu
 * por e-mail.
 *
 * Corpo: `{ "documento": "...", "codigo": "123456", "origem": "..." }`.
 *
 * `confere` abre a consulta (`/atendimento/consulta*`) para ESTA origem e ESTE
 * documento por `MINUTOS_DE_ACESSO_DO_ATENDIMENTO`. `nao_confere` é um motivo
 * só — documento, código, validade e tentativas esgotadas caem todos nele.
 * As mesmas cinco tentativas por código do portal valem aqui.
 */

import type { NextRequest } from 'next/server'
import { PermissaoApi } from '@prisma/client'

import { exigirCredencial, falhar, lerCorpo, responder, comoTexto } from '@/lib/api'
import { conferirCodigoDoAtendimento, origemValida } from '@/lib/acesso-do-atendimento'
import { validarConferencia } from '@/lib/acesso-do-cliente'

export async function POST(requisicao: NextRequest) {
  const autenticada = await exigirCredencial(requisicao, PermissaoApi.CONSULTAR)
  if (!autenticada.ok) return autenticada.resposta

  const lido = await lerCorpo(requisicao)
  if (!lido.ok) return lido.resposta

  const origem = comoTexto(lido.corpo.origem)
  if (!origemValida(origem)) {
    return falhar('dados_invalidos', 'Informe a origem (identificador da conversa).', {
      campos: { origem: 'Obrigatório, de 4 a 80 caracteres.' },
    })
  }

  const conferido = validarConferencia({
    documento: comoTexto(lido.corpo.documento),
    codigo: comoTexto(lido.corpo.codigo),
  })
  if (!conferido.ok) {
    return falhar('dados_invalidos', 'Documento ou código em formato inválido.', {
      campos: conferido.erros,
    })
  }

  return responder(
    await conferirCodigoDoAtendimento(
      conferido.dados.documento,
      conferido.dados.codigo,
      origem,
    ),
  )
}
