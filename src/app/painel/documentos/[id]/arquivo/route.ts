/**
 * A única porta de saída de arquivo do sistema.
 *
 * Regra 5: nada é servido daqui. Esta rota autoriza, registra o acesso e
 * redireciona para uma URL pré-assinada de validade curta — o arquivo em si
 * nunca passa pelo servidor da aplicação e nunca tem endereço permanente.
 *
 * `?como=anexo` baixa; sem isso, abre para visualização.
 */

import { NextResponse, type NextRequest } from 'next/server'

import { SemAutorizacao } from '@/lib/autorizacao'
import { urlDeLeituraAutorizada } from '@/lib/documentos'
import { emailDaSessao, sessaoDoServidor } from '@/lib/sessao'

export async function GET(
  requisicao: NextRequest,
  contexto: { params: Promise<{ id: string }> },
) {
  const sessao = await sessaoDoServidor()
  if (sessao === null) {
    return NextResponse.redirect(new URL('/entrar', requisicao.url))
  }

  const { id } = await contexto.params
  const comoAnexo = requisicao.nextUrl.searchParams.get('como') === 'anexo'

  try {
    const url = await urlDeLeituraAutorizada(
      sessao,
      id,
      comoAnexo,
      await emailDaSessao(sessao),
      {
        enderecoIp: requisicao.headers.get('x-forwarded-for'),
        agenteUsuario: requisicao.headers.get('user-agent'),
      },
    )

    // Documento inexistente e documento de outro cliente dão a MESMA resposta:
    // 404 sem detalhe. Distinguir os dois já entregaria informação.
    if (url === null) {
      return new NextResponse('Documento não encontrado.', { status: 404 })
    }

    // A URL vence em minutos; guardar em cache do navegador a deixaria
    // circulando depois de expirar e poluiria o registro de acesso.
    return NextResponse.redirect(url, {
      status: 302,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    })
  } catch (erro) {
    if (erro instanceof SemAutorizacao) {
      return new NextResponse('Documento não encontrado.', { status: 404 })
    }
    throw erro
  }
}
