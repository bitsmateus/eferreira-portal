import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * Compara o segredo de uma rota pública (aviso da D4Sign, rotina do DJEN) em
 * tempo constante. Hash dos dois lados: `timingSafeEqual` exige o mesmo
 * tamanho.
 */
export function segredoConfere(enviado: string, esperado: string): boolean {
  const a = createHash('sha256').update(enviado).digest()
  const b = createHash('sha256').update(esperado).digest()
  return timingSafeEqual(a, b)
}
