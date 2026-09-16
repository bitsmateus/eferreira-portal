/**
 * O estado das etapas da recuperação de senha da equipe.
 *
 * Fora de `acoes.ts` pelo mesmo motivo de `src/app/consultar/estado.ts`:
 * arquivo marcado com `'use server'` só pode exportar função assíncrona, e
 * tanto a tela quanto a ação precisam destas constantes.
 */

import type { ErrosDeCampo } from '@/lib/formulario'

export type EstadoDaRecuperacao = {
  passo: 'email' | 'codigo' | 'concluida'
  email: string
  erros: ErrosDeCampo
  /** Confirmação neutra do envio. Nunca diz se o e-mail tem acesso ao painel. */
  aviso: string | null
  /** Momento do último pedido, em ms — alimenta o contador do "reenviar". */
  pedidoEm: number | null
}

export const ESTADO_INICIAL: EstadoDaRecuperacao = {
  passo: 'email',
  email: '',
  erros: {},
  aviso: null,
  pedidoEm: null,
}
