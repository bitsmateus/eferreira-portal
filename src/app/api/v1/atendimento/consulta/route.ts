/**
 * GET /api/v1/atendimento/consulta?documento=<CPF ou CNPJ>&origem=<conversa>
 *
 * Os casos DO cliente com aquele documento — o mesmo recorte de
 * `/api/v1/consulta` —, mas só depois que a conversa acertou o código por
 * e-mail para este documento (`/atendimento/codigo` e `/atendimento/validar`).
 * Sem isso: `403 nao_verificado`, sem dizer se o documento existe.
 */

import type { NextRequest } from 'next/server'
import { PermissaoApi } from '@prisma/client'

import { exigirCredencial, falhar, responder } from '@/lib/api'
import { acessoVerificado, origemValida } from '@/lib/acesso-do-atendimento'
import { consultarPorDocumento } from '@/lib/consulta-da-api'
import { documentoValido, normalizarDocumento } from '@/lib/documento'

export async function GET(requisicao: NextRequest) {
  const autenticada = await exigirCredencial(requisicao, PermissaoApi.CONSULTAR)
  if (!autenticada.ok) return autenticada.resposta

  const documento = normalizarDocumento(requisicao.nextUrl.searchParams.get('documento') ?? '')
  const origem = requisicao.nextUrl.searchParams.get('origem') ?? ''

  if (documento === '' || !documentoValido(documento)) {
    return falhar('dados_invalidos', 'CPF ou CNPJ inválido.', {
      campos: { documento: 'Informe um CPF ou CNPJ válido.' },
    })
  }

  if (!origemValida(origem)) {
    return falhar('dados_invalidos', 'Informe a origem (identificador da conversa).', {
      campos: { origem: 'Obrigatório, de 4 a 80 caracteres.' },
    })
  }

  if (!(await acessoVerificado(documento, origem))) {
    return falhar(
      'nao_verificado',
      'Confirme o código enviado por e-mail antes de consultar (/atendimento/codigo e /atendimento/validar).',
    )
  }

  const resultado = await consultarPorDocumento(autenticada.credencial.sessao, documento, false)

  if (resultado === null) {
    return falhar('nao_encontrado', 'Nenhum cliente com este CPF ou CNPJ.')
  }

  return responder(resultado)
}
