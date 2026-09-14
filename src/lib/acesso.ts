/**
 * Os números da entrada do cliente, separados do resto por uma razão prática:
 * `src/lib/acesso-do-cliente.ts` usa `node:crypto`, Prisma e Argon2, e nada
 * disso pode ser arrastado para o pacote que vai ao navegador.
 *
 * É o mesmo motivo de `src/lib/arquivos.ts` existir ao lado de
 * `src/lib/documentos.ts`. Aqui só moram constantes.
 */

/** Seis dígitos, como no protótipo. */
export const DIGITOS_DO_CODIGO = 6

/** "O código vale por 10 minutos" — protótipo, tela "Cliente — entrar". */
export const MINUTOS_DE_VALIDADE = 10

/** Mesma régua da senha do operador: na quinta errada, o código morre. */
export const TENTATIVAS_POR_CODIGO = 5

/** Nem o cliente impaciente nem quem quer usar o SMTP do escritório como arma. */
export const SEGUNDOS_ENTRE_PEDIDOS = 60
export const PEDIDOS_POR_CLIENTE = 3
export const PEDIDOS_POR_IP = 10
export const JANELA_DE_PEDIDOS_MINUTOS = 15
