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
    /*
     * A BARRA LATERAL FICA FIXA, E O JEITO DE GARANTIR ISSO É LIMITAR A
     * ALTURA DO CONTÊINER INTEIRO.
     *
     * Antes, o grid tinha só `min-h-screen`: crescia junto com o conteúdo, e
     * quando uma tela ficava mais alta que a janela era o DOCUMENTO inteiro
     * que rolava — barra lateral incluída, porque ela é só mais uma coluna
     * do mesmo grid. `h-screen` + `overflow-hidden` aqui trava a altura em
     * exatamente uma tela; quem rola é só o miolo de cada página, no próprio
     * `overflow-auto` que já existe em cada `page.tsx`.
     *
     * `min-h-0` na coluna da direita é o detalhe que faz isso funcionar de
     * verdade: por padrão, um item de flex-column tem `min-height: auto`, o
     * que o deixa crescer do tamanho do conteúdo mesmo dentro de um pai de
     * altura fixa — e aí o `overflow-auto` do miolo nunca chega a entrar em
     * ação. Zerar o mínimo é o que deixa o navegador cortar ali, em vez de
     * empurrar a página inteira para baixo.
     */
    <div className="grid h-screen grid-cols-1 overflow-hidden md:grid-cols-[232px_1fr]">
      <aside className="hidden flex-col gap-6 overflow-y-auto bg-grafite-800 px-3.5 py-5 md:flex">
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

      <div className="flex min-h-0 min-w-0 flex-col bg-fundo">
        <div className="flex items-center gap-3 bg-grafite-800 px-4 py-3 md:hidden">
          <Marca tamanho="pequena" />
        </div>
        {children}
      </div>
    </div>
  )
}
