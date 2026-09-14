/**
 * PUT /api/v1/clientes/{id} — Anexo I, 3.b, "atualização de clientes".
 *
 * Substituição completa, não remendo: o corpo descreve o cadastro inteiro,
 * como no formulário do painel. Campo ausente vira vazio, e campo obrigatório
 * vazio é recusado — a mesma regra que o escritório pediu para a tela ("melhor
 * não deixar salvar, para não criar futuras pendências").
 */

import type { NextRequest } from 'next/server'
import { PermissaoApi } from '@prisma/client'

import { autorDaCredencial, exigirCredencial, falhar, lerCorpo, responder } from '@/lib/api'
import { atualizarCliente, validarCliente } from '@/lib/clientes'
import { camposDeClienteDoCorpo } from '@/lib/corpo-da-api'

export async function PUT(
  requisicao: NextRequest,
  contexto: { params: Promise<{ id: string }> },
) {
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

  const { id } = await contexto.params
  const { sessao } = autenticada.credencial

  const resultado = await atualizarCliente(
    sessao,
    id,
    conferido.dados,
    autorDaCredencial(autenticada.credencial),
  )

  if (resultado.situacao === 'nao_encontrado') {
    return falhar('nao_encontrado', 'Cliente não encontrado.')
  }

  if (resultado.situacao === 'documento_de_outro') {
    return falhar('conflito', `Este CPF ou CNPJ já pertence a ${resultado.nome}.`)
  }

  return responder({ clienteId: id })
}
