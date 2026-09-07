/**
 * Configuração do Auth.js que roda também no middleware (edge).
 *
 * Nada de Prisma nem de Argon2 aqui: só `import type`, que o compilador apaga.
 * O `authorize` de verdade vive em `src/auth.ts`, que roda em Node.
 */

import type { PerfilUsuario } from '@prisma/client'
import type { NextAuthConfig } from 'next-auth'

/** Rotas internas do escritório. Só operador e administrador entram. */
const PREFIXOS_DO_PAINEL = ['/painel'] as const

/** Rotas abertas: a tela de login e o que o Auth.js precisa. */
const ROTAS_PUBLICAS = ['/entrar'] as const

function comecaCom(caminho: string, prefixos: readonly string[]): boolean {
  return prefixos.some(
    (prefixo) => caminho === prefixo || caminho.startsWith(`${prefixo}/`),
  )
}

const PERFIS: readonly PerfilUsuario[] = ['OPERADOR', 'ADMINISTRADOR', 'CLIENTE']

/**
 * Lê o perfil gravado no token. O token é assinado pelo servidor, mas ainda
 * assim é conferido aqui: em caso de dúvida, cai no perfil de menor
 * privilégio, que sem `clienteId` não enxerga nada (regra 2).
 */
function perfilDoToken(valor: unknown): PerfilUsuario {
  return PERFIS.includes(valor as PerfilUsuario)
    ? (valor as PerfilUsuario)
    : 'CLIENTE'
}

export const configuracaoAuth = {
  session: { strategy: 'jwt', maxAge: 60 * 60 * 8 },
  pages: {
    signIn: '/entrar',
    error: '/entrar',
  },
  // Preenchido em src/auth.ts — aqui fica vazio de propósito.
  providers: [],
  callbacks: {
    /**
     * Regra 2: a decisão de acesso é do servidor. O middleware chama esta
     * função com a sessão já decodificada do cookie assinado.
     */
    authorized({ auth, request }) {
      const caminho = request.nextUrl.pathname
      const usuario = auth?.user

      if (comecaCom(caminho, ROTAS_PUBLICAS)) {
        // Quem já entrou não fica preso na tela de login.
        if (usuario !== undefined && usuario.perfil !== 'CLIENTE') {
          return Response.redirect(new URL('/painel', request.nextUrl))
        }
        return true
      }

      if (comecaCom(caminho, PREFIXOS_DO_PAINEL)) {
        if (usuario === undefined) return false
        return usuario.perfil === 'OPERADOR' || usuario.perfil === 'ADMINISTRADOR'
      }

      return true
    },

    jwt({ token, user }) {
      if (user !== undefined) {
        token.sub = user.id
        token['perfil'] = user.perfil
        token['clienteId'] = user.clienteId
        token['contratoAssinado'] = user.contratoAssinado
      }
      return token
    },

    session({ session, token }) {
      const clienteId = token['clienteId']
      session.user.id = token.sub ?? ''
      session.user.perfil = perfilDoToken(token['perfil'])
      session.user.clienteId = typeof clienteId === 'string' ? clienteId : null
      session.user.contratoAssinado = token['contratoAssinado'] === true
      return session
    },
  },
} satisfies NextAuthConfig
