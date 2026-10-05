'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { Etiqueta } from '@/componentes/etiqueta'
import { diaEmSaoPaulo, formatarData } from '@/lib/datas'
import type { LinhaDeEvento } from '@/lib/eventos'
import { concluirEvento, excluirEventoDoCaso } from './acoes'

function BotaoDeAlternar({ rotulo }: { rotulo: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="botao botao-fantasma botao-pequeno">
      {pending ? 'Aguarde…' : rotulo}
    </button>
  )
}

function BotaoDeConfirmarExclusao() {
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

function LinhaDeEventoItem({
  casoId,
  evento,
  hoje,
}: {
  casoId: string
  evento: LinhaDeEvento
  hoje: string
}) {
  const cumprido = evento.cumpridoEm !== null
  const [estadoAlternar, alternar] = useActionState(
    concluirEvento.bind(null, casoId, evento.id, !cumprido),
    undefined,
  )
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)
  const [estadoExcluir, excluir] = useActionState(
    excluirEventoDoCaso.bind(null, casoId, evento.id),
    undefined,
  )

  const atrasado = !cumprido && diaEmSaoPaulo(evento.prazoDeEntrega) < hoje

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-prata-100 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium">{evento.assunto}</div>
        <div className="mt-0.5 text-[11.5px] text-texto-3">
          Responsável: {evento.responsavel.nome} · Prazo:{' '}
          <span className="mono">{formatarData(evento.prazoDeEntrega)}</span>
          {cumprido && evento.criadoPor !== null && <> · criado por {evento.criadoPor.nome}</>}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {cumprido ? (
          <Etiqueta tom="ok">Cumprido</Etiqueta>
        ) : atrasado ? (
          <Etiqueta tom="erro">Prazo vencido</Etiqueta>
        ) : (
          <Etiqueta tom="info">Pendente</Etiqueta>
        )}

        <form action={alternar}>
          <BotaoDeAlternar rotulo={cumprido ? 'Reabrir' : 'Marcar como cumprido'} />
        </form>
        {estadoAlternar?.erro !== undefined && (
          <p className="dica dica-erro" role="alert">
            {estadoAlternar.erro}
          </p>
        )}

        {confirmandoExclusao ? (
          <form action={excluir} className="flex items-center gap-1.5">
            <span className="text-[11px] text-texto-2">Excluir?</span>
            <BotaoDeConfirmarExclusao />
            <button
              type="button"
              onClick={() => setConfirmandoExclusao(false)}
              className="text-[11px] text-texto-2 underline underline-offset-2"
            >
              cancelar
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmandoExclusao(true)}
            aria-label={`Excluir ${evento.assunto}`}
            className="botao botao-fantasma botao-pequeno text-erro"
          >
            Excluir
          </button>
        )}
        {estadoExcluir?.erro !== undefined && (
          <p className="dica dica-erro" role="alert">
            {estadoExcluir.erro}
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * Eventos do caso — prazos e tarefas internas da equipe (05/10/2026). Não é
 * o que o cliente vê: `listarEventosDoCaso` já recusa sessão de perfil
 * CLIENTE, e esta lista só aparece no painel interno.
 */
export function ListaDeEventos({
  casoId,
  eventos,
  hoje,
}: {
  casoId: string
  eventos: readonly LinhaDeEvento[]
  /** Dia civil de hoje em São Paulo (regra 11), calculado no servidor. */
  hoje: string
}) {
  if (eventos.length === 0) {
    return <p className="py-2 text-[12.5px] text-texto-3">Nenhum evento criado ainda.</p>
  }

  return (
    <div>
      {eventos.map((evento) => (
        <LinhaDeEventoItem key={evento.id} casoId={casoId} evento={evento} hoje={hoje} />
      ))}
    </div>
  )
}
