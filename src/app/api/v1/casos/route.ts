/**
 * POST /api/v1/casos — Anexo I, 3.b, "cadastro de casos".
 *
 * O cliente pode vir por `clienteId` ou por `documento`: quem integra um site
 * institucional costuma ter o CPF em mãos, não o identificador interno, e
 * obrigá-lo a consultar antes de escrever seria burocracia sem ganho.
 *
 * Honorários e parcelas ficam fora de propósito. São a cláusula de pagamento
 * do contrato, digitada pelo escritório junto com o documento que vai ser
 * assinado — e a regra 12 já marca essa fronteira: registrar valor de contrato
 * é uma coisa, módulo financeiro é outra, e não se abre porta de API para ela.
 */

import type { NextRequest } from 'next/server'
import { PermissaoApi } from '@prisma/client'

import { autorDaCredencial, comoTexto, exigirCredencial, falhar, lerCorpo, responder } from '@/lib/api'
import { criarCaso, validarCaso } from '@/lib/casos'
import { camposDeCasoDoCorpo } from '@/lib/corpo-da-api'
import { documentoValido, normalizarDocumento } from '@/lib/documento'
import { filtroDeClientes } from '@/lib/autorizacao'
import { prisma } from '@/lib/prisma'
import type { SessaoServidor } from '@/lib/autorizacao'

/**
 * Resolve o cliente a partir de `clienteId` ou de `documento`.
 *
 * Regra 2: mesmo vindo do corpo da requisição, o cliente só é encontrado se
 * `filtroDeClientes` disser que esta sessão o enxerga.
 */
async function acharCliente(
  sessao: SessaoServidor,
  corpo: Record<string, unknown>,
): Promise<{ id: string } | null> {
  const clienteId = comoTexto(corpo['clienteId']).trim()
  if (clienteId !== '') {
    return prisma.cliente.findFirst({
      where: filtroDeClientes(sessao, { id: clienteId }),
      select: { id: true },
    })
  }

  const documento = normalizarDocumento(comoTexto(corpo['documento']))
  if (documento === '' || !documentoValido(documento)) return null

  return prisma.cliente.findFirst({
    where: filtroDeClientes(sessao, { documento }),
    select: { id: true },
  })
}

export async function POST(requisicao: NextRequest) {
  const autenticada = await exigirCredencial(requisicao, PermissaoApi.ESCREVER)
  if (!autenticada.ok) return autenticada.resposta

  const lido = await lerCorpo(requisicao)
  if (!lido.ok) return lido.resposta

  const { sessao } = autenticada.credencial

  const cliente = await acharCliente(sessao, lido.corpo)
  if (cliente === null) {
    return falhar(
      'nao_encontrado',
      'Cliente não encontrado. Informe clienteId ou documento de um cliente cadastrado.',
    )
  }

  const conferido = validarCaso(camposDeCasoDoCorpo(lido.corpo))
  if (!conferido.ok) {
    return falhar('dados_invalidos', 'Há campos inválidos ou faltando.', {
      campos: conferido.erros,
    })
  }

  const resultado = await criarCaso(
    sessao,
    cliente.id,
    conferido.dados,
    [],
    autorDaCredencial(autenticada.credencial),
  )

  if (resultado.situacao === 'cliente_nao_encontrado') {
    return falhar('nao_encontrado', 'Cliente não encontrado.')
  }

  if (resultado.situacao === 'numero_repetido') {
    return falhar(
      'conflito',
      'Já existe um caso com este número de processo.',
      { conflito: { casoId: resultado.casoId } },
    )
  }

  if (resultado.situacao === 'responsavel_invalido') {
    return falhar('dados_invalidos', 'Responsável inválido.', {
      campos: { responsavelId: 'Não é operador nem administrador ativo.' },
    })
  }

  if (resultado.situacao === 'empresa_invalida') {
    return falhar('dados_invalidos', 'Empresa inválida.', {
      campos: { empresaVinculadaId: 'Não é uma empresa (pessoa jurídica) cadastrada.' },
    })
  }

  return responder({ casoId: resultado.casoId, clienteId: cliente.id }, 201)
}
