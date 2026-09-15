'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { EtiquetaDeAcesso } from '@/componentes/situacoes'
import {
  registrarAssinaturaDoContrato,
  revogarAcessoDoCliente,
} from '@/app/painel/clientes/acoes'

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
      className={
        variante === 'principal'
          ? 'botao botao-pequeno'
          : 'botao botao-fantasma botao-pequeno'
      }
    >
      {children}
    </button>
  )
}

/**
 * O gatilho do Anexo I, 1.d, na ficha do cliente.
 *
 * Até a Sprint 4 o sistema perguntava "o contrato foi assinado?" em três telas
 * e não tinha onde responder. É aqui que se responde — e é esta data que abre
 * a porta do portal para o cliente.
 *
 * Desde 15/09/2026, o contrato assinado pela D4Sign preenche isto sozinho —
 * a conferência da assinatura chama a mesma função. Este cartão continua aqui
 * para o contrato assinado EM PAPEL e para corrigir data errada.
 */
export function AcessoDoCliente({
  clienteId,
  temEmail,
  assinadoEmIso,
  assinadoEmFormatado,
  hojeIso,
}: {
  clienteId: string
  temEmail: boolean
  /** null = contrato ainda não assinado; o cliente não entra. */
  assinadoEmIso: string | null
  assinadoEmFormatado: string | null
  /** Hoje em São Paulo (regra 11), calculado no servidor. */
  hojeIso: string
}) {
  const [estadoDoRegistro, registrar] = useActionState(
    registrarAssinaturaDoContrato.bind(null, clienteId),
    undefined,
  )
  const [estadoDaRevogacao, revogar] = useActionState(
    revogarAcessoDoCliente.bind(null, clienteId),
    undefined,
  )
  const [confirmandoRevogacao, setConfirmandoRevogacao] = useState(false)

  const liberado = assinadoEmIso !== null
  const erro = estadoDoRegistro?.erro ?? estadoDaRevogacao?.erro

  return (
    <div className="cartao">
      <div className="cartao-cabecalho">
        <h2>Acesso do cliente</h2>
      </div>

      <div className="cartao-corpo">
        <div className="mb-3 flex flex-wrap items-center gap-2.5">
          <EtiquetaDeAcesso acessoLiberado={liberado} temEmail={temEmail} />
          {liberado && assinadoEmFormatado !== null && (
            <span className="text-[12px] text-texto-2">
              contrato assinado em{' '}
              <span className="mono">{assinadoEmFormatado}</span>
            </span>
          )}
        </div>

        {erro !== undefined && (
          <div className="aviso aviso-erro mb-3" role="alert">
            <span aria-hidden="true">▲</span>
            <div>{erro}</div>
          </div>
        )}

        {!liberado ? (
          <>
            <p className="mb-3 text-[12px] leading-relaxed text-texto-2">
              O acesso é liberado só depois que o contrato for assinado (Anexo I,
              1.d). Informe a data que consta no documento assinado.
            </p>

            <form action={registrar} className="flex flex-wrap items-end gap-2">
              <div className="min-w-[160px] flex-1">
                <label className="campo-rotulo" htmlFor="assinadoEm">
                  Data da assinatura
                </label>
                <input
                  id="assinadoEm"
                  name="assinadoEm"
                  type="date"
                  max={hojeIso}
                  required
                  defaultValue={hojeIso}
                  className="campo-entrada mono"
                />
              </div>
              <Botao>Liberar acesso</Botao>
            </form>

            {!temEmail && (
              <p className="dica dica-erro">
                Sem e-mail no cadastro não há para onde mandar o código. Preencha o
                e-mail antes.
              </p>
            )}
          </>
        ) : (
          <>
            <p className="mb-3 text-[12px] leading-relaxed text-texto-2">
              O cliente entra em <span className="mono">/consultar</span> com o
              CPF ou CNPJ e um código enviado ao e-mail do cadastro. Ele vê apenas
              os próprios casos.
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <form action={registrar} className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="campo-rotulo" htmlFor="assinadoEm">
                    Corrigir a data
                  </label>
                  <input
                    id="assinadoEm"
                    name="assinadoEm"
                    type="date"
                    max={hojeIso}
                    required
                    defaultValue={assinadoEmIso ?? hojeIso}
                    className="campo-entrada mono"
                  />
                </div>
                <Botao variante="fantasma">Salvar data</Botao>
              </form>
            </div>

            <div className="mt-3 border-t border-prata-100 pt-3">
              {confirmandoRevogacao ? (
                <form action={revogar}>
                  <input type="hidden" name="confirmacao" value="revogar" />
                  <p className="mb-2 text-[12px] text-texto-2">
                    Revogar apaga a data da assinatura, encerra a sessão do cliente
                    e invalida os códigos pendentes. Fica registrado na auditoria.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Botao variante="fantasma">Confirmar revogação</Botao>
                    <button
                      type="button"
                      onClick={() => setConfirmandoRevogacao(false)}
                      className="text-[12px] text-texto-2 underline underline-offset-2"
                    >
                      cancelar
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmandoRevogacao(true)}
                  className="text-[12px] text-erro underline underline-offset-2"
                >
                  Revogar o acesso deste cliente
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
