/**
 * POST /api/v1/atendimento/codigo — pede o código de acesso por e-mail, em
 * nome de uma conversa de atendimento (a IA no WhatsApp).
 *
 * Corpo: `{ "documento": "<CPF ou CNPJ>", "origem": "<identificador da conversa>" }`.
 *
 * É o mesmo pedido da tela `/consultar` (`pedirCodigo`), com a mesma resposta
 * única: ela é igual exista o documento ou não, tenha o cliente e-mail ou não.
 * Quem recebe o código é sempre o e-mail DO CADASTRO — nunca um endereço
 * informado por quem chama.
 */

import type { NextRequest } from 'next/server'
import { PermissaoApi } from '@prisma/client'

import { exigirCredencial, falhar, lerCorpo, responder, comoTexto } from '@/lib/api'
import { origemValida, pedirCodigoDoAtendimento } from '@/lib/acesso-do-atendimento'
import { validarPedido } from '@/lib/acesso-do-cliente'

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

  const conferido = validarPedido({ documento: comoTexto(lido.corpo.documento) })
  if (!conferido.ok) {
    return falhar('dados_invalidos', 'CPF ou CNPJ inválido.', { campos: conferido.erros })
  }

  return responder(await pedirCodigoDoAtendimento(conferido.dados.documento, origem))
}
