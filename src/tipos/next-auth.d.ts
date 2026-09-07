import type { PerfilUsuario } from '@prisma/client'
import type { DefaultSession } from 'next-auth'

/**
 * O que a sessão carrega. Estes campos são a única fonte de verdade da
 * autorização (regra 2) — nada aqui vem do navegador.
 */
type DadosDaSessao = {
  id: string
  perfil: PerfilUsuario
  clienteId: string | null
  contratoAssinado: boolean
}

declare module 'next-auth' {
  interface Session {
    user: DadosDaSessao & DefaultSession['user']
  }

  interface User {
    perfil: PerfilUsuario
    clienteId: string | null
    contratoAssinado: boolean
  }
}

// O JWT não é aumentado de propósito: em next-auth v5 a interface vem de
// `@auth/core/jwt` e aumentar o reexport não pega. Os campos são lidos e
// conferidos em `perfilDoToken` (src/auth.config.ts).

export {}
