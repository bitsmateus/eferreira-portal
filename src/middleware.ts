import NextAuth from 'next-auth'
import { configuracaoAuth } from '@/auth.config'

/**
 * Primeira barreira. A segunda — e a que vale — é o filtro de autorização em
 * cada consulta ao banco (`src/lib/autorizacao.ts`). Middleware sozinho nunca
 * é garantia de isolamento.
 */
export const { auth: middleware } = NextAuth(configuracaoAuth)

export default middleware

export const config = {
  matcher: [
    // Tudo, menos os internos do Next, os arquivos estáticos e as rotas do Auth.js.
    '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
}
