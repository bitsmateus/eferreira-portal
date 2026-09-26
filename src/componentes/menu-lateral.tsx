'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * O menu do protótipo.
 *
 * "Documentos" ficava apagado, com o motivo em texto ("cada documento fica
 * na pasta do cliente a que pertence"), até 18/09/2026 — item 2 da lista de
 * melhorias: a pergunta do dia a dia é "quais contratos estão aguardando
 * assinatura?", e isso só se respondia abrindo cliente por cliente.
 * `/painel/documentos` cruza todos os clientes; a pasta de cada cliente
 * continua existindo do mesmo jeito. Sem item apagado no menu no momento —
 * se um novo entrar antes de ter tela, o padrão de antes (item sem `href`,
 * desenhado como texto fosco com o motivo) está no histórico do git.
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
      { icone: '◈', rotulo: 'Partes', href: '/painel/partes' },
      { icone: '⚖', rotulo: 'Advogados', href: '/painel/advogados' },
      { icone: '▣', rotulo: 'Documentos', href: '/painel/documentos' },
    ],
  },
  {
    grupo: 'Administração',
    itens: [
      { icone: '⚙', rotulo: 'Usuários', href: '/painel/usuarios' },
      { icone: '⌁', rotulo: 'API', href: '/painel/api' },
    ],
  },
  {
    grupo: 'Conta',
    itens: [{ icone: '☺', rotulo: 'Minha conta', href: '/painel/conta' }],
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
