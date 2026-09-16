'use client'

import Link from 'next/link'
import { useActionState, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { excluirClienteDaLista } from '@/app/painel/clientes/acoes'

/**
 * O menu de cada linha da lista de clientes: abrir, editar e excluir.
 *
 * Fica num menu, e não em três botões soltos, porque a linha inteira já é
 * clicável — encher a última coluna de botões faria a tabela parecer um
 * formulário.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ELE PRECISA PARAR O CLIQUE DA LINHA
 *
 * A linha é um link que cobre tudo (ver `clientes/page.tsx`). Sem
 * `stopPropagation`, clicar em "Excluir" abriria a ficha em vez de excluir.
 * Por isso a coluna do menu sobe acima do link e cada clique daqui morre
 * aqui.
 * ─────────────────────────────────────────────────────────────────────────
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

export function MenuDoCliente({
  clienteId,
  nome,
}: {
  clienteId: string
  nome: string
}) {
  const [aberto, setAberto] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [estado, excluir] = useActionState(
    excluirClienteDaLista.bind(null, clienteId),
    undefined,
  )
  const caixa = useRef<HTMLDivElement>(null)

  // Fechar clicando fora e no Esc: menu que só fecha no próprio botão fica
  // aberto atrás do dedo de quem já foi fazer outra coisa.
  useEffect(() => {
    if (!aberto) return

    function noDocumento(evento: MouseEvent) {
      if (caixa.current !== null && !caixa.current.contains(evento.target as Node)) {
        setAberto(false)
        setConfirmando(false)
      }
    }
    function noTeclado(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        setAberto(false)
        setConfirmando(false)
      }
    }

    document.addEventListener('mousedown', noDocumento)
    document.addEventListener('keydown', noTeclado)
    return () => {
      document.removeEventListener('mousedown', noDocumento)
      document.removeEventListener('keydown', noTeclado)
    }
  }, [aberto])

  // A recusa (cliente com histórico) precisa ficar visível: sem isto o menu
  // fecharia e a pessoa não saberia por que nada aconteceu.
  useEffect(() => {
    if (estado?.erro !== undefined) setAberto(true)
  }, [estado])

  return (
    <div
      ref={caixa}
      className="relative z-10 inline-block text-left"
      onClick={(evento) => evento.stopPropagation()}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label={`Ações de ${nome}`}
        onClick={() => setAberto((estava) => !estava)}
        className="botao botao-secundario botao-pequeno"
      >
        <span aria-hidden="true">⋯</span>
      </button>

      {aberto && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-[230px] rounded-lg border border-borda bg-superficie p-1 shadow-lg"
        >
          <Link
            role="menuitem"
            href={`/painel/clientes/${clienteId}`}
            className="block rounded-md px-2.5 py-1.5 text-[12.5px] hover:bg-prata-100"
          >
            Abrir a ficha
          </Link>
          <Link
            role="menuitem"
            href={`/painel/clientes/${clienteId}/editar`}
            className="block rounded-md px-2.5 py-1.5 text-[12.5px] hover:bg-prata-100"
          >
            Editar o cadastro
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
                Excluir <b className="text-texto">{nome}</b> de vez? Só é possível
                enquanto o cadastro não tiver documento nem andamento.
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
              Excluir o cliente
            </button>
          )}
        </div>
      )}
    </div>
  )
}
