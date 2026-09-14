/**
 * A consulta por CPF ou CNPJ — o coração do Anexo I, 3.b: "endpoints de
 * consulta por CPF ou CNPJ, com retorno do número do processo e do andamento".
 *
 * A forma da resposta segue o protótipo (tela "API do escritório"), com dois
 * acréscimos: `id`, para que o integrador consiga escrever de volta sem ter de
 * adivinhar identificadores, e o histórico sob demanda.
 *
 * Regra 2: a consulta passa por `filtroDeClientes` como qualquer outra. A
 * credencial vale como sessão de operador, não como passe livre.
 * Regra 11: `data` é dia civil em São Paulo; `criadoEm` é instante em UTC.
 */

import { TipoPessoa, type SituacaoCaso } from '@prisma/client'

import { filtroDeClientes, type SessaoServidor } from '@/lib/autorizacao'
import { prisma } from '@/lib/prisma'
import { diaEmSaoPaulo } from '@/lib/datas'
import { formatarDocumento, normalizarDocumento } from '@/lib/documento'
import { formatarNumeroDeProcesso } from '@/lib/formatos'
import { ROTULO_DA_SITUACAO } from '@/lib/situacao-do-caso'

export type AndamentoNaApi = {
  data: string
  status: string | null
  descricao: string
}

export type CasoNaApi = {
  id: string
  processo: string | null
  assunto: string
  vara: string | null
  /** Valor estável, para o integrador programar contra: EM_ANDAMENTO ou ARQUIVADO. */
  situacao: SituacaoCaso
  /** O mesmo, escrito para gente ler: "Em andamento". */
  situacaoRotulo: string
  /** O mais recente. Nulo quando o caso ainda não teve andamento. */
  andamento: AndamentoNaApi | null
  /** Só vem com `?historico=true`. */
  historico?: AndamentoNaApi[]
}

export type RespostaDaConsulta = {
  cliente: {
    id: string
    nome: string
    documento: string
    documentoFormatado: string
    tipoPessoa: 'FISICA' | 'JURIDICA'
    contratoAssinadoEm: string | null
  }
  casos: CasoNaApi[]
}

function comoAndamento(andamento: {
  data: Date
  descricao: string
  status: { nome: string } | null
}): AndamentoNaApi {
  return {
    data: diaEmSaoPaulo(andamento.data),
    status: andamento.status?.nome ?? null,
    descricao: andamento.descricao,
  }
}

export async function consultarPorDocumento(
  sessao: SessaoServidor,
  documentoBruto: string,
  comHistorico: boolean,
): Promise<RespostaDaConsulta | null> {
  const documento = normalizarDocumento(documentoBruto)

  const cliente = await prisma.cliente.findFirst({
    where: filtroDeClientes(sessao, { documento }),
    select: {
      id: true,
      nome: true,
      documento: true,
      tipoPessoa: true,
      contratoAssinadoEm: true,
      casos: {
        select: {
          id: true,
          numeroProcesso: true,
          assunto: true,
          vara: true,
          situacao: true,
          andamentos: {
            select: {
              data: true,
              descricao: true,
              status: { select: { nome: true } },
            },
            orderBy: [{ data: 'desc' }, { criadoEm: 'desc' }],
          },
        },
        orderBy: [{ situacao: 'asc' }, { criadoEm: 'desc' }],
      },
    },
  })

  if (cliente === null) return null

  return {
    cliente: {
      id: cliente.id,
      nome: cliente.nome,
      documento: cliente.documento,
      documentoFormatado: formatarDocumento(cliente.documento),
      tipoPessoa: cliente.tipoPessoa === TipoPessoa.FISICA ? 'FISICA' : 'JURIDICA',
      contratoAssinadoEm:
        cliente.contratoAssinadoEm === null
          ? null
          : diaEmSaoPaulo(cliente.contratoAssinadoEm),
    },
    casos: cliente.casos.map((caso) => {
      const ultimo = caso.andamentos[0]

      return {
        id: caso.id,
        processo:
          caso.numeroProcesso === null
            ? null
            : formatarNumeroDeProcesso(caso.numeroProcesso),
        assunto: caso.assunto,
        vara: caso.vara,
        situacao: caso.situacao,
        situacaoRotulo: ROTULO_DA_SITUACAO[caso.situacao],
        andamento: ultimo === undefined ? null : comoAndamento(ultimo),
        ...(comHistorico
          ? { historico: caso.andamentos.map(comoAndamento) }
          : {}),
      }
    }),
  }
}
