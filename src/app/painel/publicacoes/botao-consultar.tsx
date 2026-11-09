'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { consultarAgora } from './acoes'

function Botao() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="botao botao-secundario botao-pequeno">
      {pending ? 'Consultando o DJEN…' : 'Consultar agora'}
    </button>
  )
}

/** A mesma rodada da rotina diária, disparada da tela. */
export function BotaoConsultar() {
  const [estado, enviar] = useActionState(async () => consultarAgora(), undefined)
  return (
    <form action={enviar} className="flex flex-wrap items-center gap-2">
      {estado?.mensagem !== undefined && (
        <span className={`text-[12px] ${estado.sucesso === true ? 'text-texto-2' : 'text-erro'}`} role="status">
          {estado.mensagem}
        </span>
      )}
      <Botao />
    </form>
  )
}
