'use client'

import Link from 'next/link'
import { useActionState, useEffect, useRef } from 'react'
import { useFormStatus } from 'react-dom'

import { formatarDocumento } from '@/lib/documento'
import { desvincularSocio, vincularSocio } from '@/app/painel/clientes/[id]/representantes/acoes'

export type Representante = {
  pessoaFisicaId: string
  nome: string
  documento: string
  qualificacao: string | null
  /** A qualificação do sócio é o que entra na procuração da empresa. */
  qualificacaoCompleta: boolean
}

function BotaoVincular() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="botao botao-pequeno" disabled={pending}>
      {pending ? 'Vinculando…' : 'Vincular'}
    </button>
  )
}

function BotaoDesvincular({
  empresaId,
  pessoaFisicaId,
}: {
  empresaId: string
  pessoaFisicaId: string
}) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      className="botao botao-fantasma botao-pequeno"
      disabled={pending}
      formAction={desvincularSocio.bind(null, empresaId, pessoaFisicaId)}
    >
      {pending ? '…' : 'Desvincular'}
    </button>
  )
}

export function RepresentantesLegais({
  empresaId,
  representantes,
}: {
  empresaId: string
  representantes: readonly Representante[]
}) {
  const [estado, enviar] = useActionState(vincularSocio.bind(null, empresaId), undefined)
  const formulario = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (estado?.sucesso === true) formulario.current?.reset()
  }, [estado])

  return (
    <div className="cartao">
      <div className="cartao-cabecalho">
        <h2>Representantes legais</h2>
        <span className="ml-auto text-[12px] text-texto-2">
          {representantes.length === 1 ? '1 sócio' : `${representantes.length} sócios`}
        </span>
      </div>

      <div className="cartao-corpo">
        {representantes.length === 0 ? (
          <div className="aviso aviso-atencao mb-4">
            <span aria-hidden="true">▲</span>
            <div>
              <b>Nenhum sócio vinculado.</b> A procuração e o contrato de uma empresa
              são assinados pelo representante legal, e a qualificação que entra no
              documento é a dele. Sem sócio vinculado, não há como gerar os documentos
              desta empresa.
            </div>
          </div>
        ) : (
          <div className="mb-4">
            {representantes.map((socio) => (
              <div
                key={socio.pessoaFisicaId}
                className="flex flex-wrap items-center gap-3 border-b border-prata-100 py-2.5 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/painel/clientes/${socio.pessoaFisicaId}`}
                    className="text-[13px] font-medium underline decoration-borda underline-offset-2 hover:decoration-texto-2"
                  >
                    {socio.nome}
                  </Link>
                  <div className="mono mt-0.5 text-[11.5px] text-texto-3">
                    {formatarDocumento(socio.documento)}
                    {socio.qualificacao !== null && ` · ${socio.qualificacao}`}
                  </div>
                  {!socio.qualificacaoCompleta && (
                    <p className="dica dica-erro">
                      Cadastro incompleto: falta RG ou nome da mãe, que a procuração
                      exige.
                    </p>
                  )}
                </div>

                <form>
                  <BotaoDesvincular
                    empresaId={empresaId}
                    pessoaFisicaId={socio.pessoaFisicaId}
                  />
                </form>
              </div>
            ))}
          </div>
        )}

        <form action={enviar} ref={formulario} noValidate>
          {estado?.mensagem !== undefined && (
            <div className="aviso aviso-erro mb-3" role="alert">
              <span aria-hidden="true">▲</span>
              <div>{estado.mensagem}</div>
            </div>
          )}

          <div className="flex flex-col gap-0 sm:flex-row sm:gap-3">
            <div className="flex-1">
              <label className="campo-rotulo" htmlFor="documento">
                CPF do sócio
              </label>
              <input
                id="documento"
                name="documento"
                inputMode="numeric"
                required
                className="campo-entrada mono"
                placeholder="000.000.000-00"
              />
            </div>
            <div className="flex-1">
              <label className="campo-rotulo" htmlFor="qualificacao">
                Qualificação
              </label>
              <input
                id="qualificacao"
                name="qualificacao"
                className="campo-entrada"
                placeholder="sócio administrador"
              />
            </div>
          </div>

          {estado?.erros?.['documento'] !== undefined ? (
            <p className="dica dica-erro" role="alert">
              {estado.erros['documento']}
            </p>
          ) : (
            <p className="dica">
              O sócio precisa já estar cadastrado como cliente pessoa física.
            </p>
          )}

          <div className="mt-3">
            <BotaoVincular />
          </div>
        </form>
      </div>
    </div>
  )
}
