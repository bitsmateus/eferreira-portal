import { redirect } from 'next/navigation'
import { sessaoDoServidor } from '@/lib/sessao'
import { ehEquipe } from '@/lib/autorizacao'

export default async function Raiz() {
  const sessao = await sessaoDoServidor()

  if (sessao !== null && ehEquipe(sessao)) {
    redirect('/painel')
  }

  redirect('/entrar')
}
