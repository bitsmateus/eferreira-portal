'use server'

import { AuthError } from 'next-auth'
import { redirect } from 'next/navigation'
import { signIn } from '@/auth'

/**
 * Entrada do operador/administrador. Roda no servidor: a senha nunca é
 * comparada no navegador e o resultado nunca depende do que ele mandou além
 * do próprio e-mail e senha.
 */
export async function entrarNoPainel(_estado: unknown, dados: FormData) {
  const email = String(dados.get('email') ?? '')
  const senha = String(dados.get('senha') ?? '')

  try {
    await signIn('credentials', {
      email,
      senha,
      redirect: false,
    })
  } catch (erro) {
    if (erro instanceof AuthError) {
      const bruto = (erro as unknown as { code?: unknown }).code
      return {
        codigoDeFalha:
          typeof bruto === 'string' && bruto !== ''
            ? bruto
            : 'credenciais_invalidas',
      }
    }
    throw erro
  }

  redirect('/painel')
}

export type ResultadoDeEntrada = Awaited<ReturnType<typeof entrarNoPainel>>
