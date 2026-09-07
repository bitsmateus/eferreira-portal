import { redirect } from 'next/navigation'
import { PerfilUsuario } from '@prisma/client'

import { Marca } from '@/componentes/marca'
import { MenuLateral } from '@/componentes/menu-lateral'
import { sessaoDoServidor } from '@/lib/sessao'
import { ehEquipe } from '@/lib/autorizacao'
import { prisma } from '@/lib/prisma'
import { sair } from './acoes'

const NOME_DO_PERFIL: Record<PerfilUsuario, string> = {
  OPERADOR: 'Operador',
  ADMINISTRADOR: 'Administrador',
  CLIENTE: 'Cliente',
}

export default async function LayoutDoPainel({
  children,
}: {
  children: React.ReactNode
}) {
  // Regra 2: a decisão é do servidor, aqui e em cada consulta ao banco.
  const sessao = await sessaoDoServidor()
  if (sessao === null) redirect('/entrar')
  if (!ehEquipe(sessao)) redirect('/entrar')

  const usuario = await prisma.usuario.findUnique({
    where: { id: sessao.usuarioId },
    select: { nome: true, perfil: true },
  })

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[232px_1fr]">
      <aside className="hidden flex-col gap-6 bg-grafite-800 px-3.5 py-5 md:flex">
        <Marca />

        <MenuLateral />

        <div className="mt-auto border-t border-[#3A3A3A] pt-3.5 text-[11.5px] leading-snug text-[#78787F]">
          Conectado como
          <br />
          <b className="text-[#C8C8CE]">{usuario?.nome ?? '—'}</b>
          <br />
          {usuario === null ? '—' : NOME_DO_PERFIL[usuario.perfil]}
          <form action={sair} className="mt-3">
            <button
              type="submit"
              className="text-[11.5px] text-[#B9B9C0] underline underline-offset-2 hover:text-[#EDEDED]"
            >
              Sair
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col bg-fundo">
        <div className="flex items-center gap-3 bg-grafite-800 px-4 py-3 md:hidden">
          <Marca tamanho="pequena" />
        </div>
        {children}
      </div>
    </div>
  )
}
