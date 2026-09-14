/**
 * POST /api/v1/casos/{id}/andamentos — Anexo I, 3.b, "cadastro de andamentos".
 *
 * O `statusId` sai de `GET /api/v1/status`: a lista é do escritório e mora no
 * banco (dependência 3.5), não no código.
 *
 * Regra 6: o andamento nasce com autor identificado — o usuário da própria
 * credencial, que é por isso que cada chave tem um. Na linha do tempo, ele
 * aparece como "API · <nome da chave>", e não como um operador de carne e osso
 * que não digitou nada.
 *
 * Regra 12: isto continua sendo lançamento manual, feito por quem chama. A
 * captura automática de movimentações nos tribunais está fora do contrato, e
 * abrir este endpoint não a introduz — se alguém pedir para ligá-lo a um
 * robô de tribunal, pare e avise.
 */

import type { NextRequest } from 'next/server'
import { PermissaoApi } from '@prisma/client'

import { autorDaCredencial, exigirCredencial, falhar, lerCorpo, responder } from '@/lib/api'
import { lancarAndamento, validarAndamento } from '@/lib/andamentos'
import { camposDeAndamentoDoCorpo } from '@/lib/corpo-da-api'

export async function POST(
  requisicao: NextRequest,
  contexto: { params: Promise<{ id: string }> },
) {
  const autenticada = await exigirCredencial(requisicao, PermissaoApi.ESCREVER)
  if (!autenticada.ok) return autenticada.resposta

  const lido = await lerCorpo(requisicao)
  if (!lido.ok) return lido.resposta

  const conferido = validarAndamento(camposDeAndamentoDoCorpo(lido.corpo))

  if (!conferido.ok) {
    return falhar('dados_invalidos', 'Há campos inválidos ou faltando.', {
      campos: conferido.erros,
    })
  }

  const { id } = await contexto.params
  const { sessao } = autenticada.credencial

  const resultado = await lancarAndamento(
    sessao,
    id,
    conferido.dados,
    autorDaCredencial(autenticada.credencial),
  )

  if (resultado.situacao === 'caso_nao_encontrado') {
    return falhar('nao_encontrado', 'Caso não encontrado.')
  }

  if (resultado.situacao === 'status_invalido') {
    return falhar('dados_invalidos', 'Situação inválida.', {
      campos: {
        statusId: 'Não está na lista do escritório. Consulte GET /api/v1/status.',
      },
    })
  }

  return responder({ andamentoId: resultado.andamentoId, casoId: id }, 201)
}
