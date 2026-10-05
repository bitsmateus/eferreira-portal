/**
 * GET /api/v1/atendimento/consulta/empresa?documento=<CNPJ>&origem=<conversa>
 *
 * Os casos ligados a uma empresa — o mesmo recorte de
 * `/api/v1/consulta/empresa` —, só depois que a conversa acertou o código por
 * e-mail para o CNPJ DA EMPRESA (o código vai para o e-mail da empresa, que é
 * quem tem acesso a esses casos no portal: regra 3).
 *
 * Diferença deliberada: cada caso traz só o NOME do cliente a quem pertence.
 * O CPF e o id de terceiros não têm utilidade numa conversa de WhatsApp, e
 * dado que não sai não vaza.
 */

import type { NextRequest } from 'next/server'
import { PermissaoApi } from '@prisma/client'

import { exigirCredencial, falhar, responder } from '@/lib/api'
import { acessoVerificado, origemValida } from '@/lib/acesso-do-atendimento'
import { consultarCasosDaEmpresa } from '@/lib/consulta-da-api'
import { documentoValido, normalizarDocumento } from '@/lib/documento'

export async function GET(requisicao: NextRequest) {
  const autenticada = await exigirCredencial(requisicao, PermissaoApi.CONSULTAR)
  if (!autenticada.ok) return autenticada.resposta

  const documento = normalizarDocumento(requisicao.nextUrl.searchParams.get('documento') ?? '')
  const origem = requisicao.nextUrl.searchParams.get('origem') ?? ''

  if (documento.length !== 14 || !documentoValido(documento)) {
    return falhar('dados_invalidos', 'CNPJ inválido.', {
      campos: { documento: 'Informe um CNPJ válido — a empresa é sempre pessoa jurídica.' },
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

  const resultado = await consultarCasosDaEmpresa(autenticada.credencial.sessao, documento, false)

  if (resultado === null) {
    return falhar('nao_encontrado', 'Nenhuma empresa cadastrada com este CNPJ.')
  }

  return responder({
    empresa: { nome: resultado.empresa.nome, documentoFormatado: resultado.empresa.documentoFormatado },
    total: resultado.casos.length,
    casos: resultado.casos.map((caso) => ({
      id: caso.id,
      cliente: caso.cliente.nome,
      processo: caso.processo,
      assunto: caso.assunto,
      vara: caso.vara,
      situacao: caso.situacao,
      situacaoRotulo: caso.situacaoRotulo,
      andamento: caso.andamento,
    })),
  })
}
