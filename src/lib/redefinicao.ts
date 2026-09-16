/**
 * Os números da recuperação de senha da equipe, separados do resto pelo mesmo
 * motivo de `src/lib/acesso.ts`: `src/lib/redefinicao-de-senha.ts` usa
 * `node:crypto`, Prisma e Argon2, e nada disso pode ser arrastado para o
 * pacote que vai ao navegador.
 */

/** Mesmo tamanho do código do cliente — um padrão só de recuperação. */
export const DIGITOS_DO_CODIGO = 6

/** Mesma janela do código do cliente. */
export const MINUTOS_DE_VALIDADE = 10

/** Mesma régua do bloqueio de login: na quinta errada, o código morre. */
export const TENTATIVAS_POR_CODIGO = 5

/** Nem quem esqueceu de verdade fica impaciente, nem dá para usar o SMTP do escritório como arma. */
export const SEGUNDOS_ENTRE_PEDIDOS = 60
export const PEDIDOS_POR_USUARIO = 3
export const PEDIDOS_POR_IP = 10
export const JANELA_DE_PEDIDOS_MINUTOS = 15
