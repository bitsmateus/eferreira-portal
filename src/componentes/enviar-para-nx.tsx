'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import {
  enviarClienteParaNxAcao,
  enviarTodosParaNxAcao,
} from '@/app/painel/clientes/acoes'
import type { ResultadoDaSincronizacaoNx } from '@/lib/contato-nx'

function Botao({ rotulo, secundario = true }: { rotulo: string; secundario?: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className={secundario ? 'botao botao-secundario' : 'botao'}
    >
      {pending ? 'Enviando…' : rotulo}
    </button>
  )
}

function mensagemDoResultado(resultado: ResultadoDaSincronizacaoNx): {
  texto: string
  erro: boolean
} {
  switch (resultado.situacao) {
    case 'criado':
      return { texto: 'Contato criado na NX.', erro: false }
    case 'atualizado':
      return { texto: 'Contato atualizado na NX.', erro: false }
    case 'sem_telefone':
      return {
        texto: 'Este cadastro não tem telefone, e é pelo número que o contato é achado na NX.',
        erro: true,
      }
    case 'desligado':
      return {
        texto: 'A integração com a NX não está configurada neste ambiente (NX_API_URL / NX_API_TOKEN).',
        erro: true,
      }
    case 'cliente_inexistente':
      return { texto: 'Cliente não encontrado.', erro: true }
    case 'falhou':
      return { texto: `A NX não aceitou: ${resultado.motivo}.`, erro: true }
  }
}

/** Botão da ficha do cliente. */
export function EnviarParaNxBotao({ clienteId }: { clienteId: string }) {
  const [estado, enviar] = useActionState(enviarClienteParaNxAcao.bind(null, clienteId), undefined)
  const mensagem = estado === undefined ? null : mensagemDoResultado(estado.resultado)

  return (
    <form action={enviar} className="inline-flex flex-col items-end gap-1">
      <Botao rotulo="Enviar para a NX" />
      {mensagem !== null && (
        <p className={mensagem.erro ? 'dica dica-erro' : 'dica'} role="status">
          {mensagem.texto}
        </p>
      )}
    </form>
  )
}

/** Botão geral da lista de clientes (administrador). */
export function EnviarTodosParaNxBotao() {
  const [confirmando, setConfirmando] = useState(false)
  const [estado, enviar] = useActionState(enviarTodosParaNxAcao, undefined)
  const resumo = estado?.resumo

  return (
    <div className="inline-flex flex-col items-end gap-1">
      {!confirmando ? (
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className="botao botao-secundario"
        >
          Enviar todos para a NX
        </button>
      ) : (
        <form action={enviar} className="flex items-center gap-2">
          <Botao rotulo="Confirmar envio de todos" />
          <button
            type="button"
            onClick={() => setConfirmando(false)}
            className="text-[12px] text-texto-2 underline underline-offset-2"
          >
            cancelar
          </button>
        </form>
      )}

      {resumo !== undefined && (
        <div className="max-w-[420px] text-right" role="status">
          {resumo.desligado ? (
            <p className="dica dica-erro">
              A integração com a NX não está configurada neste ambiente.
            </p>
          ) : (
            <>
              <p className="dica">
                {resumo.total} clientes: {resumo.criados} criados, {resumo.atualizados}{' '}
                atualizados, {resumo.jaEnviados} já estavam enviados, {resumo.semTelefone} sem telefone, {resumo.falhas.length} com falha.
              </p>
              {resumo.falhas.slice(0, 5).map((falha) => (
                <p key={falha.clienteId} className="dica dica-erro">
                  {falha.nome}: {falha.motivo}
                </p>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
