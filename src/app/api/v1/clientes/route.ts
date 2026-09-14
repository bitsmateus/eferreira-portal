/**
 * POST /api/v1/clientes — Anexo I, 3.b, "cadastro de clientes".
 *
 * A validação é a MESMA do painel (`validarCliente`): dígito verificador do
 * CPF/CNPJ, campos obrigatórios definidos pelo escritório, tudo. Se a API
 * tivesse regra própria, um dia aceitaria um cadastro que a tela recusa — e o
 * sistema passaria a ter duas opiniões sobre o que é cliente válido.
 *
 * Documento já cadastrado não vira segundo registro: devolve 409 com o id do
 * cliente existente, que é o "reconhecimento" da regra 4 traduzido para API.
 */

import type { NextRequest } from 'next/server'
import { PermissaoApi } from '@prisma/client'

import { autorDaCredencial, exigirCredencial, falhar, lerCorpo, responder } from '@/lib/api'
import { criarCliente, validarCliente } from '@/lib/clientes'
import { camposDeClienteDoCorpo } from '@/lib/corpo-da-api'

export async function POST(requisicao: NextRequest) {
  const autenticada = await exigirCredencial(requisicao, PermissaoApi.ESCREVER)
  if (!autenticada.ok) return autenticada.resposta

  const lido = await lerCorpo(requisicao)
  if (!lido.ok) return lido.resposta

  const conferido = validarCliente(camposDeClienteDoCorpo(lido.corpo))
  if (!conferido.ok) {
    return falhar('dados_invalidos', 'Há campos inválidos ou faltando.', {
      campos: conferido.erros,
    })
  }

  const { sessao } = autenticada.credencial
  const resultado = await criarCliente(
    sessao,
    conferido.dados,
    autorDaCredencial(autenticada.credencial),
  )

  if (resultado.situacao === 'ja_existe') {
    return falhar(
      'conflito',
      'Este CPF ou CNPJ já está cadastrado. Atualize o cliente existente em vez de criar outro.',
      { conflito: { clienteId: resultado.clienteId, nome: resultado.nome } },
    )
  }

  return responder({ clienteId: resultado.clienteId }, 201)
}
