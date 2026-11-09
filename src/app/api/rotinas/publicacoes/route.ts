/**
 * A rotina diária do DJEN — POST /api/rotinas/publicacoes?chave=<segredo>.
 *
 * Quem chama é um agendamento (o n8n do escritório, ou o cron do EasyPanel),
 * nos dias úteis de manhã. Ver `docs/publicacoes.md`.
 *
 * Segurança (a rota é pública, não tem sessão) — mesmo desenho do aviso da
 * D4Sign: só existe com `PUBLICACOES_ROTINA_SEGREDO` definido, e a chave vem
 * na query (`?chave=`) ou no cabeçalho `x-chave`, comparada em tempo
 * constante. A resposta traz só contagens, nunca o conteúdo das publicações.
 *
 * A análise da IA roda depois da resposta (`after`): uma rodada com vinte
 * análises passaria do tempo que o agendador espera.
 */

import { after, NextResponse, type NextRequest } from 'next/server'

import { analisarPendentes, executarConsulta } from '@/lib/publicacoes'
import { segredoConfere } from '@/lib/segredo'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(requisicao: NextRequest) {
  const esperada = (process.env['PUBLICACOES_ROTINA_SEGREDO'] ?? '').trim()
  if (esperada === '') return new NextResponse('Não encontrado.', { status: 404 })

  const enviada =
    requisicao.headers.get('x-chave') ?? requisicao.nextUrl.searchParams.get('chave') ?? ''
  if (!segredoConfere(enviada, esperada)) {
    return new NextResponse('Não autorizado.', { status: 401 })
  }

  const dias = Number(requisicao.nextUrl.searchParams.get('dias') ?? '')
  const resumo = await executarConsulta(Number.isFinite(dias) && dias > 0 ? { dias } : {})

  after(async () => {
    await analisarPendentes(resumo.consultaId)
  })

  return NextResponse.json({
    ok: resumo.erros.length === 0,
    janela: { inicio: resumo.inicio, fim: resumo.fim },
    encontradas: resumo.encontradas,
    novas: resumo.novas,
    erros: resumo.erros,
  })
}
