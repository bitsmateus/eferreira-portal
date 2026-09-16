'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { excluirCasoDaLista } from '@/app/painel/casos/acoes'

/**
 * O botão de excluir na própria ficha do caso — ao lado de "Editar".
 *
 * Não precisa do menu com portal de `menu-do-caso.tsx`: aqui não há tabela
 * com rolagem lateral cortando nada, é só um botão no topo da página. Mesma
 * confirmação em duas etapas de sempre, e a mesma trava contra apagar caso
 * com andamento ou documento.
 */
function BotaoDeConfirmar() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="botao botao-secundario text-erro">
      {pending ? 'Excluindo…' : 'Confirmar exclusão'}
    </button>
  )
}

export function ExcluirCasoBotao({ casoId, titulo }: { casoId: string; titulo: string }) {
  const [confirmando, setConfirmando] = useState(false)
  const [estado, excluir] = useActionState(
    excluirCasoDaLista.bind(null, casoId),
    undefined,
  )

  if (confirmando) {
    return (
      <form action={excluir} className="flex items-center gap-2">
        <input type="hidden" name="confirmacao" value="excluir" />
        <span className="text-[12px] text-texto-2">
          Excluir <b className="text-texto">{titulo}</b> de vez?
        </span>
        <BotaoDeConfirmar />
        <button
          type="button"
          onClick={() => setConfirmando(false)}
          className="text-[12px] text-texto-2 underline underline-offset-2"
        >
          cancelar
        </button>
      </form>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="botao botao-secundario text-erro"
      >
        Excluir
      </button>
      {estado?.erro !== undefined && (
        <p className="max-w-[320px] text-right text-[11.5px] leading-relaxed text-erro">
          {estado.erro}
        </p>
      )}
    </div>
  )
}
