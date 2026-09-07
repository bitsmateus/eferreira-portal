'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { SituacaoCaso } from '@prisma/client'

import { ROTULO_DA_SITUACAO } from '@/componentes/situacoes'
import { formatarNumeroDeProcesso } from '@/lib/formatos'
import type { EstadoDoCaso } from './acoes'

export type ValoresDoCaso = {
  numeroProcesso: string
  assunto: string
  vara: string
  parteContraria: string
  situacao: string
  responsavelId: string
}

export const VALORES_VAZIOS: ValoresDoCaso = {
  numeroProcesso: '',
  assunto: '',
  vara: '',
  parteContraria: '',
  situacao: SituacaoCaso.EM_ANDAMENTO,
  responsavelId: '',
}

type Props = {
  acao: (estado: EstadoDoCaso, dados: FormData) => Promise<EstadoDoCaso>
  valores: ValoresDoCaso
  responsaveis: readonly { id: string; nome: string }[]
  rotuloDoBotao: string
  hrefCancelar: string
}

function Campo({
  nome,
  rotulo,
  children,
  erro,
  dica,
}: {
  nome: string
  rotulo: string
  children: React.ReactNode
  erro?: string
  dica?: string
}) {
  return (
    <div className="mb-[15px]">
      <label className="campo-rotulo" htmlFor={nome}>
        {rotulo}
      </label>
      {children}
      {erro !== undefined ? (
        <p className="dica dica-erro" role="alert">
          {erro}
        </p>
      ) : (
        dica !== undefined && <p className="dica">{dica}</p>
      )}
    </div>
  )
}

function BotaoSalvar({ rotulo }: { rotulo: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="botao" disabled={pending}>
      {pending ? 'Salvando…' : rotulo}
    </button>
  )
}

export function FormularioDeCaso({
  acao,
  valores,
  responsaveis,
  rotuloDoBotao,
  hrefCancelar,
}: Props) {
  const [estado, enviar] = useActionState(acao, undefined)
  const erros = estado?.erros ?? {}

  return (
    <form action={enviar} noValidate>
      {estado?.mensagem !== undefined && (
        <div className="aviso aviso-erro mb-4" role="alert">
          <span aria-hidden="true">▲</span>
          <div>{estado.mensagem}</div>
        </div>
      )}

      {estado?.conflito !== undefined && (
        <div className="aviso aviso-atencao mb-4" role="alert">
          <span aria-hidden="true">▲</span>
          <div>
            Esta numeração já pertence a outro caso.{' '}
            <Link
              href={`/painel/casos/${estado.conflito.id}`}
              className="underline underline-offset-2"
            >
              Abrir o caso existente
            </Link>
            .
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="cartao">
          <div className="cartao-cabecalho">
            <h2>Dados do caso</h2>
          </div>

          <div className="cartao-corpo">
            <Campo
              nome="numeroProcesso"
              rotulo="Número do processo"
              erro={erros['numeroProcesso']}
              dica="Pode ficar em branco: caso ainda em fase pré-processual não tem número."
            >
              <input
                id="numeroProcesso"
                name="numeroProcesso"
                inputMode="numeric"
                className="campo-entrada mono"
                placeholder="0000000-00.0000.0.00.0000"
                defaultValue={formatarNumeroDeProcesso(valores.numeroProcesso)}
              />
            </Campo>

            <Campo nome="assunto" rotulo="Assunto" erro={erros['assunto']}>
              <input
                id="assunto"
                name="assunto"
                required
                className="campo-entrada"
                placeholder="Ação de cobrança"
                defaultValue={valores.assunto}
              />
            </Campo>

            <div className="flex flex-col gap-0 sm:flex-row sm:gap-3.5">
              <div className="flex-1">
                <Campo nome="vara" rotulo="Vara / Foro" erro={erros['vara']}>
                  <input
                    id="vara"
                    name="vara"
                    className="campo-entrada"
                    defaultValue={valores.vara}
                  />
                </Campo>
              </div>
              <div className="flex-1">
                <Campo
                  nome="parteContraria"
                  rotulo="Parte contrária"
                  erro={erros['parteContraria']}
                >
                  <input
                    id="parteContraria"
                    name="parteContraria"
                    className="campo-entrada"
                    defaultValue={valores.parteContraria}
                  />
                </Campo>
              </div>
            </div>

            <div className="flex flex-col gap-0 sm:flex-row sm:gap-3.5">
              <div className="flex-1">
                <Campo nome="situacao" rotulo="Situação" erro={erros['situacao']}>
                  <select
                    id="situacao"
                    name="situacao"
                    className="campo-entrada"
                    defaultValue={valores.situacao}
                  >
                    {Object.values(SituacaoCaso).map((situacao) => (
                      <option key={situacao} value={situacao}>
                        {ROTULO_DA_SITUACAO[situacao]}
                      </option>
                    ))}
                  </select>
                </Campo>
              </div>
              <div className="flex-1">
                <Campo
                  nome="responsavelId"
                  rotulo="Responsável"
                  erro={erros['responsavelId']}
                >
                  <select
                    id="responsavelId"
                    name="responsavelId"
                    className="campo-entrada"
                    defaultValue={valores.responsavelId}
                  >
                    <option value="">Sem responsável definido</option>
                    {responsaveis.map((pessoa) => (
                      <option key={pessoa.id} value={pessoa.id}>
                        {pessoa.nome}
                      </option>
                    ))}
                  </select>
                </Campo>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <BotaoSalvar rotulo={rotuloDoBotao} />
              <Link href={hrefCancelar} className="botao botao-secundario">
                Cancelar
              </Link>
            </div>
          </div>
        </div>

        <div className="aviso aviso-atencao self-start">
          <span aria-hidden="true">▲</span>
          <div>
            <b>Lançamento é manual.</b> A captura automática de movimentações nos
            tribunais está expressamente fora deste contrato — Anexo II, item 1.c — e é
            uma das frentes da fase futura.
          </div>
        </div>
      </div>
    </form>
  )
}
