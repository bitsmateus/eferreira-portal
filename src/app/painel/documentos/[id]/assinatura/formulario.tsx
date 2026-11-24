'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import {
  conferirAssinaturaDoEnvio,
  enviarDocumentoParaAssinatura,
  reenviarDocumentoPelaZapSign,
  type EstadoDaAssinatura,
} from './acoes'

/** O que o envio consome, conforme a plataforma. */
export function custoDoEnvio(plataforma: string): string {
  return plataforma === 'ZapSign'
    ? 'um documento do plano da ZapSign é usado'
    : 'um crédito do escritório é consumido'
}

function Botao({
  children,
  variante = 'principal',
}: {
  children: React.ReactNode
  variante?: 'principal' | 'fantasma'
}) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className={variante === 'principal' ? 'botao' : 'botao botao-secundario'}
    >
      {pending ? 'Aguarde…' : children}
    </button>
  )
}

function Recado({ estado }: { estado: EstadoDaAssinatura }) {
  if (estado === undefined) return null

  if (estado.erro !== undefined) {
    return (
      <div className="aviso aviso-erro mb-4" role="alert">
        <span aria-hidden="true">▲</span>
        <div>
          {estado.erro}
          {estado.faltando !== undefined && estado.faltando.length > 0 && (
            <ul className="mt-1.5 list-disc pl-4">
              {estado.faltando.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          {estado.ondePreencher !== undefined && (
            <p className="mt-1.5">
              <Link
                href={estado.ondePreencher}
                className="underline underline-offset-2"
              >
                Preencher o cadastro
              </Link>
            </p>
          )}
        </div>
      </div>
    )
  }

  if (estado.mensagem !== undefined) {
    return (
      <div className="aviso aviso-ok mb-4" role="status">
        <span aria-hidden="true">●</span>
        <div>{estado.mensagem}</div>
      </div>
    )
  }

  return null
}

/**
 * A confirmação do envio.
 *
 * Dois passos de propósito. O primeiro clique não envia nada: ele abre o aviso
 * do que vai acontecer — um crédito do escritório a menos e um e-mail de
 * assinatura na caixa do cliente. Só o segundo manda.
 *
 * Não é excesso de zelo. Em produção não há ensaio: nada disso se desfaz.
 */
export function ConfirmacaoDeEnvio({
  documentoId,
  quantasPartes,
  retomando,
  plataforma,
}: {
  documentoId: string
  quantasPartes: number
  /** "D4Sign" ou "ZapSign": de quem é o e-mail que a pessoa recebe. */
  plataforma: string
  /** O documento já está no cofre de uma tentativa anterior que não saiu. */
  retomando: boolean
}) {
  const [estado, enviar] = useActionState(
    enviarDocumentoParaAssinatura.bind(null, documentoId),
    undefined,
  )
  const [confirmando, setConfirmando] = useState(false)

  return (
    <>
      <Recado estado={estado} />

      {confirmando ? (
        <form action={enviar}>
          <input type="hidden" name="confirmacao" value="enviar" />
          <div className="aviso aviso-atencao mb-3">
            <span aria-hidden="true">▲</span>
            <div>
              Ao confirmar, {quantasPartes === 1 ? 'a pessoa' : 'as pessoas'} da
              lista acima {quantasPartes === 1 ? 'recebe' : 'recebem'} agora um
              e-mail da {plataforma}, e {custoDoEnvio(plataforma)}.
              <strong> Isso não se desfaz.</strong>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Botao>Confirmar o envio</Botao>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="text-[12.5px] text-texto-2 underline underline-offset-2"
            >
              cancelar
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className="botao"
        >
          {retomando ? 'Tentar o envio de novo' : 'Enviar para assinatura'}
        </button>
      )}
    </>
  )
}

/** Pergunta à plataforma se já assinaram. Leitura: não gasta crédito. */
export function BotaoDeConferencia({
  envioId,
  documentoId,
  clienteId,
}: {
  envioId: string
  documentoId: string
  clienteId: string
}) {
  const [estado, conferir] = useActionState(
    conferirAssinaturaDoEnvio.bind(null, envioId, documentoId, clienteId),
    undefined,
  )

  return (
    <>
      <Recado estado={estado} />
      <form action={conferir}>
        <input type="hidden" name="confirmacao" value="conferir" />
        <Botao variante="fantasma">Conferir agora</Botao>
      </form>
    </>
  )
}

/**
 * Reenvio pela ZapSign de um envio pendente na D4Sign (11/2026). Só aparece
 * com a ZapSign ligada. Dois passos, como o envio: gasta um documento do plano
 * e todos recebem convite novo, inclusive quem já assinou na D4Sign.
 */
export function BotaoDeReenvio({
  documentoId,
  clienteId,
}: {
  documentoId: string
  clienteId: string
}) {
  const [estado, reenviar] = useActionState(
    reenviarDocumentoPelaZapSign.bind(null, documentoId, clienteId),
    undefined,
  )
  const [confirmando, setConfirmando] = useState(false)

  return (
    <div className="mb-4">
      <Recado estado={estado} />
      {confirmando ? (
        <form action={reenviar}>
          <input type="hidden" name="confirmacao" value="reenviar" />
          <div className="aviso aviso-atencao mb-3">
            <span aria-hidden="true">▲</span>
            <div>
              O envio pela D4Sign é cancelado e todos da lista recebem um convite novo
              da ZapSign — inclusive quem já assinou. Um documento do plano da ZapSign
              é usado. <strong>Isso não se desfaz.</strong>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Botao>Confirmar o reenvio</Botao>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="text-[12.5px] text-texto-2 underline underline-offset-2"
            >
              cancelar
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setConfirmando(true)} className="botao">
          Reenviar pela ZapSign
        </button>
      )}
    </div>
  )
}
