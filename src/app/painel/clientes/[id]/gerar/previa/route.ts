/**
 * A prévia do documento, em PDF.
 *
 * Por que PDF e não HTML na tela: o documento é paginado, e uma prévia em
 * fluxo contínuo não tem como mostrar onde cada página termina. O resultado
 * era a assinatura aparecendo por cima do rodapé impresso do papel timbrado —
 * um defeito que só existia na prévia, e que levaria o operador a "consertar"
 * um documento que já estava certo.
 *
 * Aqui o que o operador vê É o arquivo: mesma função, mesmo Chromium, mesmas
 * quebras de página. O PDF não é gravado — some quando a aba fecha.
 *
 * Regra 2: nenhum id decide nada sozinho. `montarPrevia` monta tudo a partir
 * do filtro da sessão, como a geração de verdade.
 */

import { NextResponse, type NextRequest } from 'next/server'

import { SemAutorizacao } from '@/lib/autorizacao'
import { ehTipoGeravel, montarPrevia } from '@/lib/geracao'
import { gerarPdf, montarPaginaTimbrada } from '@/lib/pdf'
import { exigirSessaoDaEquipe } from '@/lib/sessao'

export async function GET(
  requisicao: NextRequest,
  contexto: { params: Promise<{ id: string }> },
) {
  try {
    const sessao = await exigirSessaoDaEquipe()
    const { id } = await contexto.params

    const tipoBruto = requisicao.nextUrl.searchParams.get('tipo') ?? ''
    if (!ehTipoGeravel(tipoBruto)) {
      return new NextResponse('Tipo de documento inválido.', { status: 400 })
    }

    const casoBruto = requisicao.nextUrl.searchParams.get('casoId') ?? ''
    const previa = await montarPrevia(
      sessao,
      id,
      tipoBruto,
      casoBruto === '' ? null : casoBruto,
      requisicao.nextUrl.searchParams.get('advogadoId'),
    )

    // A tela já mostra o que falta, com o link para completar o cadastro. Aqui
    // basta não entregar arquivo nenhum.
    if (previa.situacao !== 'pronto') {
      return new NextResponse('Documento indisponível.', { status: 409 })
    }

    const { html, timbre } = await montarPaginaTimbrada(previa.html, previa.titulo)
    const pdf = await gerarPdf(html, timbre)

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        // `inline` para abrir no visualizador, não baixar.
        'Content-Disposition': `inline; filename="previa.pdf"`,
        // Prévia de documento de cliente não fica em cache de proxy nenhum.
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (erro) {
    if (erro instanceof SemAutorizacao) {
      return new NextResponse('Documento indisponível.', { status: 404 })
    }
    throw erro
  }
}
