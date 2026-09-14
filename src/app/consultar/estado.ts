/**
 * O estado das duas etapas da entrada do cliente.
 *
 * Fora de `acoes.ts` de propósito: arquivo marcado com `'use server'` só pode
 * exportar função assíncrona, e tanto a tela quanto a ação precisam destas
 * constantes.
 */

import type { ErrosDeCampo } from '@/lib/formulario'

export type EstadoDaConsulta = {
  passo: 'documento' | 'codigo'
  /** Normalizado (só dígitos), para voltar ao formulário da segunda etapa. */
  documento: string
  /** Formatado, para aparecer na tela sem o navegador ter de refazê-lo. */
  documentoFormatado: string
  erros: ErrosDeCampo
  /** Confirmação neutra do envio. Nunca diz se o documento é de um cliente. */
  aviso: string | null
  /** Momento do último pedido, em ms — alimenta o contador do "reenviar". */
  pedidoEm: number | null
}

export const ESTADO_INICIAL: EstadoDaConsulta = {
  passo: 'documento',
  documento: '',
  documentoFormatado: '',
  erros: {},
  aviso: null,
  pedidoEm: null,
}
