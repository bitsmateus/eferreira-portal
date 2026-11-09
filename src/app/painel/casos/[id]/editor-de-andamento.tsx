'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { corrigirAndamento, excluirAndamentoDoCaso } from './acoes'

type Status = { id: string; nome: string }

function BotaoSalvar() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="botao botao-pequeno" disabled={pending}>
      {pending ? 'Salvando…' : 'Salvar correção'}
    </button>
  )
}

function BotaoDeConfirmarExclusao() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="text-[11.5px] text-erro underline underline-offset-2">
      {pending ? 'Excluindo…' : 'Confirmar exclusão'}
    </button>
  )
}

/**
 * Corrige um andamento já lançado (14/10/2026): data, situação e descrição.
 * Fica fechado até alguém clicar em "Corrigir"; salvar com sucesso fecha de
 * novo. Quem lançou e quando continuam como estavam — ver `editarAndamento`.
 */
export function EditorDeAndamento({
  casoId,
  andamento,
  status,
  hoje,
}: {
  casoId: string
  andamento: { id: string; data: string; statusId: string | null; descricao: string }
  status: readonly Status[]
  hoje: string
}) {
  const [aberto, setAberto] = useState(false)
  const [campos, setCampos] = useState({
    data: andamento.data,
    statusId: andamento.statusId ?? '',
    descricao: andamento.descricao,
  })

  const [estado, enviar] = useActionState(
    async (anterior: Parameters<typeof corrigirAndamento>[2], dados: FormData) => {
      const resultado = await corrigirAndamento(casoId, andamento.id, anterior, dados)
      if (resultado?.sucesso === true) setAberto(false)
      return resultado
    },
    undefined,
  )
  const erros = estado?.erros ?? {}

  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)
  const [estadoExcluir, excluir] = useActionState(
    excluirAndamentoDoCaso.bind(null, casoId, andamento.id),
    undefined,
  )

  if (!aberto) {
    return (
      <>
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="ml-2 text-[11.5px] text-texto-2 underline underline-offset-2"
        >
          Corrigir
        </button>
        {confirmandoExclusao ? (
          <form action={excluir} className="ml-2 inline-flex items-center gap-1.5">
            <span className="text-[11.5px] text-texto-2">Excluir este andamento?</span>
            <BotaoDeConfirmarExclusao />
            <button
              type="button"
              onClick={() => setConfirmandoExclusao(false)}
              className="text-[11.5px] text-texto-2 underline underline-offset-2"
            >
              cancelar
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmandoExclusao(true)}
            className="ml-2 text-[11.5px] text-erro underline underline-offset-2"
          >
            Excluir
          </button>
        )}
        {estadoExcluir?.erro !== undefined && (
          <p className="dica dica-erro" role="alert">
            {estadoExcluir.erro}
          </p>
        )}
      </>
    )
  }

  return (
    <form action={enviar} noValidate className="mt-2 rounded-md border border-borda p-3">
      {estado?.mensagem !== undefined && (
        <div className="aviso aviso-erro mb-3" role="alert">
          <span aria-hidden="true">▲</span>
          <div>{estado.mensagem}</div>
        </div>
      )}

      <div className="flex flex-col gap-0 sm:flex-row sm:gap-3.5">
        <div className="flex-1">
          <label className="campo-rotulo" htmlFor={`data-${andamento.id}`}>
            Data
          </label>
          <input
            id={`data-${andamento.id}`}
            name="data"
            type="date"
            required
            max={hoje}
            className="campo-entrada mono"
            value={campos.data}
            onChange={(evento) => setCampos({ ...campos, data: evento.target.value })}
          />
          {erros['data'] !== undefined && (
            <p className="dica dica-erro" role="alert">
              {erros['data']}
            </p>
          )}
        </div>

        <div className="mb-3 flex-1">
          <label className="campo-rotulo" htmlFor={`status-${andamento.id}`}>
            Situação
          </label>
          <select
            id={`status-${andamento.id}`}
            name="statusId"
            required
            className="campo-entrada"
            value={campos.statusId}
            onChange={(evento) => setCampos({ ...campos, statusId: evento.target.value })}
          >
            {/* A situação atual sempre aparece, mesmo se o escritório a tiver desativado. */}
            {andamento.statusId !== null && !status.some((item) => item.id === andamento.statusId) && (
              <option value={andamento.statusId}>(situação atual)</option>
            )}
            {andamento.statusId === null && <option value="">Escolha a situação…</option>}
            {status.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome}
              </option>
            ))}
          </select>
          {erros['statusId'] !== undefined && (
            <p className="dica dica-erro" role="alert">
              {erros['statusId']}
            </p>
          )}
        </div>
      </div>

      <div className="mb-3">
        <label className="campo-rotulo" htmlFor={`descricao-${andamento.id}`}>
          Descrição visível ao cliente
        </label>
        <textarea
          id={`descricao-${andamento.id}`}
          name="descricao"
          required
          rows={3}
          className="campo-entrada min-h-[74px] resize-y"
          value={campos.descricao}
          onChange={(evento) => setCampos({ ...campos, descricao: evento.target.value })}
        />
        {erros['descricao'] !== undefined && (
          <p className="dica dica-erro" role="alert">
            {erros['descricao']}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <BotaoSalvar />
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="text-[12px] text-texto-2 underline underline-offset-2"
        >
          cancelar
        </button>
      </div>
    </form>
  )
}
