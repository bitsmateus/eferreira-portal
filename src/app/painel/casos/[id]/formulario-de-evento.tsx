'use client'

import { useActionState, useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { registrarEvento } from './acoes'

type Responsavel = { id: string; nome: string }

function BotaoCriar() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="botao botao-secundario botao-pequeno" disabled={pending}>
      {pending ? 'Criando…' : '+ Criar evento'}
    </button>
  )
}

function Obrigatorio() {
  return (
    <>
      <span aria-hidden="true" className="text-erro">
        {' *'}
      </span>
      <span className="sr-only"> (obrigatório)</span>
    </>
  )
}

/**
 * "Criar evento" — prazo e tarefa interna da equipe, pedido do escritório
 * (05/10/2026). Mesmo padrão de campos controlados e limpeza só no sucesso
 * do `FormularioDeAndamento`.
 */
export function FormularioDeEvento({
  casoId,
  responsaveis,
}: {
  casoId: string
  responsaveis: readonly Responsavel[]
}) {
  const [estado, enviar] = useActionState(registrarEvento.bind(null, casoId), undefined)
  const erros = estado?.erros ?? {}

  const [campos, setCampos] = useState({
    responsavelId: '',
    assunto: '',
    prazoDeEntrega: '',
  })

  useEffect(() => {
    if (estado?.sucesso === true) {
      setCampos({ responsavelId: '', assunto: '', prazoDeEntrega: '' })
    }
  }, [estado])

  function definir<C extends keyof typeof campos>(nome: C, valor: string): void {
    setCampos((atual) => ({ ...atual, [nome]: valor }))
  }

  return (
    <form action={enviar} noValidate className="mb-4 rounded-md border border-borda p-3.5">
      {estado?.mensagem !== undefined && (
        <div className="aviso aviso-erro mb-3" role="alert">
          <span aria-hidden="true">▲</span>
          <div>{estado.mensagem}</div>
        </div>
      )}

      <div className="mb-3">
        <label className="campo-rotulo" htmlFor="assunto">
          Assunto / atividade
          <Obrigatorio />
        </label>
        <input
          id="assunto"
          name="assunto"
          required
          maxLength={180}
          placeholder="Ex.: Protocolar recurso"
          className="campo-entrada"
          value={campos.assunto}
          onChange={(evento) => definir('assunto', evento.target.value)}
        />
        {erros['assunto'] !== undefined && (
          <p className="dica dica-erro" role="alert">
            {erros['assunto']}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-0 sm:flex-row sm:gap-3.5">
        <div className="flex-1">
          <div className="mb-3">
            <label className="campo-rotulo" htmlFor="responsavelId">
              Responsável
              <Obrigatorio />
            </label>
            <select
              id="responsavelId"
              name="responsavelId"
              required
              className="campo-entrada"
              value={campos.responsavelId}
              onChange={(evento) => definir('responsavelId', evento.target.value)}
            >
              <option value="">Escolha o responsável…</option>
              {responsaveis.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                </option>
              ))}
            </select>
            {erros['responsavelId'] !== undefined && (
              <p className="dica dica-erro" role="alert">
                {erros['responsavelId']}
              </p>
            )}
          </div>
        </div>

        <div className="flex-1">
          <div className="mb-3">
            <label className="campo-rotulo" htmlFor="prazoDeEntrega">
              Prazo de entrega
              <Obrigatorio />
            </label>
            <input
              id="prazoDeEntrega"
              name="prazoDeEntrega"
              type="date"
              required
              className="campo-entrada mono"
              value={campos.prazoDeEntrega}
              onChange={(evento) => definir('prazoDeEntrega', evento.target.value)}
            />
            {erros['prazoDeEntrega'] !== undefined && (
              <p className="dica dica-erro" role="alert">
                {erros['prazoDeEntrega']}
              </p>
            )}
          </div>
        </div>
      </div>

      <BotaoCriar />
    </form>
  )
}
