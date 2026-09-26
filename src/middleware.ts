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
    // Tudo, menos os internos do Next, os arquivos estáticos, as rotas do
    // Auth.js e a API do escritório.
    //
    // A API fica de fora porque não se autentica por cookie: ela usa chave no
    // cabeçalho (Anexo I, 3.c) e cada rota confere a sua. Passar o maquinário
    // de sessão em toda requisição de API seria custo sem efeito — e um
    // middleware que "deixa passar" nunca foi garantia de nada por aqui.
    '/((?!api/auth|api/v1|api/d4sign|_next/static|_next/image|favicon.ico).*)',
  ],
}
