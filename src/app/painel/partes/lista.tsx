'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { PapelDaParte } from '@prisma/client'

import { Etiqueta } from '@/componentes/etiqueta'
import { formatarData } from '@/lib/datas'
import { ROTULO_DO_PAPEL_DA_PARTE } from '@/lib/rotulos-de-assinatura'
import type { LinhaDeParte } from '@/lib/partes'
import { cadastrarParte, excluirParteDaLista } from './acoes'

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
      {pending ? '…' : children}
    </button>
  )
}

/**
 * Cadastro de uma parte avulsa — quem não é cliente do escritório e vai
 * assinar um documento anexo (parte contrária, testemunha, advogado externo).
 */
export function NovaParte() {
  const [estado, criar] = useActionState(cadastrarParte, undefined)

  return (
    <div className="cartao">
      <div className="cartao-cabecalho">
        <h2>Nova parte</h2>
      </div>
      <div className="cartao-corpo">
        {estado?.mensagem !== undefined && (
          <div className="aviso aviso-erro mb-3" role="alert">
            <span aria-hidden="true">▲</span>
            <div>{estado.mensagem}</div>
          </div>
        )}

        <form action={criar} noValidate>
          <div className="mb-[15px]">
            <label className="campo-rotulo" htmlFor="nome">
              Nome
            </label>
            <input id="nome" name="nome" required className="campo-entrada" />
            {estado?.erros?.['nome'] !== undefined && (
              <p className="dica dica-erro">{estado.erros['nome']}</p>
            )}
          </div>

          <div className="mb-[15px]">
            <label className="campo-rotulo" htmlFor="papel">
              Papel
            </label>
            <select id="papel" name="papel" className="campo-entrada" defaultValue="">
              <option value="" disabled>
                Escolha…
              </option>
              {Object.values(PapelDaParte).map((papel) => (
                <option key={papel} value={papel}>
                  {ROTULO_DO_PAPEL_DA_PARTE[papel]}
                </option>
              ))}
            </select>
            {estado?.erros?.['papel'] !== undefined && (
              <p className="dica dica-erro">{estado.erros['papel']}</p>
            )}
          </div>

          <div className="mb-[15px]">
            <label className="campo-rotulo" htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="campo-entrada"
            />
            {estado?.erros?.['email'] !== undefined ? (
              <p className="dica dica-erro">{estado.erros['email']}</p>
            ) : (
              <p className="dica">É para este endereço que a D4Sign manda o convite.</p>
            )}
          </div>

          <div className="mb-[15px]">
            <label className="campo-rotulo" htmlFor="telefone">
              Telefone
            </label>
            <input id="telefone" name="telefone" className="campo-entrada mono" />
          </div>

          <div className="mb-[15px]">
            <label className="campo-rotulo" htmlFor="observacoes">
              Observações
            </label>
            <input
              id="observacoes"
              name="observacoes"
              className="campo-entrada"
              placeholder="Ex.: advogado da parte contrária no caso X"
            />
            {estado?.erros?.['observacoes'] !== undefined && (
              <p className="dica dica-erro">{estado.erros['observacoes']}</p>
            )}
          </div>

          <Botao>Cadastrar</Botao>
        </form>
      </div>
    </div>
  )
}

function ExcluirParte({ parteId }: { parteId: string }) {
  const [estado, excluir] = useActionState(
    excluirParteDaLista.bind(null, parteId),
    undefined,
  )
  const [confirmando, setConfirmando] = useState(false)

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="text-[12px] text-erro underline underline-offset-2"
      >
        Excluir
      </button>
    )
  }

  return (
    <form action={excluir} className="text-right">
      <input type="hidden" name="confirmacao" value="excluir" />
      {estado?.mensagem !== undefined && <p className="dica dica-erro">{estado.mensagem}</p>}
      <div className="flex justify-end gap-2">
        <Botao variante="fantasma">Confirmar</Botao>
        <button
          type="button"
          onClick={() => setConfirmando(false)}
          className="text-[12px] text-texto-2 underline underline-offset-2"
        >
          cancelar
        </button>
      </div>
    </form>
  )
}

export function ListaDePartes({ partes }: { partes: readonly LinhaDeParte[] }) {
  if (partes.length === 0) {
    return (
      <div className="cartao">
        <div className="cartao-cabecalho">
          <h2>Partes cadastradas</h2>
        </div>
        <div className="px-[18px] py-9 text-center">
          <p className="mb-1 text-[13.5px] font-medium text-texto-2">
            Nenhuma parte cadastrada ainda.
          </p>
          <p className="text-[12.5px] text-texto-3">
            Cadastre aqui quem não é cliente do escritório e vai assinar um
            documento avulso — parte contrária, testemunha, advogado externo.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="cartao">
      <div className="cartao-cabecalho">
        <h2>Partes cadastradas</h2>
        <span className="ml-auto text-[12px] text-texto-2">
          {partes.length === 1 ? '1 parte' : `${partes.length} partes`}
        </span>
      </div>

      <div className="px-[18px] py-1.5">
        {partes.map((parte) => (
          <div
            key={parte.id}
            className="flex flex-wrap items-center gap-3 border-b border-prata-100 py-3 last:border-b-0"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium">{parte.nome}</div>
              <div className="mono mt-0.5 text-[11.5px] text-texto-3">{parte.email}</div>
              {parte.observacoes !== null && (
                <div className="mt-1 text-[11.5px] text-texto-3">{parte.observacoes}</div>
              )}
              <div className="mt-1 text-[11.5px] text-texto-3">
                cadastrada em <span className="mono">{formatarData(parte.criadoEm)}</span>
              </div>
            </div>

            <div className="ml-auto flex flex-wrap items-center justify-end gap-2.5">
              <Etiqueta tom="neutra">{ROTULO_DO_PAPEL_DA_PARTE[parte.papel]}</Etiqueta>
              <ExcluirParte parteId={parte.id} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
