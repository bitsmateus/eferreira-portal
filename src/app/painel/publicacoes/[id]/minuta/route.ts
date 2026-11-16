/**
 * A minuta em Word, no papel timbrado (16/11/2026). Só a equipe: a sessão é
 * conferida no servidor (regra 2) e o acesso fica na auditoria. O arquivo não
 * é gravado em lugar nenhum — é montado na hora a partir do texto da minuta,
 * como a prévia dos documentos.
 */

import { NextResponse, type NextRequest } from 'next/server'

import { minutaEmWord } from '@/lib/minuta-em-word'
import { minutaParaBaixar } from '@/lib/minuta'
import { emailDaSessao, sessaoDoServidor } from '@/lib/sessao'
import { PerfilUsuario } from '@prisma/client'

export async function GET(requisicao: NextRequest, contexto: { params: Promise<{ id: string }> }) {
  const sessao = await sessaoDoServidor()
  if (sessao === null) return NextResponse.redirect(new URL('/entrar', requisicao.url))
  if (sessao.perfil === PerfilUsuario.CLIENTE) return new NextResponse('Não encontrado.', { status: 404 })

  const { id } = await contexto.params
  const minuta = await minutaParaBaixar(sessao, id, await emailDaSessao(sessao))
  if (minuta === null) return new NextResponse('Esta publicação ainda não tem minuta.', { status: 404 })

  const arquivo = await minutaEmWord(minuta.texto)
  return new NextResponse(new Uint8Array(arquivo), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${minuta.nomeDoArquivo}"`,
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}
