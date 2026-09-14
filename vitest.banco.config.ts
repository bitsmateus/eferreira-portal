/**
 * Testes que precisam do banco de verdade.
 *
 * Ficam fora do `npm run test` de propósito: a suíte unitária roda em segundos
 * e sem infraestrutura. Aqui é o contrário — é justamente contra o Postgres,
 * com os filtros de autorização e o Prisma de verdade, que o isolamento entre
 * clientes tem de ser provado (critério de pronto da Sprint 4).
 *
 * Local: `docker compose up -d banco` e `npm run test:banco`.
 * No CI: roda depois de `prisma migrate deploy`.
 */

import 'dotenv/config'
import { defineConfig } from 'vitest/config'
import caminhosDoTsconfig from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [caminhosDoTsconfig()],
  test: {
    environment: 'node',
    include: ['testes-de-banco/**/*.teste.ts'],
    globals: false,
    restoreMocks: true,
    // Um banco só: suítes paralelas disputariam as mesmas linhas.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
