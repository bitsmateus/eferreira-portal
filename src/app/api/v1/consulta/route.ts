/**
 * GET /api/v1/consulta?documento=<CPF ou CNPJ> — Anexo I, 3.b.
 *
 * "consulta por CPF ou CNPJ, com retorno do número do processo e do
 * andamento". Devolve o último andamento de cada caso; com `?historico=true`,
 * a linha do tempo inteira.
 */

import type { NextRequest } from 'next/server'
import { PermissaoApi } from '@prisma/client'

import { exigirCredencial, falhar, responder } from '@/lib/api'
import { consultarPorDocumento } from '@/lib/consulta-da-api'
import { documentoValido, normalizarDocumento } from '@/lib/documento'

export async function GET(requisicao: NextRequest) {
  const autenticada = await exigirCredencial(requisicao, PermissaoApi.CONSULTAR)
  if (!autenticada.ok) return autenticada.resposta

  const bruto = requisicao.nextUrl.searchParams.get('documento') ?? ''
  const documento = normalizarDocumento(bruto)

  if (documento === '') {
    return falhar('dados_invalidos', 'Informe o parâmetro documento.', {
      campos: { documento: 'Obrigatório.' },
    })
  }

  // Regra 4: dígito verificador, não só máscara. Documento malformado é erro
  // do integrador e merece resposta diferente de "não encontrei".
  if (!documentoValido(documento)) {
    return falhar('dados_invalidos', 'CPF ou CNPJ inválido.', {
      campos: { documento: 'Reprova no dígito verificador.' },
    })
  }

  const resultado = await consultarPorDocumento(
    autenticada.credencial.sessao,
    documento,
    requisicao.nextUrl.searchParams.get('historico') === 'true',
  )

  if (resultado === null) {
    return falhar('nao_encontrado', 'Nenhum cliente com este CPF ou CNPJ.')
  }

  return responder(resultado)
}
