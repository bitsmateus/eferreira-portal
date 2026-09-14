/**
 * GET /api/v1/credencial — quem sou eu.
 *
 * Existe para o integrador descobrir sozinho se a chave chegou certa, em que
 * ambiente ela vale e o que ela pode fazer. É o primeiro endpoint da
 * documentação, e o que evita a pergunta "a chave que vocês me mandaram está
 * funcionando?".
 */

import type { NextRequest } from 'next/server'

import { VERSAO_DA_API, exigirQualquerCredencial, responder } from '@/lib/api'
import { PREFIXO_PRODUCAO, prefixoDoAmbiente } from '@/lib/chave-de-api'

export async function GET(requisicao: NextRequest) {
  const autenticada = await exigirQualquerCredencial(requisicao)
  if (!autenticada.ok) return autenticada.resposta

  return responder({
    nome: autenticada.credencial.nome,
    permissoes: autenticada.credencial.permissoes,
    ambiente: prefixoDoAmbiente() === PREFIXO_PRODUCAO ? 'producao' : 'testes',
    versao: VERSAO_DA_API,
  })
}
