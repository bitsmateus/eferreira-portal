import { redirect } from 'next/navigation'
import { PerfilUsuario } from '@prisma/client'

import { Marca } from '@/componentes/marca'
import { sessaoDoServidor } from '@/lib/sessao'
import { ehEquipe } from '@/lib/autorizacao'
import { prisma } from '@/lib/prisma'
import { sair } from './acoes'

const MENU = [
  {
    grupo: 'Visão geral',
    itens: [{ icone: '▤', rotulo: 'Painel', ativo: true }],
  },
  {
    grupo: 'Operação',
    itens: [
      { icone: '◉', rotulo: 'Clientes', ativo: false },
      { icone: '▦', rotulo: 'Casos', ativo: false },
      { icone: '▣', rotulo: 'Documentos', ativo: false },
    ],
  },
  {
    grupo: 'Administração',
    itens: [
      { icone: '⚙', rotulo: 'Usuários', ativo: false },
      { icone: '⌁', rotulo: 'API', ativo: false },
    ],
  },
] as const

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

        <nav className="flex flex-col gap-0.5">
          {MENU.map((secao) => (
            <div key={secao.grupo}>
              <div className="px-2.5 pb-1.5 pt-3.5 text-[10px] uppercase tracking-[0.12em] text-[#6E6E76]">
                {secao.grupo}
              </div>
              {secao.itens.map((item) => (
                <div
                  key={item.rotulo}
                  aria-current={item.ativo ? 'page' : undefined}
                  className={[
                    'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px]',
                    item.ativo
                      ? 'bg-grafite-600 text-[#F2F2F2]'
                      : 'text-[#B9B9C0] opacity-60',
                  ].join(' ')}
                >
                  <span className="w-[15px] text-center text-[13px]" aria-hidden="true">
                    {item.icone}
                  </span>
                  {item.rotulo}
                </div>
              ))}
            </div>
          ))}
        </nav>

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
