'use server'

import { signOut } from '@/auth'

/** Sair leva de volta à tela de consulta, não à do painel. */
export async function sairDaConsulta() {
  await signOut({ redirectTo: '/consultar' })
}
