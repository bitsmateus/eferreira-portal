/**
 * O aviso automático da ZapSign — POST /api/zapsign/retorno?chave=<segredo>.
 *
 * Cadastrado no painel da ZapSign (Configurações › Integrações › Webhooks,
 * todos os eventos de documento), com esta URL inteira, incluindo `?chave=`.
 * Sem ele o portal continua funcionando: o botão "Conferir agora" faz a mesma
 * coisa na mão.
 *
 * Segurança (rota pública, sem sessão). O aviso da ZapSign NÃO é assinado:
 *  - só existe se `ZAPSIGN_RETORNO_SEGREDO` estiver definido, e a `chave` da
 *    URL tem que ser igual a ele (tempo constante); sem isso, 404 e 401;
 *  - o corpo não decide nada. Dele se lê só o `token` do documento; a situação
 *    de verdade vem da consulta autenticada que o portal faz de volta
 *    (`conferirAssinaturaPorRetorno`, a mesma da D4Sign);
 *  - responde 200 para documento conhecido ou não — documentos criados na
 *    conta por fora do portal também geram aviso. Responder 200 evita
 *    reenvio eterno e não revela o que existe.
 */

import { NextResponse, type NextRequest } from 'next/server'

import { conferirAssinaturaPorRetorno } from '@/lib/assinaturas'
import { segredoConfere } from '@/lib/segredo'
import { tokenDoAviso } from '@/lib/zapsign'

export async function POST(requisicao: NextRequest) {
  const esperada = (process.env['ZAPSIGN_RETORNO_SEGREDO'] ?? '').trim()
  if (esperada === '') return new NextResponse('Não encontrado.', { status: 404 })

  const enviada = requisicao.nextUrl.searchParams.get('chave') ?? ''
  if (!segredoConfere(enviada, esperada)) {
    return new NextResponse('Não autorizado.', { status: 401 })
  }

  let corpo: unknown
  try {
    corpo = JSON.parse((await requisicao.text()).slice(0, 200_000))
  } catch {
    return NextResponse.json({ ok: true, ignorado: true })
  }

  const token = tokenDoAviso(corpo)
  if (token === null) return NextResponse.json({ ok: true, ignorado: true })

  try {
    await conferirAssinaturaPorRetorno(token)
  } catch {
    // A ZapSign reenvia o que não recebeu 2xx; um erro nosso (rede,
    // armazenamento) merece nova tentativa dela.
    return new NextResponse('Falha ao conferir.', { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
