/**
 * Saída de arquivo para a equipe do escritório. A autorização e o registro de
 * acesso ficam em `src/lib/rota-de-arquivo.ts`, compartilhados com a rota
 * equivalente da área do cliente.
 *
 * `?como=anexo` baixa; sem isso, abre para visualização.
 */

import type { NextRequest } from 'next/server'

import { entregarArquivo } from '@/lib/rota-de-arquivo'

export async function GET(
  requisicao: NextRequest,
  contexto: { params: Promise<{ id: string }> },
) {
  const { id } = await contexto.params
  return entregarArquivo(requisicao, id, '/entrar')
}
