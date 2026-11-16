/**
 * Minuta da peça a partir da publicação — o passo que faltava da esteira de
 * acompanhamento (escopo aprovado em 05/11/2026), com os agentes por área que
 * o escritório mandou em 16/11/2026 (`src/agentes/`, `src/lib/agentes.ts`).
 *
 * Decisões do escritório, 16/11/2026:
 *  - os dados pessoais das petições de exemplo saem antes de ir à IA ("faça
 *    você mesmo") — `modelo.txt` já está anonimizado;
 *  - a pesquisa de jurisprudência na web fica ligada, mesmo custando mais;
 *  - a minuta só é gerada quando alguém clica no botão.
 *
 * É rascunho para a equipe revisar. Nada disto vai ao cliente nem ao tribunal
 * pelo portal; quem protocola é o advogado, fora daqui. Regra 10 continua de
 * pé: o texto jurídico DO ESCRITÓRIO (contrato, procuração, declaração) não é
 * tocado por isto — a minuta é peça nova, redigida pelo agente que o próprio
 * escritório escreveu, e sai marcada como sugestão da IA.
 *
 * O que vai à IA: as instruções do agente, a petição de referência sem dados
 * pessoais, o inteiro teor da publicação (que já é público, no DJEN) e do
 * caso só o que a peça precisa — assunto, número, vara, parte contrária e o
 * nome do cliente. Nada de CPF, RG, endereço ou contato.
 */

import { AcaoAuditoria, type AreaDoCaso, type Prisma } from '@prisma/client'

import { lerAgente, type Agente } from '@/lib/agentes'
import { ROTULO_DA_AREA, lerArea } from '@/lib/areas'
import type { AnaliseDaPublicacao } from '@/lib/analise-da-publicacao'
import { lerAnalise } from '@/lib/analise-da-publicacao'
import { registrarAuditoria } from '@/lib/auditoria'
import { exigirEquipe, type SessaoServidor } from '@/lib/autorizacao'
import { diaEmSaoPaulo } from '@/lib/datas'
import { formatarNumeroDeProcesso } from '@/lib/formatos'
import { iaConfigurada, pedirTexto, type FonteDaWeb } from '@/lib/ia'
import { prisma } from '@/lib/prisma'

/** A linha que separa a peça da nota de revisão na resposta do agente. */
export const MARCA_DA_NOTA = '=== NOTA DE REVISÃO ==='

/** Pedido parado há mais que isto é tratado como perdido (servidor reiniciou no meio). */
export const MINUTA_TRAVADA_MS = 20 * 60_000

/** Teto do inteiro teor enviado — o mesmo da análise. */
const LIMITE_DO_TEXTO = 60_000

export type DadosDaMinuta = {
  area: AreaDoCaso
  hoje: string
  pesquisaNaWeb: boolean
  publicacao: {
    siglaTribunal: string
    orgao: string | null
    classe: string | null
    tipoComunicacao: string | null
    tipoDocumento: string | null
    numeroProcesso: string
    disponibilizacao: string
    texto: string
  }
  caso: {
    assunto: string
    numeroProcesso: string | null
    vara: string | null
    parteContraria: string | null
    cliente: string
  } | null
  analise: AnaliseDaPublicacao | null
}

/** O "sistema" e a mensagem da minuta. Puro — exportado para teste. */
export function montarPedidoDaMinuta(agente: Agente, dados: DadosDaMinuta): { sistema: string; usuario: string } {
  const sistema = [
    agente.instrucoes,
    '',
    'CONTEXTO DESTA EXECUÇÃO',
    'Você está dentro do Portal do Cliente do escritório, chamado pela fila de conferência de publicações do DJEN.',
    'Você não tem acesso aos autos além do texto da publicação e dos dados do caso abaixo, nem a documentos do cliente.',
    dados.pesquisaNaWeb
      ? 'Há busca e leitura de páginas na web disponíveis: use-as para a pesquisa de legislação e precedentes, e registre na nota o estado real de leitura de cada fonte.'
      : 'Não há navegação nesta execução: declare a pesquisa de precedentes como pendente, conforme suas instruções.',
    `Data de hoje (America/Sao_Paulo): ${dados.hoje}.`,
  ].join('\n')

  const p = dados.publicacao
  const linhasDoCaso =
    dados.caso === null
      ? ['Caso: a publicação não está ligada a um caso do portal.']
      : [
          `Cliente do escritório: ${dados.caso.cliente}`,
          `Assunto do caso: ${dados.caso.assunto}`,
          `Número do processo no cadastro: ${dados.caso.numeroProcesso === null ? '—' : formatarNumeroDeProcesso(dados.caso.numeroProcesso)}`,
          `Vara: ${dados.caso.vara ?? '—'}`,
          `Parte contrária: ${dados.caso.parteContraria ?? '—'}`,
        ]
  const linhasDaAnalise =
    dados.analise === null
      ? []
      : [
          '',
          'TRIAGEM JÁ FEITA PELA IA DA FILA (sugestão, confira contra o texto):',
          `Resumo: ${dados.analise.resumo}`,
          `Providência: ${dados.analise.providencia}`,
          `Prazo: ${dados.analise.prazoEmDias === null ? 'não identificado' : `${dados.analise.prazoEmDias} dia(s) ${dados.analise.contagem === 'corridos' ? 'corridos' : 'úteis'}`}`,
        ]

  const usuario = [
    `ÁREA: ${ROTULO_DA_AREA[dados.area]}`,
    '',
    'PEDIDO',
    'Prepare a minuta da peça cabível em resposta a esta publicação, pronta para a revisão do advogado.',
    'Se nenhuma peça for cabível (ciência pura, ato que não exige manifestação), não redija peça: explique isso na nota.',
    'Qualifique a parte representada como "já qualificada nos autos". Use marcadores entre colchetes para todo dado que você não tem — não invente número, data, valor, nome ou precedente.',
    `Escreva primeiro a minuta. Depois, numa linha sozinha, escreva exatamente ${MARCA_DA_NOTA} e, abaixo dela, a nota de revisão separada: pendências, decisões humanas, riscos, fontes efetivamente lidas e fontes apenas localizadas.`,
    'Texto simples, sem markdown: títulos em maiúsculas, parágrafos separados por linha em branco.',
    '',
    'CASO NO PORTAL',
    ...linhasDoCaso,
    '',
    'PUBLICAÇÃO (DJEN)',
    `Tribunal: ${p.siglaTribunal}`,
    `Órgão: ${p.orgao ?? '—'}`,
    `Classe: ${p.classe ?? '—'}`,
    `Tipo de comunicação: ${p.tipoComunicacao ?? '—'} / ${p.tipoDocumento ?? '—'}`,
    `Processo: ${formatarNumeroDeProcesso(p.numeroProcesso)}`,
    `Disponibilizada em: ${p.disponibilizacao}`,
    ...linhasDaAnalise,
    '',
    'Inteiro teor:',
    p.texto.slice(0, LIMITE_DO_TEXTO),
    '',
    'PETIÇÃO DE REFERÊNCIA DO ESCRITÓRIO NESTA ÁREA',
    'É uma peça real do escritório, com os dados pessoais trocados por marcadores entre colchetes. Use-a como referência de estrutura, tom e padrão de redação. Não copie dela fatos, valores, partes nem precedentes: o caso é outro.',
    '',
    agente.modelo,
  ].join('\n')

  return { sistema, usuario }
}

/** Separa a peça da nota. Sem a marca, tudo é minuta e a nota fica vazia. Exportado para teste. */
export function separarMinutaENota(texto: string): { minuta: string; nota: string | null } {
  const posicao = texto.indexOf(MARCA_DA_NOTA)
  if (posicao === -1) return { minuta: texto.trim(), nota: null }
  const nota = texto.slice(posicao + MARCA_DA_NOTA.length).trim()
  return { minuta: texto.slice(0, posicao).trim(), nota: nota === '' ? null : nota }
}

/** Lê as fontes gravadas (JSON) de volta, descartando o que não tiver formato. */
export function lerFontes(bruto: unknown): FonteDaWeb[] {
  if (!Array.isArray(bruto)) return []
  return bruto.flatMap((item) => {
    const fonte = typeof item === 'object' && item !== null ? (item as Record<string, unknown>) : null
    const url = fonte?.['url']
    const titulo = fonte?.['titulo']
    return typeof url === 'string' && typeof titulo === 'string' ? [{ url, titulo }] : []
  })
}

export function minutaEmAndamento(pedidaEm: Date | null, agora: Date = new Date()): boolean {
  return pedidaEm !== null && agora.getTime() - pedidaEm.getTime() < MINUTA_TRAVADA_MS
}

export type ResultadoDoPedidoDeMinuta =
  | { situacao: 'ok'; area: AreaDoCaso }
  | { situacao: 'ia_desligada' | 'nao_encontrada' | 'area_invalida' | 'em_andamento' }

/**
 * Marca a publicação como "minuta sendo gerada" e devolve a área. Quem chama
 * dispara `gerarMinuta` depois da resposta (`after()`), porque leva minutos.
 * A área vem do formulário, mas só vale se for uma das oito (regra 2).
 */
export async function pedirMinuta(
  sessao: SessaoServidor,
  publicacaoId: string,
  areaInformada: string,
  emailDoAutor: string | null,
): Promise<ResultadoDoPedidoDeMinuta> {
  exigirEquipe(sessao)
  if (!iaConfigurada()) return { situacao: 'ia_desligada' }
  const area = lerArea(areaInformada)
  if (area === null) return { situacao: 'area_invalida' }

  const publicacao = await prisma.publicacao.findUnique({
    where: { id: publicacaoId },
    select: { id: true, minutaPedidaEm: true },
  })
  if (publicacao === null) return { situacao: 'nao_encontrada' }
  if (minutaEmAndamento(publicacao.minutaPedidaEm)) return { situacao: 'em_andamento' }

  await prisma.$transaction(async (transacao) => {
    await transacao.publicacao.update({
      where: { id: publicacao.id },
      data: { minutaPedidaEm: new Date(), minutaPedidaPorId: sessao.usuarioId, minutaErro: null },
    })
    await registrarAuditoria(
      {
        usuarioId: sessao.usuarioId,
        usuarioEmail: emailDoAutor,
        acao: AcaoAuditoria.ATUALIZACAO,
        entidade: 'publicacao',
        entidadeId: publicacao.id,
        detalhes: { motivo: 'minuta_pedida', area },
      },
      transacao,
    )
  })
  return { situacao: 'ok', area }
}

/** Gera e grava a minuta. Sem sessão: roda depois da resposta de `pedirMinuta`. */
export async function gerarMinuta(publicacaoId: string, area: AreaDoCaso): Promise<void> {
  const publicacao = await prisma.publicacao.findUnique({
    where: { id: publicacaoId },
    include: {
      caso: {
        select: {
          assunto: true,
          numeroProcesso: true,
          vara: true,
          parteContraria: true,
          cliente: { select: { nome: true } },
        },
      },
    },
  })
  if (publicacao === null) return

  const falhar = async (erro: string) => {
    await prisma.publicacao.update({
      where: { id: publicacao.id },
      data: { minutaPedidaEm: null, minutaErro: erro },
    })
  }

  let agente: Agente
  try {
    agente = await lerAgente(area)
  } catch {
    await falhar('Não achei os arquivos do agente desta área no servidor.')
    return
  }

  const { sistema, usuario } = montarPedidoDaMinuta(agente, {
    area,
    hoje: diaEmSaoPaulo(new Date()),
    pesquisaNaWeb: true,
    publicacao: { ...publicacao, disponibilizacao: diaEmSaoPaulo(publicacao.disponibilizadaEm) },
    caso:
      publicacao.caso === null
        ? null
        : {
            assunto: publicacao.caso.assunto,
            numeroProcesso: publicacao.caso.numeroProcesso,
            vara: publicacao.caso.vara,
            parteContraria: publicacao.caso.parteContraria,
            cliente: publicacao.caso.cliente.nome,
          },
    analise: lerAnalise(publicacao.analise),
  })

  const resposta = await pedirTexto({ sistema, usuario, pesquisaNaWeb: true })
  if (!resposta.ok) {
    await falhar(resposta.erro)
    return
  }

  const { minuta, nota } = separarMinutaENota(resposta.texto)
  const notaFinal = resposta.pesquisou
    ? nota
    : [nota, 'Pesquisa de precedentes pendente: este provedor de IA não faz busca na web.'].filter(Boolean).join('\n\n')

  await prisma.$transaction(async (transacao) => {
    await transacao.publicacao.update({
      where: { id: publicacao.id },
      data: {
        minuta,
        minutaNota: notaFinal,
        minutaFontes: resposta.fontes as unknown as Prisma.InputJsonValue,
        minutaArea: area,
        minutaBuscas: resposta.buscas,
        minutaProvedor: resposta.provedor,
        minutaGeradaEm: new Date(),
        minutaPedidaEm: null,
        minutaErro: null,
      },
    })
    await registrarAuditoria(
      {
        usuarioId: publicacao.minutaPedidaPorId,
        usuarioEmail: null,
        acao: AcaoAuditoria.ATUALIZACAO,
        entidade: 'publicacao',
        entidadeId: publicacao.id,
        detalhes: { motivo: 'minuta_gerada', area, provedor: resposta.provedor, buscas: resposta.buscas },
      },
      transacao,
    )
  })
}
