/**
 * Senhas — Argon2id, conforme a stack definida no CLAUDE.md.
 *
 * Os parâmetros seguem a recomendação de segunda opção do OWASP para Argon2id
 * (19 MiB de memória, 2 iterações, paralelismo 1).
 */

import { hash, verify } from '@node-rs/argon2'
import type { Algorithm } from '@node-rs/argon2'

/**
 * `Algorithm` é um `const enum` do @node-rs/argon2, e `isolatedModules` proíbe
 * lê-lo em tempo de execução. O valor 2 é `Algorithm.Argon2id` — a anotação de
 * tipo abaixo garante que ele continue batendo se o pacote mudar.
 */
const ARGON2ID: Algorithm = 2

const PARAMETROS = {
  algorithm: ARGON2ID,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const

/**
 * Hash usado para gastar o mesmo tempo quando o e-mail não existe. Sem isso, a
 * diferença de tempo de resposta entrega quais e-mails estão cadastrados.
 */
const HASH_FALSO =
  '$argon2id$v=19$m=19456,t=2,p=1$c2FsZ2FvZGV1bWNvbXByaW1lbnRv$b2NoYXNoZmFsc29xdWVudW5jYWNvbmZlcmU'

export async function gerarHashDeSenha(senha: string): Promise<string> {
  return hash(senha, PARAMETROS)
}

export async function senhaConfere(
  senha: string,
  hashArmazenado: string,
): Promise<boolean> {
  try {
    return await verify(hashArmazenado, senha, PARAMETROS)
  } catch {
    return false
  }
}

/** Consome o mesmo tempo de uma verificação real, sem revelar nada. */
export async function gastarTempoDeVerificacao(senha: string): Promise<void> {
  try {
    await verify(HASH_FALSO, senha, PARAMETROS)
  } catch {
    // esperado: o hash falso nunca confere
  }
}
