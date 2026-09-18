'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { SituacaoCliente } from '@prisma/client'

import { desativarCliente, reativarCliente } from '@/app/painel/clientes/acoes'

function Botao({
  rotulo,
  variante = 'principal',
}: {
  rotulo: string
  variante?: 'principal' | 'secundario' | 'fantasma'
}) {
  // `useFormStatus` só enxerga o `<form>` de um ANCESTRAL — por isso mora
  // num componente à parte, renderizado dentro do form, e não no mesmo
  // componente que desenha o `<form>` em si.
  const { pending } = useFormStatus()
  const classe =
    variante === 'principal'
      ? 'botao'
      : variante === 'secundario'
        ? 'botao botao-secundario'
        : 'botao botao-fantasma'
  return (
    <button type="submit" disabled={pending} className={classe}>
      {pending ? 'Aguarde…' : rotulo}
    </button>
  )
}

/**
 * Desativar/reativar cliente (item 4 da lista de melhorias), na ficha.
 *
 * Desativar pede confirmação — bloqueia o portal do cliente, mesmo cuidado
 * de `desativarUsuario` na tela de Usuários. Reativar não pede: não apaga
 * nada e desfaz na hora.
 */
export function AlternarSituacaoDoClienteBotao({
  clienteId,
  situacao,
}: {
  clienteId: string
  situacao: SituacaoCliente
}) {
  const [confirmando, setConfirmando] = useState(false)
  const [estado, alternar] = useActionState(
    situacao === SituacaoCliente.ATIVO
      ? desativarCliente.bind(null, clienteId)
      : reativarCliente.bind(null, clienteId),
    undefined,
  )

  if (situacao === SituacaoCliente.INATIVO) {
    return (
      <form action={alternar} className="inline-flex flex-col items-end gap-1">
        <Botao rotulo="Reativar cliente" variante="secundario" />
        {estado?.erro !== undefined && (
          <p className="dica dica-erro" role="alert">
            {estado.erro}
          </p>
        )}
      </form>
    )
  }

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="botao botao-secundario"
      >
        Desativar cliente
      </button>
    )
  }

  return (
    <form action={alternar} className="inline-flex flex-col items-end gap-1">
      <input type="hidden" name="confirmacao" value="desativar" />
      <div className="flex items-center gap-2">
        <Botao rotulo="Confirmar" variante="fantasma" />
        <button
          type="button"
          onClick={() => setConfirmando(false)}
          className="text-[12px] text-texto-2 underline underline-offset-2"
        >
          cancelar
        </button>
      </div>
      {estado?.erro !== undefined && (
        <p className="dica dica-erro" role="alert">
          {estado.erro}
        </p>
      )}
    </form>
  )
}
