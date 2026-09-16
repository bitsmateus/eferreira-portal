'use client'

import { createPortal } from 'react-dom'
import { useActionState, useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'

import type { EstadoDaExclusao } from '@/app/painel/clientes/acoes'
import { descreverHistoricoDoCliente } from '@/lib/clientes'

/**
 * O popup de exclusão forçada — pedido do escritório (16/09/2026) depois de
 * esbarrar na trava de `excluirCliente` com um cliente de teste que já tinha
 * caso e andamento.
 *
 * Só existe porque a decisão de forçar precisa ser difícil de tomar por
 * engano: nome do cliente digitado à mão, o que será apagado por extenso, e
 * só o ADMINISTRADOR chega até aqui — `excluirCliente` recusa o pedido de
 * quem não for (ver `src/lib/clientes.ts`), e as duas telas que abrem este
 * popup (`menu-do-cliente.tsx`, `excluir-cliente-botao.tsx`) só o fazem
 * quando `souAdministrador` é verdadeiro.
 */
function BotaoDeConfirmar({ habilitado }: { habilitado: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending || !habilitado}
      className="botao bg-erro text-white disabled:cursor-not-allowed disabled:opacity-40"
    >
      {pending ? 'Excluindo tudo…' : 'Excluir tudo mesmo assim'}
    </button>
  )
}

export function ModalDeExclusaoForcada({
  nome,
  documentos,
  andamentos,
  contratoAssinado,
  acao,
  aoFechar,
}: {
  nome: string
  documentos: number
  andamentos: number
  contratoAssinado: boolean
  acao: (estado: EstadoDaExclusao, dados: FormData) => Promise<EstadoDaExclusao>
  aoFechar: () => void
}) {
  const [estado, excluirForcado] = useActionState(acao, undefined)
  const [digitado, setDigitado] = useState('')
  const nomeConfere = digitado.trim().toLowerCase() === nome.trim().toLowerCase()

  useEffect(() => {
    function noTeclado(evento: KeyboardEvent) {
      if (evento.key === 'Escape') aoFechar()
    }
    document.addEventListener('keydown', noTeclado)
    return () => document.removeEventListener('keydown', noTeclado)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={aoFechar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-exclusao-forcada"
        className="w-full max-w-[440px] rounded-lg bg-superficie p-5 shadow-xl"
        onClick={(evento) => evento.stopPropagation()}
      >
        <h2 id="titulo-exclusao-forcada" className="mb-2 text-[15px] font-semibold">
          Excluir <span className="text-erro">tudo</span> de {nome}?
        </h2>

        <p className="mb-3 text-[13px] leading-relaxed text-texto-2">
          Este cliente tem{' '}
          <b className="text-texto">
            {descreverHistoricoDoCliente({ documentos, andamentos, contratoAssinado })}
          </b>
          . Forçar a exclusão apaga o cadastro e tudo isso <b>para sempre</b> — caso,
          andamento e documento não voltam. Não é para dado de processo de verdade.
        </p>

        <div className="mb-4">
          <label className="campo-rotulo" htmlFor="confirmar-nome-cliente">
            Para confirmar, digite o nome do cliente: <span className="mono">{nome}</span>
          </label>
          <input
            id="confirmar-nome-cliente"
            className="campo-entrada"
            value={digitado}
            onChange={(evento) => setDigitado(evento.target.value)}
            autoComplete="off"
            autoFocus
          />
        </div>

        {estado?.situacao === 'erro' && (
          <p className="dica dica-erro mb-3" role="alert">
            {estado.mensagem}
          </p>
        )}

        <form action={excluirForcado} className="flex items-center gap-3">
          <input type="hidden" name="confirmacao" value="excluir-tudo" />
          <BotaoDeConfirmar habilitado={nomeConfere} />
          <button
            type="button"
            onClick={aoFechar}
            className="text-[12px] text-texto-2 underline underline-offset-2"
          >
            cancelar
          </button>
        </form>
      </div>
    </div>,
    document.body,
  )
}
