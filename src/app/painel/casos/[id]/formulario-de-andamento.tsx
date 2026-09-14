'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useFormStatus } from 'react-dom'

import { registrarAndamento } from './acoes'

type Status = { id: string; nome: string }

function BotaoLancar() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="botao" disabled={pending}>
      {pending ? 'Lançando…' : 'Lançar andamento'}
    </button>
  )
}

export function FormularioDeAndamento({
  casoId,
  status,
  hoje,
  /** Sem nenhum andamento ainda, o primeiro da lista vem escolhido. */
  statusSugerido,
}: {
  casoId: string
  status: readonly Status[]
  hoje: string
  statusSugerido: string
}) {
  const [estado, enviar] = useActionState(
    registrarAndamento.bind(null, casoId),
    undefined,
  )
  const erros = estado?.erros ?? {}
  const formulario = useRef<HTMLFormElement>(null)

  // Depois de lançar, limpa para o próximo — quem lança um costuma lançar
  // outro em seguida.
  useEffect(() => {
    if (estado?.sucesso === true) formulario.current?.reset()
  }, [estado])

  if (status.length === 0) {
    return (
      <div className="aviso aviso-atencao">
        <span aria-hidden="true">▲</span>
        <div>
          <b>Nenhuma situação cadastrada.</b> A lista de situações do processo é
          definida pelo escritório. Sem ela não há como lançar andamento — nada é
          inventado aqui.
        </div>
      </div>
    )
  }

  return (
    <form action={enviar} ref={formulario} noValidate>
      {estado?.mensagem !== undefined && (
        <div className="aviso aviso-erro mb-4" role="alert">
          <span aria-hidden="true">▲</span>
          <div>{estado.mensagem}</div>
        </div>
      )}

      {estado?.sucesso === true && (
        <div className="aviso aviso-ok mb-4" role="status">
          <span aria-hidden="true">✓</span>
          <div>Andamento lançado. Já aparece na linha do tempo abaixo.</div>
        </div>
      )}

      <div className="flex flex-col gap-0 sm:flex-row sm:gap-3.5">
        <div className="flex-1">
          <div className="mb-[15px]">
            <label className="campo-rotulo" htmlFor="data">
              Data
            </label>
            <input
              id="data"
              name="data"
              type="date"
              required
              max={hoje}
              defaultValue={hoje}
              className="campo-entrada mono"
            />
            {erros['data'] !== undefined && (
              <p className="dica dica-erro" role="alert">
                {erros['data']}
              </p>
            )}
          </div>
        </div>

        <div className="flex-1">
          <div className="mb-[15px]">
            <label className="campo-rotulo" htmlFor="statusId">
              Situação
            </label>
            <select
              id="statusId"
              name="statusId"
              required
              className="campo-entrada"
              defaultValue={statusSugerido}
            >
              <option value="">Escolha a situação…</option>
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
      </div>

      <div className="mb-[15px]">
        <label className="campo-rotulo" htmlFor="descricao">
          Descrição visível ao cliente
        </label>
        <textarea
          id="descricao"
          name="descricao"
          required
          rows={3}
          className="campo-entrada min-h-[74px] resize-y"
          placeholder="Ex.: Petição juntada aos autos. Aguardando decisão sobre as provas requeridas."
        />
        {erros['descricao'] !== undefined ? (
          <p className="dica dica-erro" role="alert">
            {erros['descricao']}
          </p>
        ) : (
          <p className="dica">
            Este texto aparece na consulta do cliente. Escreva pensando em quem não é
            advogado.
          </p>
        )}
      </div>

      <BotaoLancar />
    </form>
  )
}
