/**
 * Saída de arquivo para o cliente. Mesma função de autorização da rota do
 * painel — o que muda é só para onde vai quem chegou sem sessão.
 *
 * Não há aqui nenhuma verificação de "é meu documento?": quem faz isso é
 * `filtroDeDocumentos`, a partir da sessão, dentro de `urlDeLeituraAutorizada`.
 * Um cliente que colar o id de um documento alheio recebe 404, igual a quem
 * colar um id que não existe.
 */

import type { NextRequest } from 'next/server'

import { entregarArquivo } from '@/lib/rota-de-arquivo'

export async function GET(
  requisicao: NextRequest,
  contexto: { params: Promise<{ id: string }> },
) {
  const { id } = await contexto.params
  return entregarArquivo(requisicao, id, '/consultar')
}
