/**
 * A única porta de saída de arquivo do sistema, em um lugar só.
 *
 * Existem duas rotas apontando para cá — a do painel e a da área do cliente —
 * porque cada uma manda quem não está autenticado para a sua tela de entrada.
 * A decisão de acesso, essa, é uma só: `urlDeLeituraAutorizada` monta o filtro
 * a partir da sessão e só o documento que sobreviver a ele ganha URL assinada.
 *
 * Regra 5: nada é servido daqui. A resposta é um redirecionamento para uma URL
 * pré-assinada de validade curta; o arquivo nunca passa pelo servidor da
 * aplicação e nunca tem endereço permanente.
 */

import { NextResponse, type NextRequest } from 'next/server'

import { SemAutorizacao } from '@/lib/autorizacao'
import { urlDeLeituraAutorizada } from '@/lib/documentos'
import { emailDaSessao, sessaoDoServidor } from '@/lib/sessao'

export async function entregarArquivo(
  requisicao: NextRequest,
  documentoId: string,
  /** Para onde mandar quem não tem sessão: `/entrar` ou `/consultar`. */
  telaDeEntrada: string,
): Promise<NextResponse> {
  const sessao = await sessaoDoServidor()
  if (sessao === null) {
    return NextResponse.redirect(new URL(telaDeEntrada, requisicao.url))
  }

  const comoAnexo = requisicao.nextUrl.searchParams.get('como') === 'anexo'

  try {
    const url = await urlDeLeituraAutorizada(
      sessao,
      documentoId,
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
