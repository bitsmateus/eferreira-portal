'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { SituacaoCaso } from '@prisma/client'

import { ROTULO_DA_SITUACAO } from '@/componentes/situacoes'
import { formatarNumeroDeProcesso } from '@/lib/formatos'
import { LINHAS_DE_PARCELA } from '@/lib/casos'
import type { EstadoDoCaso } from './acoes'

export type ValoresDoCaso = {
  numeroProcesso: string
  assunto: string
  vara: string
  parteContraria: string
  situacao: string
  responsavelId: string
  honorarios: string
  parcelas: readonly { valor: string; vencimento: string }[]
}

export const VALORES_VAZIOS: ValoresDoCaso = {
  numeroProcesso: '',
  assunto: '',
  vara: '',
  parteContraria: '',
  situacao: SituacaoCaso.EM_ANDAMENTO,
  responsavelId: '',
  honorarios: '',
  parcelas: [],
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
  obrigatorio = false,
}: {
  nome: string
  rotulo: string
  children: React.ReactNode
  erro?: string
  dica?: string
  obrigatorio?: boolean
}) {
  return (
    <div className="mb-[15px]">
      <label className="campo-rotulo" htmlFor={nome}>
        {rotulo}
        {obrigatorio && (
          <>
            <span aria-hidden="true" className="text-erro">
              {' *'}
            </span>
            <span className="sr-only"> (obrigatório)</span>
          </>
        )}
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

type Parcela = { valor: string; vencimento: string }

export function FormularioDeCaso({
  acao,
  valores,
  responsaveis,
  rotuloDoBotao,
  hrefCancelar,
}: Props) {
  const [estado, enviar] = useActionState(acao, undefined)
  const erros = estado?.erros ?? {}

  /**
   * TODO CAMPO É CONTROLADO, PELO MESMO MOTIVO DO CADASTRO DE CLIENTE.
   *
   * Com `defaultValue`, o React reiniciava o formulário ao fim da ação e a
   * recusa apagava tudo. Aqui doía ainda mais: a regra que mais recusa é a da
   * soma das parcelas, que só aparece DEPOIS de preencher honorários e
   * parcelas — ou seja, o operador perdia justamente a parte mais trabalhosa
   * do formulário por causa de um arredondamento.
   */
  const [campos, setCampos] = useState({
    numeroProcesso: formatarNumeroDeProcesso(valores.numeroProcesso),
    assunto: valores.assunto,
    vara: valores.vara,
    parteContraria: valores.parteContraria,
    situacao: valores.situacao,
    responsavelId: valores.responsavelId,
    honorarios: valores.honorarios,
  })

  // Linhas fixas em vez de "adicionar parcela": sem JavaScript extra, e o
  // contrato do escritorio nunca passou de tres parcelas.
  const [parcelas, setParcelas] = useState<Parcela[]>(
    Array.from({ length: LINHAS_DE_PARCELA }, (_, i) => ({
      valor: valores.parcelas[i]?.valor ?? '',
      vencimento: valores.parcelas[i]?.vencimento ?? '',
    })),
  )

  function definir<C extends keyof typeof campos>(nome: C, valor: string): void {
    setCampos((atual) => ({ ...atual, [nome]: valor }))
  }

  function definirParcela(indice: number, chave: keyof Parcela, valor: string): void {
    setParcelas((atual) =>
      atual.map((linha, i) => (i === indice ? { ...linha, [chave]: valor } : linha)),
    )
  }

  const quantosErros = Object.keys(erros).length

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

      {quantosErros > 0 && (
        <div className="aviso aviso-atencao mb-4" role="alert">
          <span aria-hidden="true">▲</span>
          <div>
            <b>
              {quantosErros === 1
                ? 'Falta acertar 1 campo.'
                : `Faltam acertar ${quantosErros} campos.`}
            </b>{' '}
            Nada do que você digitou foi perdido — corrija o que está marcado em
            vermelho e salve de novo.
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="cartao">
          <div className="cartao-cabecalho">
            <h2>Dados do caso</h2>
            <span className="ml-auto text-[11.5px] text-texto-3">
              <span aria-hidden="true" className="text-erro">
                *
              </span>{' '}
              obrigatório
            </span>
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
                value={campos.numeroProcesso}
                onChange={(evento) => definir('numeroProcesso', evento.target.value)}
                onBlur={() =>
                  setCampos((atual) => ({
                    ...atual,
                    numeroProcesso: formatarNumeroDeProcesso(atual.numeroProcesso),
                  }))
                }
              />
            </Campo>

            <Campo
              nome="assunto"
              rotulo="Assunto"
              erro={erros['assunto']}
              obrigatorio
            >
              <input
                id="assunto"
                name="assunto"
                required
                className="campo-entrada"
                placeholder="Ação de cobrança"
                value={campos.assunto}
                onChange={(evento) => definir('assunto', evento.target.value)}
              />
            </Campo>

            <div className="flex flex-col gap-0 sm:flex-row sm:gap-3.5">
              <div className="flex-1">
                <Campo nome="vara" rotulo="Vara / Foro" erro={erros['vara']}>
                  <input
                    id="vara"
                    name="vara"
                    className="campo-entrada"
                    value={campos.vara}
                    onChange={(evento) => definir('vara', evento.target.value)}
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
                    value={campos.parteContraria}
                    onChange={(evento) => definir('parteContraria', evento.target.value)}
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
                    value={campos.situacao}
                    onChange={(evento) => definir('situacao', evento.target.value)}
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
                    value={campos.responsavelId}
                    onChange={(evento) => definir('responsavelId', evento.target.value)}
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

            <div className="my-[22px] border-t border-borda" />

            <h2 className="mb-1 text-[14px] font-semibold">Honorários</h2>
            <p className="mb-4 text-[12px] text-texto-2">
              Usados para escrever a cláusula 2ª do contrato. Pode ficar em branco e
              ser preenchido depois.
            </p>

            <Campo
              nome="honorarios"
              rotulo="Valor total"
              erro={erros['honorarios']}
              dica="Como no contrato: 1.750,00"
            >
              <input
                id="honorarios"
                name="honorarios"
                inputMode="decimal"
                className="campo-entrada mono"
                placeholder="0,00"
                value={campos.honorarios}
                onChange={(evento) => definir('honorarios', evento.target.value)}
              />
            </Campo>

            <div className="mb-[15px]">
              <span className="campo-rotulo">Parcelas</span>
              <div className="rolagem-lateral">
                <table className="tabela">
                  <thead>
                    <tr>
                      <th className="w-10">#</th>
                      <th>Valor</th>
                      <th>Vencimento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parcelas.map((linha, indice) => (
                      <tr key={indice}>
                        <td className="mono text-texto-3">{indice + 1}</td>
                        <td>
                          <input
                            name={`parcela-${indice}-valor`}
                            inputMode="decimal"
                            aria-label={`Valor da parcela ${indice + 1}`}
                            className="campo-entrada mono"
                            placeholder="0,00"
                            value={linha.valor}
                            onChange={(evento) =>
                              definirParcela(indice, 'valor', evento.target.value)
                            }
                          />
                          {erros[`parcelas.${indice}.valor`] !== undefined && (
                            <p className="dica dica-erro" role="alert">
                              {erros[`parcelas.${indice}.valor`]}
                            </p>
                          )}
                        </td>
                        <td>
                          <input
                            name={`parcela-${indice}-vencimento`}
                            type="date"
                            aria-label={`Vencimento da parcela ${indice + 1}`}
                            className="campo-entrada mono"
                            value={linha.vencimento}
                            onChange={(evento) =>
                              definirParcela(indice, 'vencimento', evento.target.value)
                            }
                          />
                          {erros[`parcelas.${indice}.vencimento`] !== undefined && (
                            <p className="dica dica-erro" role="alert">
                              {erros[`parcelas.${indice}.vencimento`]}
                            </p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="dica">
                Deixe em branco as que não usar. A soma precisa bater com o valor
                total.
              </p>
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
