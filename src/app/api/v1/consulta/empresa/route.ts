/**
 * GET /api/v1/consulta/empresa?documento=<CNPJ> — os casos ligados a uma
 * empresa (24/09/2026): "casos da GWA", "casos da Mais Credit".
 *
 * Diferente de `/consulta`, que devolve os casos DO cliente com aquele
 * documento: aqui vêm os casos de OUTROS clientes que estão ligados à empresa
 * — cada um com o cliente a que pertence. Com `?historico=true`, a linha do
 * tempo inteira de cada caso.
 */

import type { NextRequest } from 'next/server'
import { PermissaoApi } from '@prisma/client'

import { exigirCredencial, falhar, responder } from '@/lib/api'
import { consultarCasosDaEmpresa } from '@/lib/consulta-da-api'
import { documentoValido, normalizarDocumento } from '@/lib/documento'

export async function GET(requisicao: NextRequest) {
  const autenticada = await exigirCredencial(requisicao, PermissaoApi.CONSULTAR)
  if (!autenticada.ok) return autenticada.resposta

  const documento = normalizarDocumento(requisicao.nextUrl.searchParams.get('documento') ?? '')

  if (documento === '') {
    return falhar('dados_invalidos', 'Informe o parâmetro documento.', {
      campos: { documento: 'Obrigatório.' },
    })
  }

  if (documento.length !== 14 || !documentoValido(documento)) {
    return falhar('dados_invalidos', 'CNPJ inválido.', {
      campos: { documento: 'Informe um CNPJ válido — a empresa é sempre pessoa jurídica.' },
    })
  }

  const resultado = await consultarCasosDaEmpresa(
    autenticada.credencial.sessao,
    documento,
    requisicao.nextUrl.searchParams.get('historico') === 'true',
  )

  if (resultado === null) {
    return falhar('nao_encontrado', 'Nenhuma empresa cadastrada com este CNPJ.')
  }

  return responder(resultado)
}
