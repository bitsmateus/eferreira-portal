'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import {
  NaturezaDoHonorarioPersonalizado,
  SituacaoCaso,
  TipoDeObjeto,
} from '@prisma/client'

import { ROTULO_DA_SITUACAO } from '@/componentes/situacoes'
import { formatarDocumento } from '@/lib/documento'
import { formatarNumeroDeProcesso } from '@/lib/formatos'
import { LINHAS_DE_PARCELA } from '@/lib/casos'
import {
  DICA_DA_DESCRICAO_DO_OBJETO,
  ROTULO_DA_NATUREZA_DO_PERSONALIZADO,
  ROTULO_DO_TIPO_DE_OBJETO,
} from '@/lib/rotulos-do-contrato'
import type { EstadoDoCaso } from './acoes'

export type ValoresDoCaso = {
  numeroProcesso: string
  assunto: string
  vara: string
  parteContraria: string
  situacao: string
  responsavelId: string
  honorarios: string
  percentualExito: string
  percentualProveitoEconomico: string
  referenciaDaEconomia: string
  prazoDePagamentoDaEconomia: string
  tipoDeObjeto: string
  descricaoDoObjeto: string
  honorariosPersonalizados: boolean
  personalizadoServicos: string
  personalizadoValorOuPercentual: string
  personalizadoBaseDeCalculo: string
  personalizadoCondicaoDeExigibilidade: string
  personalizadoPagamento: string
  personalizadoNatureza: string
  personalizadoRelacaoComAsDemais: string
  personalizadoCondicoesEspecificas: string
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
  percentualExito: '',
  percentualProveitoEconomico: '',
  referenciaDaEconomia: '',
  prazoDePagamentoDaEconomia: '',
  tipoDeObjeto: '',
  descricaoDoObjeto: '',
  honorariosPersonalizados: false,
  personalizadoServicos: '',
  personalizadoValorOuPercentual: '',
  personalizadoBaseDeCalculo: '',
  personalizadoCondicaoDeExigibilidade: '',
  personalizadoPagamento: '',
  personalizadoNatureza: '',
  personalizadoRelacaoComAsDemais: '',
  personalizadoCondicoesEspecificas: '',
  parcelas: [],
}

type Props = {
  acao: (estado: EstadoDoCaso, dados: FormData) => Promise<EstadoDoCaso>
  valores: ValoresDoCaso
  responsaveis: readonly { id: string; nome: string }[]
  rotuloDoBotao: string
  hrefCancelar: string
  /**
   * Os clientes a escolher, quando o caso nasce fora da ficha de alguém.
   *
   * Vindo da ficha do cliente, o dono já está decidido e este seletor não
   * aparece — perguntar de novo a quem acabou de abrir a ficha do cliente
   * seria só uma chance a mais de escolher errado.
   */
  clientes?: readonly { id: string; nome: string; documento: string }[]
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
  clientes,
}: Props) {
  const [estado, enviar] = useActionState(acao, undefined)
  const erros = estado?.erros ?? {}

  /** Só existe quando o caso nasce fora da ficha de um cliente. */
  const [clienteId, setClienteId] = useState('')

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
    percentualExito: valores.percentualExito,
    percentualProveitoEconomico: valores.percentualProveitoEconomico,
    referenciaDaEconomia: valores.referenciaDaEconomia,
    prazoDePagamentoDaEconomia: valores.prazoDePagamentoDaEconomia,
    tipoDeObjeto: valores.tipoDeObjeto,
    descricaoDoObjeto: valores.descricaoDoObjeto,
    personalizadoServicos: valores.personalizadoServicos,
    personalizadoValorOuPercentual: valores.personalizadoValorOuPercentual,
    personalizadoBaseDeCalculo: valores.personalizadoBaseDeCalculo,
    personalizadoCondicaoDeExigibilidade: valores.personalizadoCondicaoDeExigibilidade,
    personalizadoPagamento: valores.personalizadoPagamento,
    personalizadoNatureza: valores.personalizadoNatureza,
    personalizadoRelacaoComAsDemais: valores.personalizadoRelacaoComAsDemais,
    personalizadoCondicoesEspecificas: valores.personalizadoCondicoesEspecificas,
  })

  const [personalizado, setPersonalizado] = useState(valores.honorariosPersonalizados)

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

      {/*
        `min-w-0` nos dois filhos do grid — mesma armadilha do
        `min-height: auto` do flexbox, no eixo horizontal.
      */}
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="cartao min-w-0">
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
            {clientes !== undefined && (
              <Campo
                nome="clienteId"
                rotulo="Cliente"
                erro={erros['clienteId']}
                dica="Todo caso pertence a um cliente. Sem isso não há de quem seja o processo, nem para quem mostrar o andamento."
                obrigatorio
              >
                <select
                  id="clienteId"
                  name="clienteId"
                  required
                  className="campo-entrada"
                  value={clienteId}
                  onChange={(evento) => setClienteId(evento.target.value)}
                >
                  <option value="">Escolha o cliente…</option>
                  {clientes.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.nome} — {formatarDocumento(cliente.documento)}
                    </option>
                  ))}
                </select>
              </Campo>
            )}

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

            <h2 className="mb-1 text-[14px] font-semibold">Objeto do contrato</h2>
            <p className="mb-4 text-[12px] text-texto-2">
              Escolha a variação da cláusula de objeto que vale para este caso. O
              texto de cada uma é o do escritório; o que você escreve na descrição
              entra no contrato no lugar indicado. Sem isso o contrato não é gerado.
            </p>

            <Campo
              nome="tipoDeObjeto"
              rotulo="Tipo de objeto"
              erro={erros['tipoDeObjeto']}
            >
              <select
                id="tipoDeObjeto"
                name="tipoDeObjeto"
                className="campo-entrada"
                value={campos.tipoDeObjeto}
                onChange={(evento) => definir('tipoDeObjeto', evento.target.value)}
              >
                <option value="">Escolha…</option>
                {Object.values(TipoDeObjeto).map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {ROTULO_DO_TIPO_DE_OBJETO[tipo]}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo
              nome="descricaoDoObjeto"
              rotulo="Descrição do objeto"
              erro={erros['descricaoDoObjeto']}
              dica={
                campos.tipoDeObjeto === ''
                  ? 'Escolha o tipo acima para ver o que descrever.'
                  : DICA_DA_DESCRICAO_DO_OBJETO[campos.tipoDeObjeto as TipoDeObjeto]
              }
            >
              <textarea
                id="descricaoDoObjeto"
                name="descricaoDoObjeto"
                rows={4}
                className="campo-entrada"
                value={campos.descricaoDoObjeto}
                onChange={(evento) => definir('descricaoDoObjeto', evento.target.value)}
              />
            </Campo>

            <div className="my-[22px] border-t border-borda" />

            <h2 className="mb-1 text-[14px] font-semibold">Honorários</h2>
            <p className="mb-4 text-[12px] text-texto-2">
              Usados para escrever a cláusula de honorários do contrato. As quatro
              modalidades abaixo podem ser combinadas no mesmo caso — pode ter só uma,
              duas ou mais, conforme o que foi combinado com o cliente. Ao menos uma
              é necessária para gerar o contrato.
            </p>

            <Campo
              nome="honorarios"
              rotulo="Honorários fixos — valor total"
              erro={erros['honorarios']}
              dica="Como no contrato: 1.750,00. Informe as parcelas abaixo — se for à vista, uma parcela única com o vencimento."
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

            <div className="flex flex-col gap-0 sm:flex-row sm:gap-3.5">
              <div className="flex-1">
                <Campo
                  nome="percentualExito"
                  rotulo="Honorários de êxito (%)"
                  erro={erros['percentualExito']}
                  dica="De 10 a 30. Só devido ao final, sem entrada."
                >
                  <input
                    id="percentualExito"
                    name="percentualExito"
                    inputMode="numeric"
                    className="campo-entrada mono"
                    placeholder="20"
                    value={campos.percentualExito}
                    onChange={(evento) => definir('percentualExito', evento.target.value)}
                  />
                </Campo>
              </div>
              <div className="flex-1">
                <Campo
                  nome="percentualProveitoEconomico"
                  rotulo="Sobre o proveito econômico (%)"
                  erro={erros['percentualProveitoEconomico']}
                  dica="De 10 a 30, sobre o proveito obtido pelo cliente."
                >
                  <input
                    id="percentualProveitoEconomico"
                    name="percentualProveitoEconomico"
                    inputMode="numeric"
                    className="campo-entrada mono"
                    placeholder="20"
                    value={campos.percentualProveitoEconomico}
                    onChange={(evento) =>
                      definir('percentualProveitoEconomico', evento.target.value)
                    }
                  />
                </Campo>
              </div>
            </div>

            {campos.percentualProveitoEconomico !== '' && (
              <div className="mb-[15px] rounded-md border border-borda p-3.5">
                <p className="mb-3 text-[12px] text-texto-2">
                  Proveito econômico: o contrato pede também a referência usada na
                  apuração e o prazo de pagamento.
                </p>
                <Campo
                  nome="referenciaDaEconomia"
                  rotulo="Referência da economia"
                  erro={erros['referenciaDaEconomia']}
                  dica={'Identifique a obrigação, o valor discutido e a data-base. No contrato: "será considerada a seguinte referência: [este texto], comparando-se os valores…".'}
                >
                  <textarea
                    id="referenciaDaEconomia"
                    name="referenciaDaEconomia"
                    rows={3}
                    className="campo-entrada"
                    value={campos.referenciaDaEconomia}
                    onChange={(evento) =>
                      definir('referenciaDaEconomia', evento.target.value)
                    }
                  />
                </Campo>
                <Campo
                  nome="prazoDePagamentoDaEconomia"
                  rotulo="Prazo de pagamento (dias)"
                  erro={erros['prazoDePagamentoDaEconomia']}
                  dica="Dias depois da consolidação e da apuração da economia."
                >
                  <input
                    id="prazoDePagamentoDaEconomia"
                    name="prazoDePagamentoDaEconomia"
                    inputMode="numeric"
                    className="campo-entrada mono"
                    placeholder="30"
                    value={campos.prazoDePagamentoDaEconomia}
                    onChange={(evento) =>
                      definir('prazoDePagamentoDaEconomia', evento.target.value)
                    }
                  />
                </Campo>
              </div>
            )}

            <label className="mb-[15px] flex items-center gap-2.5 text-[13px]">
              <input
                type="checkbox"
                name="honorariosPersonalizados"
                checked={personalizado}
                onChange={(evento) => setPersonalizado(evento.target.checked)}
              />
              <span>Honorários personalizados</span>
            </label>

            {personalizado && (
              <div className="mb-[15px] rounded-md border border-borda p-3.5">
                <p className="mb-3 text-[12px] text-texto-2">
                  Cada campo entra no contrato no lugar indicado pelo modelo do
                  escritório. Todos são necessários para gerar o contrato.
                </p>
                <Campo
                  nome="personalizadoServicos"
                  rotulo="Serviços ou etapas"
                  erro={erros['personalizadoServicos']}
                  dica={'No contrato: "Pela prestação de [este texto], o CONTRATANTE pagará…". Escreva já no jeito que a frase pede, por exemplo "serviços de elaboração de parecer".'}
                >
                  <textarea
                    id="personalizadoServicos"
                    name="personalizadoServicos"
                    rows={2}
                    className="campo-entrada"
                    value={campos.personalizadoServicos}
                    onChange={(evento) =>
                      definir('personalizadoServicos', evento.target.value)
                    }
                  />
                </Campo>
                <Campo
                  nome="personalizadoValorOuPercentual"
                  rotulo="Valor ou percentual"
                  erro={erros['personalizadoValorOuPercentual']}
                  dica={'No contrato: "honorários correspondentes a [este texto]".'}
                >
                  <input
                    id="personalizadoValorOuPercentual"
                    name="personalizadoValorOuPercentual"
                    className="campo-entrada"
                    value={campos.personalizadoValorOuPercentual}
                    onChange={(evento) =>
                      definir('personalizadoValorOuPercentual', evento.target.value)
                    }
                  />
                </Campo>
                <Campo
                  nome="personalizadoBaseDeCalculo"
                  rotulo="Base de cálculo"
                  erro={erros['personalizadoBaseDeCalculo']}
                  dica={'No contrato: "calculados sobre [este texto]". Se não houver base, escreva "não se aplica".'}
                >
                  <input
                    id="personalizadoBaseDeCalculo"
                    name="personalizadoBaseDeCalculo"
                    className="campo-entrada"
                    value={campos.personalizadoBaseDeCalculo}
                    onChange={(evento) =>
                      definir('personalizadoBaseDeCalculo', evento.target.value)
                    }
                  />
                </Campo>
                <Campo
                  nome="personalizadoCondicaoDeExigibilidade"
                  rotulo="Condição de exigibilidade"
                  erro={erros['personalizadoCondicaoDeExigibilidade']}
                  dica={'No contrato: "exigíveis mediante [este texto]".'}
                >
                  <input
                    id="personalizadoCondicaoDeExigibilidade"
                    name="personalizadoCondicaoDeExigibilidade"
                    className="campo-entrada"
                    value={campos.personalizadoCondicaoDeExigibilidade}
                    onChange={(evento) =>
                      definir('personalizadoCondicaoDeExigibilidade', evento.target.value)
                    }
                  />
                </Campo>
                <Campo
                  nome="personalizadoPagamento"
                  rotulo="Forma de pagamento e vencimentos"
                  erro={erros['personalizadoPagamento']}
                  dica={'No contrato: "com pagamento [este texto]".'}
                >
                  <input
                    id="personalizadoPagamento"
                    name="personalizadoPagamento"
                    className="campo-entrada"
                    value={campos.personalizadoPagamento}
                    onChange={(evento) =>
                      definir('personalizadoPagamento', evento.target.value)
                    }
                  />
                </Campo>
                <Campo
                  nome="personalizadoNatureza"
                  rotulo="Natureza da remuneração"
                  erro={erros['personalizadoNatureza']}
                >
                  <select
                    id="personalizadoNatureza"
                    name="personalizadoNatureza"
                    className="campo-entrada"
                    value={campos.personalizadoNatureza}
                    onChange={(evento) =>
                      definir('personalizadoNatureza', evento.target.value)
                    }
                  >
                    <option value="">Escolha…</option>
                    {Object.values(NaturezaDoHonorarioPersonalizado).map((natureza) => (
                      <option key={natureza} value={natureza}>
                        {ROTULO_DA_NATUREZA_DO_PERSONALIZADO[natureza]}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo
                  nome="personalizadoRelacaoComAsDemais"
                  rotulo="Em relação a"
                  erro={erros['personalizadoRelacaoComAsDemais']}
                  dica={'No contrato: "Esta remuneração será [natureza] em relação a [este texto]". Identifique as demais modalidades, ou indique contratação isolada.'}
                >
                  <input
                    id="personalizadoRelacaoComAsDemais"
                    name="personalizadoRelacaoComAsDemais"
                    className="campo-entrada"
                    value={campos.personalizadoRelacaoComAsDemais}
                    onChange={(evento) =>
                      definir('personalizadoRelacaoComAsDemais', evento.target.value)
                    }
                  />
                </Campo>
                <Campo
                  nome="personalizadoCondicoesEspecificas"
                  rotulo="Condições específicas"
                  erro={erros['personalizadoCondicoesEspecificas']}
                  dica={'No contrato: "observadas as seguintes condições específicas: [este texto]." Inclua eventuais abatimentos.'}
                >
                  <textarea
                    id="personalizadoCondicoesEspecificas"
                    name="personalizadoCondicoesEspecificas"
                    rows={2}
                    className="campo-entrada"
                    value={campos.personalizadoCondicoesEspecificas}
                    onChange={(evento) =>
                      definir('personalizadoCondicoesEspecificas', evento.target.value)
                    }
                  />
                </Campo>
              </div>
            )}

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

        <div className="aviso aviso-atencao min-w-0 self-start">
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
