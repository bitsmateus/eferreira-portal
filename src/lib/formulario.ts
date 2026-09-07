/**
 * O contrato entre os formulários e o servidor.
 *
 * Toda ação de servidor devolve `ResultadoDeFormulario`: ou os dados válidos,
 * ou um erro por campo. A tela só desenha o que vem daqui — ela não decide o
 * que é válido, e muito menos o que a sessão pode ver (regra 2).
 */

import type { z } from 'zod'

/** Mensagem de erro por nome de campo. A chave é o `name` do input. */
export type ErrosDeCampo = Record<string, string>

export type ResultadoDeFormulario<T> =
  | { ok: true; dados: T }
  | { ok: false; erros: ErrosDeCampo; mensagem?: string }

/**
 * Converte o erro do Zod em um erro por campo. Fica com a primeira mensagem
 * de cada campo: mostrar três avisos no mesmo input não ajuda ninguém.
 */
export function errosPorCampo(erro: z.ZodError): ErrosDeCampo {
  const erros: ErrosDeCampo = {}

  for (const problema of erro.issues) {
    const primeiro = problema.path[0]
    const campo = typeof primeiro === 'string' ? primeiro : '_'
    if (erros[campo] === undefined) {
      erros[campo] = problema.message
    }
  }

  return erros
}

/** Lê um campo de texto do FormData sem confiar no tipo do que chegou. */
export function texto(dados: FormData, campo: string): string {
  const valor = dados.get(campo)
  return typeof valor === 'string' ? valor : ''
}
