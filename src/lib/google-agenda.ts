/**
 * Google Agenda do escritório (14/10/2026): cada evento do caso criado no
 * portal também vira evento na agenda compartilhada.
 *
 * É conveniência, nunca autoridade — mesmo princípio de `cep.ts`: sem as três
 * variáveis `GOOGLE_*`, ou com o Google fora do ar, devolve `null` e o evento
 * continua existindo no portal. Criar evento não pode depender de terceiro.
 *
 * Autenticação por conta de serviço (JWT assinado com a chave privada, trocado
 * por um token de acesso de curta duração), só com `node:crypto` e `fetch` —
 * sem dependência nova. A chave nunca entra em mensagem de erro (regra 8).
 */

import { createSign } from 'node:crypto'

import { DURACAO_PADRAO_EM_MINUTOS, somarMinutos } from '@/lib/agenda-link'
import { diaEmSaoPaulo } from '@/lib/datas'

const ESCOPO = 'https://www.googleapis.com/auth/calendar.events'
const URL_DO_TOKEN = 'https://oauth2.googleapis.com/token'
const LIMITE_DE_ESPERA_MS = 8000

type Configuracao = { agendaId: string; email: string; chave: string }

function configuracao(): Configuracao | null {
  const agendaId = process.env['GOOGLE_AGENDA_ID']?.trim() ?? ''
  const email = process.env['GOOGLE_CONTA_EMAIL']?.trim() ?? ''
  // No painel de variáveis a chave costuma chegar com "\n" literal.
  const chave = (process.env['GOOGLE_CONTA_CHAVE'] ?? '').replaceAll('\\n', '\n').trim()
  if (agendaId === '' || email === '' || chave === '') return null
  return { agendaId, email, chave }
}

function base64Url(dados: Buffer | string): string {
  return Buffer.from(dados).toString('base64url')
}

async function tokenDeAcesso(config: Configuracao): Promise<string | null> {
  const agora = Math.floor(Date.now() / 1000)
  const cabecalho = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const corpo = base64Url(
    JSON.stringify({
      iss: config.email,
      scope: ESCOPO,
      aud: URL_DO_TOKEN,
      iat: agora,
      exp: agora + 3600,
    }),
  )
  const assinador = createSign('RSA-SHA256')
  assinador.update(`${cabecalho}.${corpo}`)
  const assinatura = base64Url(assinador.sign(config.chave))

  const resposta = await fetch(URL_DO_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${cabecalho}.${corpo}.${assinatura}`,
    }),
    signal: AbortSignal.timeout(LIMITE_DE_ESPERA_MS),
  })
  if (!resposta.ok) {
    console.error(`Google Agenda recusou a autenticação (HTTP ${resposta.status}).`)
    return null
  }
  const json = (await resposta.json()) as { access_token?: string }
  return json.access_token ?? null
}

export type EventoParaAgenda = {
  assunto: string
  prazoDeEntrega: Date
  horario: string | null
  responsavelNome: string
  tituloDoCaso: string
}

/** Corpo do evento no formato da API do Google (exportado para teste). */
export function corpoDoEventoNaAgenda(evento: EventoParaAgenda): Record<string, unknown> {
  const dia = diaEmSaoPaulo(evento.prazoDeEntrega)
  const descricao = `Responsável: ${evento.responsavelNome}\nCaso: ${evento.tituloDoCaso}\n(criado no Portal do Cliente)`

  if (evento.horario === null) {
    const seguinte = diaEmSaoPaulo(new Date(evento.prazoDeEntrega.getTime() + 24 * 60 * 60 * 1000))
    return {
      summary: evento.assunto,
      description: descricao,
      start: { date: dia },
      end: { date: seguinte },
    }
  }

  const fim = somarMinutos(evento.horario, DURACAO_PADRAO_EM_MINUTOS)
  return {
    summary: evento.assunto,
    description: descricao,
    start: { dateTime: `${dia}T${evento.horario}:00`, timeZone: 'America/Sao_Paulo' },
    end: { dateTime: `${dia}T${fim}:00`, timeZone: 'America/Sao_Paulo' },
  }
}

/** Cria o evento na agenda. Devolve o id do Google, ou null se não deu. */
export async function criarEventoNaAgenda(evento: EventoParaAgenda): Promise<string | null> {
  const config = configuracao()
  if (config === null) return null

  try {
    const token = await tokenDeAcesso(config)
    if (token === null) return null

    const resposta = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.agendaId)}/events`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(corpoDoEventoNaAgenda(evento)),
        signal: AbortSignal.timeout(LIMITE_DE_ESPERA_MS),
      },
    )
    if (!resposta.ok) {
      console.error(`Google Agenda recusou o evento (HTTP ${resposta.status}).`)
      return null
    }
    const json = (await resposta.json()) as { id?: string }
    return json.id ?? null
  } catch {
    console.error('Google Agenda indisponível ao criar evento.')
    return null
  }
}

/** Remove o evento da agenda. Falha é silenciosa: o portal já excluiu o dele. */
export async function removerEventoDaAgenda(googleEventoId: string): Promise<void> {
  const config = configuracao()
  if (config === null) return

  try {
    const token = await tokenDeAcesso(config)
    if (token === null) return
    await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.agendaId)}/events/${encodeURIComponent(googleEventoId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(LIMITE_DE_ESPERA_MS),
      },
    )
  } catch {
    console.error('Google Agenda indisponível ao remover evento.')
  }
}
