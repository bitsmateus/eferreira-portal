'use client'

import Link from 'next/link'
import { createPortal } from 'react-dom'
import { useActionState, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { excluirCasoDaLista } from '@/app/painel/casos/acoes'

/** Largura do menu, em pixels — usada para calcular onde ele cabe na tela. */
const LARGURA_DO_MENU = 230

/**
 * O menu de cada linha da lista de casos: abrir, editar e excluir.
 *
 * Mesmo desenho de `menu-do-cliente.tsx`, com o mesmo motivo: o menu é
 * desenhado fora da tabela via portal, com posição fixa calculada a partir do
 * botão na tela. Sem isso, a rolagem lateral da tabela (`overflow-x: auto`)
 * corta o menu pela borda vertical também — é regra do CSS, não bug de um
 * lugar só, então os dois menus recebem o mesmo conserto.
 */
function BotaoDeConfirmar() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md px-2.5 py-1.5 text-left text-[12.5px] text-erro hover:bg-prata-100"
    >
      {pending ? 'Excluindo…' : 'Confirmar exclusão'}
    </button>
  )
}

export function MenuDoCaso({
  casoId,
  titulo,
}: {
  casoId: string
  /** Número do processo, ou o assunto quando ainda não há número. */
  titulo: string
}) {
  const [aberto, setAberto] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [posicao, setPosicao] = useState<{ top: number; left: number } | null>(null)
  const [estado, excluir] = useActionState(
    excluirCasoDaLista.bind(null, casoId),
    undefined,
  )
  const botaoRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  function fechar() {
    setAberto(false)
    setConfirmando(false)
  }

  function abrir() {
    const retangulo = botaoRef.current?.getBoundingClientRect()
    if (retangulo === undefined) return

    const esquerda = Math.max(
      8,
      Math.min(retangulo.right - LARGURA_DO_MENU, window.innerWidth - LARGURA_DO_MENU - 8),
    )
    setPosicao({ top: retangulo.bottom + 4, left: esquerda })
    setAberto(true)
  }

  function alternar() {
    if (aberto) {
      fechar()
      return
    }
    abrir()
  }

  useEffect(() => {
    if (!aberto) return

    function noDocumento(evento: MouseEvent) {
      const alvo = evento.target as Node
      const dentroDoBotao = botaoRef.current?.contains(alvo) ?? false
      const dentroDoMenu = menuRef.current?.contains(alvo) ?? false
      if (!dentroDoBotao && !dentroDoMenu) fechar()
    }
    function noTeclado(evento: KeyboardEvent) {
      if (evento.key === 'Escape') fechar()
    }

    document.addEventListener('mousedown', noDocumento)
    document.addEventListener('keydown', noTeclado)
    window.addEventListener('scroll', fechar, true)
    window.addEventListener('resize', fechar)
    return () => {
      document.removeEventListener('mousedown', noDocumento)
      document.removeEventListener('keydown', noTeclado)
      window.removeEventListener('scroll', fechar, true)
      window.removeEventListener('resize', fechar)
    }
  }, [aberto])

  // A recusa (caso com andamento ou documento) precisa ficar visível: usar
  // `alternar()` aqui fecharia o menu em vez de reabri-lo, porque ele já
  // estava aberto quando o formulário de confirmação foi enviado — dando a
  // impressão de que nada aconteceu ao clicar em excluir.
  useEffect(() => {
    if (estado?.erro !== undefined) abrir()
  }, [estado])

  return (
    <>
      <button
        ref={botaoRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label={`Ações de ${titulo}`}
        onClick={(evento) => {
          evento.stopPropagation()
          alternar()
        }}
        className="botao botao-secundario botao-pequeno"
      >
        <span aria-hidden="true">⋯</span>
      </button>

      {aberto &&
        posicao !== null &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            onClick={(evento) => evento.stopPropagation()}
            style={{
              position: 'fixed',
              top: posicao.top,
              left: posicao.left,
              width: LARGURA_DO_MENU,
            }}
            className="z-50 rounded-lg border border-borda bg-superficie p-1 shadow-lg"
          >
            <Link
              role="menuitem"
              href={`/painel/casos/${casoId}`}
              className="block rounded-md px-2.5 py-1.5 text-[12.5px] hover:bg-prata-100"
            >
              Abrir o caso
            </Link>
            <Link
              role="menuitem"
              href={`/painel/casos/${casoId}/editar`}
              className="block rounded-md px-2.5 py-1.5 text-[12.5px] hover:bg-prata-100"
            >
              Editar
            </Link>

            <div className="my-1 border-t border-prata-100" />

            {estado?.erro !== undefined && (
              <p className="px-2.5 py-1.5 text-[11.5px] leading-relaxed text-erro">
                {estado.erro}
              </p>
            )}

            {confirmando ? (
              <form action={excluir}>
                <input type="hidden" name="confirmacao" value="excluir" />
                <p className="px-2.5 py-1.5 text-[11.5px] leading-relaxed text-texto-2">
                  Excluir <b className="text-texto">{titulo}</b> de vez? Só é possível
                  enquanto o caso não tiver andamento nem documento.
                </p>
                <BotaoDeConfirmar />
                <button
                  type="button"
                  onClick={() => setConfirmando(false)}
                  className="w-full rounded-md px-2.5 py-1.5 text-left text-[12px] text-texto-2 hover:bg-prata-100"
                >
                  Cancelar
                </button>
              </form>
            ) : (
              <button
                type="button"
                role="menuitem"
                onClick={() => setConfirmando(true)}
                className="block w-full rounded-md px-2.5 py-1.5 text-left text-[12.5px] text-erro hover:bg-prata-100"
              >
                Excluir o caso
              </button>
            )}
          </div>,
          document.body,
        )}
    </>
  )
}
