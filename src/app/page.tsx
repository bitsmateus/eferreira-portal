import { redirect } from 'next/navigation'
import { PerfilUsuario } from '@prisma/client'

import { sessaoDoServidor } from '@/lib/sessao'
import { ehEquipe } from '@/lib/autorizacao'

/**
 * A raiz manda cada um para a sua porta. Sem sessão, a porta é a do cliente:
 * o portal é público para ele e restrito para a equipe, então `/consultar` é o
 * destino natural de quem chega pelo endereço do escritório.
 */
export default async function Raiz() {
  const sessao = await sessaoDoServidor()

  if (sessao !== null && ehEquipe(sessao)) {
    redirect('/painel')
  }

  if (sessao !== null && sessao.perfil === PerfilUsuario.CLIENTE) {
    redirect('/meus-processos')
  }

  redirect('/consultar')
}
