'use client'

import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

/**
 * O menu da barra lateral some inteiro abaixo de `md` (ver `layout.tsx` do
 * painel) — sem isto, quem abre o sistema no celular não tem como navegar
 * entre Clientes, Casos, Usuários, API, nem como sair da conta. Este botão
 * mostra o MESMO conteúdo da barra lateral (passado como `children`, o
 * mesmo `<Marca />` + `<MenuLateral />` + rodapé de sessão), só que dentro de
 * uma gaveta que desliza da esquerda.
 *
 * `createPortal` para o `<body>`, mesmo motivo de `menu-do-cliente.tsx`: uma
 * gaveta de altura de tela inteira dentro do fluxo normal do topo móvel
 * ficaria presa pelo `overflow-hidden` do layout do painel.
 */
export function MenuMobile({ children }: { children: React.ReactNode }) {
  const [aberto, setAberto] = useState(false)
  const caminho = usePathname()

  // Fecha ao navegar — sem isto, trocar de tela deixaria a gaveta aberta por
  // cima da página nova.
  useEffect(() => {
    setAberto(false)
  }, [caminho])

  useEffect(() => {
    if (!aberto) return

    function noTeclado(evento: KeyboardEvent) {
      if (evento.key === 'Escape') setAberto(false)
    }
    document.addEventListener('keydown', noTeclado)

    // Trava a rolagem da página de trás enquanto a gaveta está aberta — sem
    // isto, arrastar o dedo sobre o fundo escurecido rolaria a página atrás.
    const overflowOriginal = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', noTeclado)
      document.body.style.overflow = overflowOriginal
    }
  }, [aberto])

  return (
    <>
      <button
        type="button"
        aria-label={aberto ? 'Fechar menu' : 'Abrir menu'}
        aria-expanded={aberto}
        aria-haspopup="true"
        onClick={() => setAberto((atual) => !atual)}
        className="ml-auto flex h-9 w-9 flex-none items-center justify-center rounded-md text-[22px] text-[#EDEDED] md:hidden"
      >
        <span aria-hidden="true">☰</span>
      </button>

      {aberto &&
        createPortal(
          <div className="fixed inset-0 z-[200] md:hidden" role="dialog" aria-modal="true">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setAberto(false)}
              aria-hidden="true"
            />
            <div className="absolute inset-y-0 left-0 flex w-[82%] max-w-[280px] flex-col gap-6 overflow-y-auto bg-grafite-800 px-3.5 py-5 shadow-xl">
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => setAberto(false)}
                className="ml-auto flex h-8 w-8 flex-none items-center justify-center rounded-md text-[18px] text-[#B9B9C0]"
              >
                <span aria-hidden="true">✕</span>
              </button>
              {children}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
