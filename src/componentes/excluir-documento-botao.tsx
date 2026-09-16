'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { excluirDocumentoDaPasta } from '@/app/painel/documentos/acoes'

/**
 * O botão de excluir de cada linha da pasta do cliente.
 *
 * Só aparece nos documentos que PODEM ser excluídos — assinado e enviado
 * para assinatura ficam sem o botão, em vez de mostrar um botão fadado a
 * ser recusado (ver `vaiExcluir` em `pasta-do-cliente.tsx`). A recusa do
 * servidor continua existindo por baixo — a tela só evita o erro feio para
 * quem só está usando a interface normalmente.
 *
 * Confirmação em duas etapas, como em toda exclusão do sistema. Não precisa
 * de portal como o menu de clientes e de casos: aqui não há tabela com
 * rolagem lateral cortando nada, é uma lista simples.
 */
function BotaoDeConfirmar() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="botao botao-fantasma botao-pequeno text-erro"
    >
      {pending ? 'Excluindo…' : 'Confirmar'}
    </button>
  )
}

export function ExcluirDocumentoBotao({
  documentoId,
  clienteId,
  casoId,
  nome,
}: {
  documentoId: string
  clienteId: string
  casoId: string | null
  nome: string
}) {
  const [confirmando, setConfirmando] = useState(false)
  const [estado, excluir] = useActionState(
    excluirDocumentoDaPasta.bind(null, documentoId, clienteId, casoId),
    undefined,
  )

  if (confirmando) {
    return (
      <form action={excluir} className="flex items-center gap-1.5">
        <input type="hidden" name="confirmacao" value="excluir" />
        <span className="text-[11px] text-texto-2">Excluir?</span>
        <BotaoDeConfirmar />
        <button
          type="button"
          onClick={() => setConfirmando(false)}
          className="text-[11px] text-texto-2 underline underline-offset-2"
        >
          cancelar
        </button>
      </form>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        aria-label={`Excluir ${nome}`}
        className="botao botao-fantasma botao-pequeno text-erro"
      >
        Excluir
      </button>
      {estado?.erro !== undefined && (
        <p className="mt-1 w-full text-right text-[11px] leading-relaxed text-erro">
          {estado.erro}
        </p>
      )}
    </>
  )
}
