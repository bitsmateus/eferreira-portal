/**
 * O que a conta da ZapSign tem — `npm run zapsign:conta`.
 *
 * Confere a chave e o plano SEM criar documento (criar conta no plano). Lê só
 * GET /info-plan/ e mostra a configuração do envio. Nunca imprime a chave nem
 * o segredo do retorno.
 */

import 'dotenv/config'
import {
  descreverFalhaDaZapSign,
  exigirSelfie,
  modoDeAutenticacao,
  zapsignAtiva,
} from '../src/lib/zapsign'

async function principal(): Promise<void> {
  if (!zapsignAtiva()) {
    console.error('ZapSign não configurada. Preencha ZAPSIGN_API_TOKEN (ver .env.example).')
    process.exitCode = 1
    return
  }

  const base = (process.env['ZAPSIGN_BASE_URL'] ?? '').trim() || 'https://api.zapsign.com.br/api/v1'
  console.log(`Endereço da API: ${base}`)
  console.log(`Provedor dos envios novos: ${process.env['ASSINATURA_PROVEDOR'] || 'd4sign (padrão)'}`)
  console.log(
    `Identificação do signatário: ${modoDeAutenticacao()}${exigirSelfie() ? ' + selfie (foto do rosto)' : ''}`,
  )
  console.log(
    (process.env['ZAPSIGN_RETORNO_SEGREDO'] ?? '').trim() === ''
      ? 'Retorno automático: DESLIGADO (falta ZAPSIGN_RETORNO_SEGREDO) — só pelo botão "Conferir agora".'
      : 'Retorno automático: configurado — cadastre na ZapSign https://portal.eferreira.adv.br/api/zapsign/retorno?chave=<ZAPSIGN_RETORNO_SEGREDO>',
  )

  try {
    const resposta = await fetch(`${base.replace(/\/+$/, '')}/info-plan/`, {
      headers: {
        Authorization: `Bearer ${process.env['ZAPSIGN_API_TOKEN']?.trim()}`,
        'User-Agent': 'PortalEFerreira/1.0',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(20_000),
    })
    if (!resposta.ok) {
      console.error(
        resposta.status === 401 || resposta.status === 403
          ? 'A ZapSign RECUSOU a chave.'
          : resposta.status === 402
            ? 'A chave vale, mas o plano não inclui a API ou está com pagamento pendente.'
            : `A ZapSign respondeu ${resposta.status}.`,
      )
      process.exitCode = 1
      return
    }
    const plano = (await resposta.json()) as Record<string, unknown>
    console.log(`Chave aceita. Plano: ${String(plano['name'] ?? '?')} · situação: ${String(plano['status'] ?? '?')}`)
    if (typeof plano['number_of_credits'] === 'number') {
      console.log(`Documentos do plano: ${plano['number_of_credits']}`)
    }
  } catch (erro) {
    console.error(descreverFalhaDaZapSign(erro))
    process.exitCode = 1
  }
}

void principal()
