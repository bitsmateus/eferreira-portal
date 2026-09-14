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

/** A área do cliente. Só o perfil CLIENTE entra — e a página confere de novo. */
const PREFIXOS_DO_CLIENTE = ['/meus-processos'] as const

/** Rotas abertas: as duas telas de entrada e o que o Auth.js precisa. */
const ROTAS_PUBLICAS = ['/entrar', '/consultar'] as const

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
      const ehCliente = usuario !== undefined && usuario.perfil === 'CLIENTE'
      const ehDaEquipe =
        usuario !== undefined &&
        (usuario.perfil === 'OPERADOR' || usuario.perfil === 'ADMINISTRADOR')

      if (comecaCom(caminho, ROTAS_PUBLICAS)) {
        // Quem já entrou não fica preso na tela de entrada — cada um na sua.
        if (ehDaEquipe) {
          return Response.redirect(new URL('/painel', request.nextUrl))
        }
        if (ehCliente) {
          return Response.redirect(new URL('/meus-processos', request.nextUrl))
        }
        return true
      }

      if (comecaCom(caminho, PREFIXOS_DO_PAINEL)) {
        return ehDaEquipe
      }

      if (comecaCom(caminho, PREFIXOS_DO_CLIENTE)) {
        // A equipe não passeia pela área do cliente: lá o filtro de sessão
        // deixaria o operador ver tudo, sem o recorte de um cliente só.
        if (ehDaEquipe) {
          return Response.redirect(new URL('/painel', request.nextUrl))
        }
        if (!ehCliente) {
          return Response.redirect(new URL('/consultar', request.nextUrl))
        }
        // `contratoAssinado` do cookie NÃO decide nada: quem decide é
        // `exigirSessaoDeCliente`, que relê o banco a cada requisição.
        return true
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
