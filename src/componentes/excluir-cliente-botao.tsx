'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { excluirClienteDaLista } from '@/app/painel/clientes/acoes'

/**
 * O botão de excluir na própria tela de edição do cliente — ao lado de
 * "Salvar alterações" fica errado, então vive no topo da página, ao lado do
 * título. Mesmo padrão de `excluir-caso-botao.tsx`: sem portal, porque aqui
 * não há tabela com rolagem lateral cortando nada, e a mesma trava contra
 * apagar cliente com documento, andamento ou contrato assinado.
 */
function BotaoDeConfirmar() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="botao botao-secundario text-erro">
      {pending ? 'Excluindo…' : 'Confirmar exclusão'}
    </button>
  )
}

export function ExcluirClienteBotao({
  clienteId,
  nome,
}: {
  clienteId: string
  nome: string
}) {
  const [confirmando, setConfirmando] = useState(false)
  const [estado, excluir] = useActionState(
    excluirClienteDaLista.bind(null, clienteId),
    undefined,
  )

  if (confirmando) {
    return (
      <form action={excluir} className="flex items-center gap-2">
        <input type="hidden" name="confirmacao" value="excluir" />
        <span className="text-[12px] text-texto-2">
          Excluir <b className="text-texto">{nome}</b> de vez?
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
        Excluir cliente
      </button>
      {estado?.erro !== undefined && (
        <p className="max-w-[320px] text-right text-[11.5px] leading-relaxed text-erro">
          {estado.erro}
        </p>
      )}
    </div>
  )
}
