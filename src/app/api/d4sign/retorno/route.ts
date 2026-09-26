/**
 * O aviso automático da D4Sign — POST /api/d4sign/retorno?chave=<segredo>.
 *
 * Configurado no painel da D4Sign, no cofre: Opções do cofre → Configurações →
 * Callback (ou Webhook), com esta URL inteira, incluindo `?chave=`. Sem ele o
 * portal continua funcionando: o botão "Conferir assinatura" faz a mesma coisa
 * na mão.
 *
 * Segurança (a rota é pública, não tem sessão):
 *  - só existe se `D4SIGN_RETORNO_SEGREDO` estiver definido, e a `chave` da URL
 *    tem que ser igual a ele (comparação em tempo constante); sem isso, 404 e
 *    401 — nada é consultado;
 *  - o corpo do aviso NÃO decide nada. Dele se lê só o UUID do documento, e a
 *    situação de verdade vem da pergunta que o portal faz de volta à D4Sign;
 *  - responde 200 para qualquer UUID válido, conhecido ou não, para não
 *    revelar quais documentos existem.
 */

import { createHash, timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'

import { conferirAssinaturaPorRetorno } from '@/lib/assinaturas'

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

function chaveConfere(enviada: string, esperada: string): boolean {
  // Hash dos dois lados: `timingSafeEqual` exige o mesmo tamanho.
  const a = createHash('sha256').update(enviada).digest()
  const b = createHash('sha256').update(esperada).digest()
  return timingSafeEqual(a, b)
}

/** O UUID do documento, esteja o aviso em JSON, em formulário ou em texto. */
async function uuidDoAviso(requisicao: NextRequest): Promise<string | null> {
  const texto = (await requisicao.text()).slice(0, 20_000)
  const achado = UUID.exec(texto)
  return achado === null ? null : achado[0].toLowerCase()
}

export async function POST(requisicao: NextRequest) {
  const esperada = (process.env['D4SIGN_RETORNO_SEGREDO'] ?? '').trim()
  if (esperada === '') return new NextResponse('Não encontrado.', { status: 404 })

  const enviada = requisicao.nextUrl.searchParams.get('chave') ?? ''
  if (!chaveConfere(enviada, esperada)) {
    return new NextResponse('Não autorizado.', { status: 401 })
  }

  const uuid = await uuidDoAviso(requisicao)
  if (uuid === null) return NextResponse.json({ ok: true, ignorado: true })

  try {
    await conferirAssinaturaPorRetorno(uuid)
  } catch {
    // A D4Sign reenvia o aviso quando a resposta não é 2xx; um erro nosso
    // (rede, armazenamento) merece nova tentativa dela.
    return new NextResponse('Falha ao conferir.', { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
