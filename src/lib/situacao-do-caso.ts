/**
 * Os rótulos das duas situações do caso, em um lugar só.
 *
 * Moram aqui, e não no componente que os desenha, porque a API também precisa
 * deles — e uma rota de API não deve importar componente de tela para saber
 * escrever "Em andamento".
 *
 * Os dois valores vêm literalmente do protótipo aprovado.
 */

import type { SituacaoCaso } from '@prisma/client'

export const ROTULO_DA_SITUACAO: Record<SituacaoCaso, string> = {
  EM_ANDAMENTO: 'Em andamento',
  ARQUIVADO: 'Arquivado',
}
