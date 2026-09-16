'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * O menu do protótipo. Os itens ainda sem tela ficam visíveis e apagados, com
 * o motivo — é mais honesto com quem usa do que esconder.
 *
 * "Documentos" dizia "Entra na Sprint 3" muito depois de a Sprint 3 ter
 * entregue a geração de documentos. Um aviso que envelhece e ninguém percebe
 * é pior do que nenhum: quem lê conclui que o sistema está atrasado. O texto
 * agora diz onde os documentos ESTÃO, que é o que a pessoa quer saber.
 */
const MENU = [
  {
    grupo: 'Visão geral',
    itens: [{ icone: '▤', rotulo: 'Painel', href: '/painel' }],
  },
  {
    grupo: 'Operação',
    itens: [
      { icone: '◉', rotulo: 'Clientes', href: '/painel/clientes' },
      { icone: '▦', rotulo: 'Casos', href: '/painel/casos' },
      {
        icone: '▣',
        rotulo: 'Documentos',
        href: null,
        motivo: 'Cada documento fica na pasta do cliente a que pertence',
      },
    ],
  },
  {
    grupo: 'Administração',
    itens: [
      { icone: '⚙', rotulo: 'Usuários', href: '/painel/usuarios' },
      { icone: '⌁', rotulo: 'API', href: '/painel/api' },
    ],
  },
] as const

function estaAtivo(caminho: string, href: string): boolean {
  if (href === '/painel') return caminho === '/painel'
  return caminho === href || caminho.startsWith(`${href}/`)
}

export function MenuLateral() {
  const caminho = usePathname()

  return (
    <nav className="flex flex-col gap-0.5">
      {MENU.map((secao) => (
        <div key={secao.grupo}>
          <div className="px-2.5 pb-1.5 pt-3.5 text-[10px] uppercase tracking-[0.12em] text-[#6E6E76]">
            {secao.grupo}
          </div>

          {secao.itens.map((item) => {
            const conteudo = (
              <>
                <span className="w-[15px] text-center text-[13px]" aria-hidden="true">
                  {item.icone}
                </span>
                {item.rotulo}
              </>
            )

            if (item.href === null) {
              return (
                <div
                  key={item.rotulo}
                  title={'motivo' in item ? item.motivo : 'Entra numa próxima etapa'}
                  className="flex cursor-default items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] text-[#B9B9C0] opacity-40"
                >
                  {conteudo}
                </div>
              )
            }

            const ativo = estaAtivo(caminho, item.href)

            return (
              <Link
                key={item.rotulo}
                href={item.href}
                aria-current={ativo ? 'page' : undefined}
                className={[
                  'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] transition-colors',
                  ativo
                    ? 'bg-grafite-600 text-[#F2F2F2]'
                    : 'text-[#B9B9C0] hover:bg-grafite-700 hover:text-[#EDEDED]',
                ].join(' ')}
              >
                {conteudo}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
