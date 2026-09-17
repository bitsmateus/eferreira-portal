/**
 * Rótulos de "quem assina o quê" — sem nada de servidor (nem Prisma, nem
 * `node:`, nem sessão), para poder ser importado por componente cliente sem
 * arrastar junto o Prisma, a sessão ou a integração inteira com a D4Sign.
 *
 * Mora separado de `assinaturas.ts` e `partes.ts` pelo mesmo motivo de
 * `campos-do-cliente.ts` e `arquivos.ts`: aqueles falam com o banco, e um
 * componente `'use client'` que importasse deles arrastaria Prisma,
 * `node:crypto`, Argon2 e nodemailer para o pacote que o navegador baixa —
 * foi exatamente isso que quebrou o build a primeira vez que este arquivo não
 * existia.
 */

import { PapelDaParte } from '@prisma/client'

export const ROTULO_DO_PAPEL_DA_PARTE: Record<PapelDaParte, string> = {
  ADVOGADO: 'Advogado',
  PARTE_CONTRARIA: 'Parte contrária',
  TESTEMUNHA: 'Testemunha',
  OUTROS: 'Outros',
}

/**
 * Quem pode assinar um documento — os três papéis "automáticos" de
 * `partesQueAssinam` (contrato, procuração, declaração) mais os quatro do
 * cadastro de partes, usados só em documento avulso. O tipo mora aqui, e não
 * em `assinaturas.ts`, para `ROTULO_DO_PAPEL` poder ser tipado com precisão
 * sem esse arquivo (que fala com Prisma, sessão e D4Sign) precisar existir.
 */
export type PapelNaAssinatura = 'cliente' | 'representante' | 'escritorio' | PapelDaParte

/** Inclui os papéis de `assinaturas.ts` (cliente/representante/escritório). */
export const ROTULO_DO_PAPEL: Record<PapelNaAssinatura, string> = {
  cliente: 'Cliente',
  representante: 'Representante legal',
  escritorio: 'Escritório',
  ...ROTULO_DO_PAPEL_DA_PARTE,
}
