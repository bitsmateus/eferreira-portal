import { defineConfig } from 'vitest/config'
import caminhosDoTsconfig from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [caminhosDoTsconfig()],
  test: {
    environment: 'node',
    include: ['testes/**/*.teste.ts'],
    globals: false,
    restoreMocks: true,
  },
})
