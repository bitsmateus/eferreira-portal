'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { SENTINELA_STATUS_PERSONALIZADO } from '@/lib/andamentos'
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

export function FormularioDeAndamento({
  casoId,
  status,
  hoje,
  /** Sem nenhum andamento ainda, o primeiro da lista vem escolhido. */
  statusSugerido,
  /**
   * Editar, gerar documento e excluir — pedido do escritório (17/09/2026)
   * para ficarem ao lado de "Lançar andamento", em vez de lá no topo da
   * página. Continuam ações do CASO, não do andamento; só a posição mudou.
   */
  acoesDoCaso,
}: {
  casoId: string
  status: readonly Status[]
  hoje: string
  statusSugerido: string
  acoesDoCaso?: React.ReactNode
}) {
  const [estado, enviar] = useActionState(
    registrarAndamento.bind(null, casoId),
    undefined,
  )
  const erros = estado?.erros ?? {}

  /**
   * Campos controlados, como nos demais formulários.
   *
   * Aqui o que se perdia era a **descrição** — o único campo do sistema em que
   * alguém escreve um parágrafo pensado para o cliente ler. Recusar o
   * lançamento por causa da situação em branco e levar junto o texto inteiro é
   * o tipo de coisa que faz a pessoa escrever menos da próxima vez.
   */
  const [campos, setCampos] = useState({
    data: hoje,
    statusId: statusSugerido,
    statusPersonalizado: '',
    descricao: '',
  })

  const campoPersonalizado = useRef<HTMLInputElement>(null)
  const ehPersonalizado = campos.statusId === SENTINELA_STATUS_PERSONALIZADO

  // Depois de lançar, limpa para o próximo — quem lança um costuma lançar
  // outro em seguida. Só no SUCESSO: a recusa não apaga nada.
  useEffect(() => {
    if (estado?.sucesso === true) {
      setCampos({ data: hoje, statusId: statusSugerido, statusPersonalizado: '', descricao: '' })
    }
  }, [estado, hoje, statusSugerido])

  // Ao escolher "Personalizado…", o cursor já vai para o campo de texto —
  // sem isso, quem escolheu teria que clicar de novo para começar a digitar.
  useEffect(() => {
    if (ehPersonalizado) campoPersonalizado.current?.focus()
  }, [ehPersonalizado])

  function definir<C extends keyof typeof campos>(nome: C, valor: string): void {
    setCampos((atual) => ({ ...atual, [nome]: valor }))
  }

  return (
    <form action={enviar} noValidate>
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
              <Obrigatorio />
            </label>
            <input
              id="data"
              name="data"
              type="date"
              required
              max={hoje}
              value={campos.data}
              onChange={(evento) => definir('data', evento.target.value)}
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
              <Obrigatorio />
            </label>
            <select
              id="statusId"
              name="statusId"
              required
              className="campo-entrada"
              value={campos.statusId}
              onChange={(evento) => definir('statusId', evento.target.value)}
            >
              <option value="">Escolha a situação…</option>
              {status.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                </option>
              ))}
              <option value={SENTINELA_STATUS_PERSONALIZADO}>+ Personalizado…</option>
            </select>
            {erros['statusId'] !== undefined && (
              <p className="dica dica-erro" role="alert">
                {erros['statusId']}
              </p>
            )}

            {/*
              O texto digitado aqui vira uma entrada NOVA na lista do
              escritório, não uma anotação solta — a próxima vez que alguém
              for lançar andamento, ela já aparece pronta no <select> acima,
              sem precisar ser digitada de novo. Ver `statusParaGravar` em
              `src/lib/andamentos.ts`.
            */}
            {ehPersonalizado && (
              <div className="mt-2">
                <input
                  ref={campoPersonalizado}
                  id="statusPersonalizado"
                  name="statusPersonalizado"
                  required
                  maxLength={60}
                  placeholder="Digite a situação"
                  className="campo-entrada"
                  value={campos.statusPersonalizado}
                  onChange={(evento) => definir('statusPersonalizado', evento.target.value)}
                />
                {erros['statusPersonalizado'] !== undefined ? (
                  <p className="dica dica-erro" role="alert">
                    {erros['statusPersonalizado']}
                  </p>
                ) : (
                  <p className="dica">
                    Passa a existir na lista de situações — nas próximas vezes, escolha
                    ela em vez de digitar de novo.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {status.length === 0 && !ehPersonalizado && (
        <div className="aviso aviso-atencao mb-4">
          <span aria-hidden="true">▲</span>
          <div>
            <b>Nenhuma situação cadastrada ainda.</b> Escolha &ldquo;+
            Personalizado…&rdquo; acima para criar a primeira — as próximas ficam
            prontas na lista.
          </div>
        </div>
      )}

      <div className="mb-[15px]">
        <label className="campo-rotulo" htmlFor="descricao">
          Descrição visível ao cliente
          <Obrigatorio />
        </label>
        <textarea
          id="descricao"
          name="descricao"
          required
          rows={3}
          className="campo-entrada min-h-[74px] resize-y"
          placeholder="Ex.: Petição juntada aos autos. Aguardando decisão sobre as provas requeridas."
          value={campos.descricao}
          onChange={(evento) => definir('descricao', evento.target.value)}
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

      <div className="flex flex-wrap items-center gap-3">
        <BotaoLancar />
        {acoesDoCaso}
      </div>
    </form>
  )
}
