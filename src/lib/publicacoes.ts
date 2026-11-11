/**
 * Publicações do DJEN e a fila de conferência — esteira de acompanhamento
 * (09/11/2026). Frente contratada à parte: ver o comentário do modelo
 * `Publicacao` em `prisma/schema.prisma` e `docs/publicacoes.md`.
 *
 * O fluxo, em três tempos:
 *
 *  1. `executarConsulta` (rotina diária ou botão "Consultar agora"): busca no
 *     DJEN as comunicações das OABs dos advogados ATIVOS, grava as novas e
 *     liga cada uma ao caso pelo número do processo. A janela se sobrepõe de
 *     propósito; o `idDjen` único impede duplicar.
 *  2. `analisarPendentes`: a IA trata cada publicação nova (quando
 *     configurada) e o portal calcula o prazo sugerido.
 *  3. `conferirPublicacao`: a equipe confirma — cria a tarefa (evento do caso,
 *     que vai para a Google Agenda) e, se quiser, lança o andamento que o
 *     cliente lê. Nada chega ao cliente sem este passo.
 *
 * As funções de tela começam com `exigirEquipe`: nenhuma aceita sessão de
 * perfil CLIENTE. As da rotina não têm sessão — quem as chama é o servidor —,
 * e por isso a auditoria delas sai com `usuarioId` nulo.
 */

import { AcaoAuditoria, Prisma, SituacaoDaPublicacao } from '@prisma/client'

import {
  INSTRUCOES_DO_SISTEMA,
  ESQUEMA_DA_ANALISE,
  lerAnalise,
  mensagemDoUsuario,
  prazoSugerido,
  type AnaliseDaPublicacao,
} from '@/lib/analise-da-publicacao'
import { lancarAndamento, type DadosDeAndamento } from '@/lib/andamentos'
import { registrarAuditoria } from '@/lib/auditoria'
import { exigirEquipe, filtroDeCasos, type SessaoServidor } from '@/lib/autorizacao'
import { diaCivilParaData, diaEmSaoPaulo } from '@/lib/datas'
import { consultarPorOab, type ComunicacaoDoDjen } from '@/lib/djen'
import { enviarEmail } from '@/lib/email'
import { criarEvento, type DadosDeEvento } from '@/lib/eventos'
import { formatarNumeroDeProcesso, somenteDigitos } from '@/lib/formatos'
import { iaConfigurada, pedirObjeto } from '@/lib/ia'
import { somarDias } from '@/lib/prazos'
import { prisma } from '@/lib/prisma'

/** Dias consultados a cada rodada, contando hoje. Sobrepõe a rodada anterior. */
export const JANELA_EM_DIAS = 5
/** Teto de análises por rodada: o resto fica para a próxima. */
export const ANALISES_POR_RODADA = 25

// ---------------------------------------------------------------------------
// 1. Consulta ao DJEN
// ---------------------------------------------------------------------------

export function chaveDaOab(numero: string, uf: string): string {
  return `${uf.trim().toUpperCase()}${somenteDigitos(numero)}`
}

/**
 * Junta o resultado das várias OABs: a mesma comunicação aparece uma vez,
 * com todas as OABs do escritório em que saiu. Exportado para teste.
 */
export function juntarPorComunicacao(
  porOab: ReadonlyArray<{ oab: string; itens: readonly ComunicacaoDoDjen[] }>,
): Map<string, { comunicacao: ComunicacaoDoDjen; oabs: string[] }> {
  const juntas = new Map<string, { comunicacao: ComunicacaoDoDjen; oabs: string[] }>()
  for (const { oab, itens } of porOab) {
    for (const comunicacao of itens) {
      const existente = juntas.get(comunicacao.idDjen)
      if (existente === undefined) {
        juntas.set(comunicacao.idDjen, { comunicacao, oabs: [oab] })
      } else if (!existente.oabs.includes(oab)) {
        existente.oabs.push(oab)
      }
    }
  }
  return juntas
}

export type ResumoDaConsulta = {
  consultaId: string
  inicio: string
  fim: string
  encontradas: number
  novas: number
  erros: string[]
}

export async function executarConsulta(
  opcoes: { dias?: number; hoje?: string; disparadaPorId?: string | null } = {},
): Promise<ResumoDaConsulta> {
  const dias = Math.min(Math.max(Math.trunc(opcoes.dias ?? JANELA_EM_DIAS), 1), 60)
  const fim = opcoes.hoje ?? diaEmSaoPaulo(new Date())
  const inicio = somarDias(fim, -(dias - 1))

  const consulta = await prisma.consultaDePublicacoes.create({
    data: { inicioDaJanela: inicio, fimDaJanela: fim, disparadaPorId: opcoes.disparadaPorId ?? null },
    select: { id: true },
  })

  const advogados = await prisma.advogado.findMany({
    where: { ativo: true },
    select: { oab: true, oabUf: true },
  })
  const oabs = [...new Map(advogados.map((a) => [chaveDaOab(a.oab, a.oabUf), a])).entries()]

  const erros: string[] = []
  if (oabs.length === 0) erros.push('Nenhum advogado ativo com OAB cadastrada.')

  const porOab: { oab: string; itens: ComunicacaoDoDjen[] }[] = []
  for (const [chave, advogado] of oabs) {
    const resultado = await consultarPorOab({ numero: advogado.oab, uf: advogado.oabUf }, inicio, fim)
    if (resultado.ok) porOab.push({ oab: chave, itens: resultado.itens })
    else erros.push(resultado.erro)
  }

  const juntas = juntarPorComunicacao(porOab)
  const novas = await gravarNovas([...juntas.values()])
  await avisarResponsaveis(novas)

  await prisma.consultaDePublicacoes.update({
    where: { id: consulta.id },
    data: {
      terminadaEm: new Date(),
      encontradas: juntas.size,
      novas: novas.length,
      erro: erros.length === 0 ? null : erros.join('\n'),
    },
  })

  return { consultaId: consulta.id, inicio, fim, encontradas: juntas.size, novas: novas.length, erros }
}

type PublicacaoNova = { id: string; casoId: string | null }

async function gravarNovas(
  juntas: ReadonlyArray<{ comunicacao: ComunicacaoDoDjen; oabs: string[] }>,
): Promise<PublicacaoNova[]> {
  if (juntas.length === 0) return []

  const jaGravadas = new Set(
    (
      await prisma.publicacao.findMany({
        where: { idDjen: { in: juntas.map((j) => j.comunicacao.idDjen) } },
        select: { idDjen: true },
      })
    ).map((p) => p.idDjen),
  )
  const aGravar = juntas.filter((j) => !jaGravadas.has(j.comunicacao.idDjen))
  if (aGravar.length === 0) return []

  const casos = await prisma.caso.findMany({
    where: { numeroProcesso: { in: [...new Set(aGravar.map((j) => j.comunicacao.numeroProcesso))] } },
    select: { id: true, numeroProcesso: true },
  })
  const casoDoProcesso = new Map(casos.map((c) => [c.numeroProcesso, c.id]))

  const novas: PublicacaoNova[] = []
  for (const { comunicacao, oabs } of aGravar) {
    const casoId = casoDoProcesso.get(comunicacao.numeroProcesso) ?? null
    const disponibilizadaEm = diaCivilParaData(comunicacao.disponibilizacao)
    if (disponibilizadaEm === null) continue

    try {
      const criada = await prisma.$transaction(async (transacao) => {
        const publicacao = await transacao.publicacao.create({
          data: {
            idDjen: comunicacao.idDjen,
            hashDjen: comunicacao.hash,
            disponibilizadaEm,
            siglaTribunal: comunicacao.siglaTribunal,
            orgao: comunicacao.orgao,
            tipoComunicacao: comunicacao.tipoComunicacao,
            tipoDocumento: comunicacao.tipoDocumento,
            classe: comunicacao.classe,
            numeroProcesso: comunicacao.numeroProcesso,
            texto: comunicacao.texto,
            link: comunicacao.link,
            oabs,
            casoId,
          },
          select: { id: true },
        })
        await registrarAuditoria(
          {
            usuarioId: null,
            usuarioEmail: null,
            acao: AcaoAuditoria.CRIACAO,
            entidade: 'publicacao',
            entidadeId: publicacao.id,
            detalhes: { origem: 'djen', idDjen: comunicacao.idDjen, casoId, oabs },
          },
          transacao,
        )
        return publicacao
      })
      novas.push({ id: criada.id, casoId })
    } catch (erro) {
      // Duas rodadas ao mesmo tempo (rotina + botão): a outra já gravou.
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') continue
      throw erro
    }
  }
  return novas
}

/** Um e-mail por responsável, com as publicações novas dos casos dele. */
async function avisarResponsaveis(novas: readonly PublicacaoNova[]): Promise<void> {
  const ids = novas.filter((n) => n.casoId !== null).map((n) => n.id)
  if (ids.length === 0) return

  const publicacoes = await prisma.publicacao.findMany({
    where: { id: { in: ids } },
    select: {
      siglaTribunal: true,
      tipoDocumento: true,
      numeroProcesso: true,
      caso: {
        select: {
          assunto: true,
          cliente: { select: { nome: true } },
          responsavel: { select: { email: true, nome: true } },
        },
      },
    },
  })

  const porResponsavel = new Map<string, { nome: string; linhas: string[] }>()
  for (const p of publicacoes) {
    const email = p.caso?.responsavel?.email
    if (email === undefined || email === null || p.caso === null || p.caso.responsavel === null) continue
    const grupo = porResponsavel.get(email) ?? { nome: p.caso.responsavel.nome, linhas: [] }
    grupo.linhas.push(
      `• ${formatarNumeroDeProcesso(p.numeroProcesso)} (${p.siglaTribunal}) — ${p.caso.cliente.nome}, ${p.caso.assunto}${
        p.tipoDocumento === null ? '' : ` — ${p.tipoDocumento}`
      }`,
    )
    porResponsavel.set(email, grupo)
  }

  for (const [email, grupo] of porResponsavel) {
    const texto = [
      `Olá, ${grupo.nome}.`,
      '',
      `Chegaram ${grupo.linhas.length} publicação(ões) nova(s) do DJEN em casos sob sua responsabilidade:`,
      '',
      ...grupo.linhas,
      '',
      'Confira em Publicações, no painel do Portal.',
    ].join('\n')
    await enviarEmail({
      para: email,
      assunto: `Publicações novas no DJEN (${grupo.linhas.length})`,
      texto,
      html: `<pre style="font-family:inherit;white-space:pre-wrap">${escaparHtml(texto)}</pre>`,
    })
  }
}

function escaparHtml(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ---------------------------------------------------------------------------
// 2. Análise pela IA
// ---------------------------------------------------------------------------

export type ResultadoDaAnalise =
  | { situacao: 'analisada' }
  | { situacao: 'ia_desligada' }
  | { situacao: 'nao_encontrada' }
  | { situacao: 'falhou'; erro: string }

/** Analisa uma publicação. Sem sessão: chamada pela rotina ou por `reanalisarPublicacao`. */
export async function analisarPublicacao(publicacaoId: string): Promise<ResultadoDaAnalise> {
  if (!iaConfigurada()) return { situacao: 'ia_desligada' }

  const publicacao = await prisma.publicacao.findUnique({ where: { id: publicacaoId } })
  if (publicacao === null) return { situacao: 'nao_encontrada' }

  const disponibilizacao = diaEmSaoPaulo(publicacao.disponibilizadaEm)
  const resposta = await pedirObjeto({
    sistema: INSTRUCOES_DO_SISTEMA,
    usuario: mensagemDoUsuario({ ...publicacao, disponibilizacao }),
    nome: 'registrar_analise',
    descricao: 'Registra a análise da publicação para a equipe do escritório conferir.',
    esquema: ESQUEMA_DA_ANALISE as unknown as Record<string, unknown>,
  })

  const analise = resposta.ok ? lerAnalise(resposta.dados) : null
  if (!resposta.ok || analise === null) {
    const erro = resposta.ok ? 'A IA respondeu fora do formato esperado.' : resposta.erro
    await prisma.publicacao.update({ where: { id: publicacao.id }, data: { analiseErro: erro } })
    return { situacao: 'falhou', erro }
  }

  const dia = prazoSugerido(analise, disponibilizacao)
  await prisma.$transaction(async (transacao) => {
    await transacao.publicacao.update({
      where: { id: publicacao.id },
      data: {
        analise: analise as unknown as Prisma.InputJsonValue,
        analisadaEm: new Date(),
        analiseProvedor: resposta.provedor,
        analiseErro: null,
        prazoSugerido: dia === null ? null : diaCivilParaData(dia),
      },
    })
    await registrarAuditoria(
      {
        usuarioId: null,
        usuarioEmail: null,
        acao: AcaoAuditoria.ATUALIZACAO,
        entidade: 'publicacao',
        entidadeId: publicacao.id,
        detalhes: { motivo: 'analise_da_ia', provedor: resposta.provedor, prazoSugerido: dia },
      },
      transacao,
    )
  })
  return { situacao: 'analisada' }
}

/** As pendentes sem análise, das mais novas para as mais antigas (a ordem da tela), até o teto. */
export async function analisarPendentes(
  consultaId?: string,
): Promise<{ analisadas: number; erros: string[] }> {
  if (!iaConfigurada()) return { analisadas: 0, erros: [] }

  const fila = await prisma.publicacao.findMany({
    where: { situacao: SituacaoDaPublicacao.PENDENTE, analisadaEm: null },
    select: { id: true },
    orderBy: [{ disponibilizadaEm: 'desc' }, { idDjen: 'desc' }],
    take: ANALISES_POR_RODADA,
  })

  let analisadas = 0
  const erros = new Set<string>()
  for (const { id } of fila) {
    const resultado = await analisarPublicacao(id)
    if (resultado.situacao === 'analisada') analisadas += 1
    if (resultado.situacao === 'falhou') erros.add(resultado.erro)
  }

  if (consultaId !== undefined) {
    const atual = await prisma.consultaDePublicacoes.findUnique({
      where: { id: consultaId },
      select: { erro: true },
    })
    const todas = [atual?.erro ?? '', ...erros].filter((e) => e !== '')
    await prisma.consultaDePublicacoes.update({
      where: { id: consultaId },
      data: { analisadas, erro: todas.length === 0 ? null : todas.join('\n') },
    })
  }

  return { analisadas, erros: [...erros] }
}

export async function reanalisarPublicacao(
  sessao: SessaoServidor,
  publicacaoId: string,
): Promise<ResultadoDaAnalise> {
  exigirEquipe(sessao)
  const existe = await prisma.publicacao.count({ where: { id: publicacaoId } })
  if (existe === 0) return { situacao: 'nao_encontrada' }
  return analisarPublicacao(publicacaoId)
}

// ---------------------------------------------------------------------------
// Leitura (tela)
// ---------------------------------------------------------------------------

export const FILTROS_DA_FILA = ['pendentes', 'sem_caso', 'conferidas', 'descartadas'] as const
export type FiltroDaFila = (typeof FILTROS_DA_FILA)[number]

export function lerFiltroDaFila(valor: string | undefined): FiltroDaFila {
  return (FILTROS_DA_FILA as readonly string[]).includes(valor ?? '') ? (valor as FiltroDaFila) : 'pendentes'
}

function condicaoDoFiltro(filtro: FiltroDaFila): Prisma.PublicacaoWhereInput {
  switch (filtro) {
    case 'pendentes':
      return { situacao: SituacaoDaPublicacao.PENDENTE, casoId: { not: null } }
    case 'sem_caso':
      return { situacao: SituacaoDaPublicacao.PENDENTE, casoId: null }
    case 'conferidas':
      return { situacao: SituacaoDaPublicacao.CONFERIDA }
    case 'descartadas':
      return { situacao: SituacaoDaPublicacao.DESCARTADA }
  }
}

const LINHA = {
  id: true,
  idDjen: true,
  disponibilizadaEm: true,
  siglaTribunal: true,
  orgao: true,
  tipoComunicacao: true,
  tipoDocumento: true,
  classe: true,
  numeroProcesso: true,
  texto: true,
  link: true,
  oabs: true,
  situacao: true,
  analise: true,
  analisadaEm: true,
  analiseProvedor: true,
  analiseErro: true,
  prazoSugerido: true,
  conferidaEm: true,
  conferidaPor: { select: { nome: true } },
  eventoId: true,
  andamentoId: true,
  caso: {
    select: {
      id: true,
      assunto: true,
      numeroProcesso: true,
      responsavelId: true,
      cliente: { select: { id: true, nome: true } },
    },
  },
} satisfies Prisma.PublicacaoSelect

type LinhaDoBanco = Prisma.PublicacaoGetPayload<{ select: typeof LINHA }>
export type LinhaDePublicacao = Omit<LinhaDoBanco, 'analise'> & { analise: AnaliseDaPublicacao | null }

export const LIMITE_DA_FILA = 100

export async function listarPublicacoes(
  sessao: SessaoServidor,
  filtro: FiltroDaFila,
): Promise<LinhaDePublicacao[]> {
  exigirEquipe(sessao)

  const pendente = filtro === 'pendentes' || filtro === 'sem_caso'
  const linhas = await prisma.publicacao.findMany({
    where: condicaoDoFiltro(filtro),
    select: LINHA,
    // Pendente: ordem cronológica, da mais recente para a mais antiga (pedido
    // do escritório, 11/11/2026 — no dia 10 tinham pedido o contrário, e antes
    // era pelo prazo sugerido, com as datas misturadas). Conferida: a
    // conferida por último primeiro.
    orderBy: pendente
      ? [{ disponibilizadaEm: 'desc' }, { idDjen: 'desc' }]
      : [{ conferidaEm: { sort: 'desc', nulls: 'last' } }, { disponibilizadaEm: 'desc' }],
    take: LIMITE_DA_FILA,
  })
  return linhas.map((linha) => ({ ...linha, analise: lerAnalise(linha.analise) }))
}

export async function contarPublicacoes(
  sessao: SessaoServidor,
): Promise<{ pendentes: number; semCaso: number; aguardandoAnalise: number }> {
  exigirEquipe(sessao)
  const [pendentes, semCaso, aguardandoAnalise] = await Promise.all([
    prisma.publicacao.count({ where: condicaoDoFiltro('pendentes') }),
    prisma.publicacao.count({ where: condicaoDoFiltro('sem_caso') }),
    // Só as nunca tentadas: as que falharam esperam a próxima rodada.
    prisma.publicacao.count({
      where: { situacao: SituacaoDaPublicacao.PENDENTE, analisadaEm: null, analiseErro: null },
    }),
  ])
  return { pendentes, semCaso, aguardandoAnalise }
}

export async function ultimaConsulta(sessao: SessaoServidor) {
  exigirEquipe(sessao)
  return prisma.consultaDePublicacoes.findFirst({
    orderBy: { iniciadaEm: 'desc' },
    select: {
      iniciadaEm: true,
      terminadaEm: true,
      inicioDaJanela: true,
      fimDaJanela: true,
      encontradas: true,
      novas: true,
      analisadas: true,
      erro: true,
    },
  })
}

// ---------------------------------------------------------------------------
// 3. Conferência (tela)
// ---------------------------------------------------------------------------

export type ResultadoDaFila =
  | { situacao: 'ok' }
  | { situacao: 'nao_encontrada' }
  | { situacao: 'caso_nao_encontrado' }
  | { situacao: 'ja_conferida' }
  | { situacao: 'sem_caso' }
  | { situacao: 'responsavel_invalido' }
  | { situacao: 'status_invalido' }

async function publicacaoDaFila(id: string) {
  return prisma.publicacao.findUnique({
    where: { id },
    select: { id: true, situacao: true, casoId: true, eventoId: true, andamentoId: true },
  })
}

export async function ligarPublicacaoAoCaso(
  sessao: SessaoServidor,
  publicacaoId: string,
  casoId: string,
  emailDoAutor: string | null,
): Promise<ResultadoDaFila> {
  exigirEquipe(sessao)

  const publicacao = await publicacaoDaFila(publicacaoId)
  if (publicacao === null) return { situacao: 'nao_encontrada' }
  if (publicacao.situacao !== SituacaoDaPublicacao.PENDENTE) return { situacao: 'ja_conferida' }

  // Regra 2: o caso vem do navegador e é conferido contra a sessão.
  const caso = await prisma.caso.findFirst({
    where: filtroDeCasos(sessao, { id: casoId }),
    select: { id: true },
  })
  if (caso === null) return { situacao: 'caso_nao_encontrado' }

  await prisma.$transaction(async (transacao) => {
    await transacao.publicacao.update({ where: { id: publicacao.id }, data: { casoId: caso.id } })
    await registrarAuditoria(
      {
        usuarioId: sessao.usuarioId,
        usuarioEmail: emailDoAutor,
        acao: AcaoAuditoria.ATUALIZACAO,
        entidade: 'publicacao',
        entidadeId: publicacao.id,
        detalhes: { motivo: 'ligada_ao_caso', casoAnterior: publicacao.casoId, casoId: caso.id },
      },
      transacao,
    )
  })
  return { situacao: 'ok' }
}

async function mudarSituacao(
  sessao: SessaoServidor,
  publicacaoId: string,
  de: SituacaoDaPublicacao,
  para: SituacaoDaPublicacao,
  motivo: string,
  emailDoAutor: string | null,
): Promise<ResultadoDaFila> {
  exigirEquipe(sessao)

  const publicacao = await publicacaoDaFila(publicacaoId)
  if (publicacao === null) return { situacao: 'nao_encontrada' }
  if (publicacao.situacao !== de) return { situacao: 'ja_conferida' }

  await prisma.$transaction(async (transacao) => {
    await transacao.publicacao.update({
      where: { id: publicacao.id },
      data: {
        situacao: para,
        conferidaEm: para === SituacaoDaPublicacao.PENDENTE ? null : new Date(),
        conferidaPorId: para === SituacaoDaPublicacao.PENDENTE ? null : sessao.usuarioId,
      },
    })
    await registrarAuditoria(
      {
        usuarioId: sessao.usuarioId,
        usuarioEmail: emailDoAutor,
        acao: AcaoAuditoria.ATUALIZACAO,
        entidade: 'publicacao',
        entidadeId: publicacao.id,
        detalhes: { motivo, situacaoAnterior: de, situacaoNova: para },
      },
      transacao,
    )
  })
  return { situacao: 'ok' }
}

export function descartarPublicacao(
  sessao: SessaoServidor,
  publicacaoId: string,
  emailDoAutor: string | null,
): Promise<ResultadoDaFila> {
  return mudarSituacao(
    sessao,
    publicacaoId,
    SituacaoDaPublicacao.PENDENTE,
    SituacaoDaPublicacao.DESCARTADA,
    'descartada',
    emailDoAutor,
  )
}

/** Devolve à fila uma publicação descartada por engano. */
export function reabrirPublicacao(
  sessao: SessaoServidor,
  publicacaoId: string,
  emailDoAutor: string | null,
): Promise<ResultadoDaFila> {
  return mudarSituacao(
    sessao,
    publicacaoId,
    SituacaoDaPublicacao.DESCARTADA,
    SituacaoDaPublicacao.PENDENTE,
    'reaberta',
    emailDoAutor,
  )
}

/**
 * A equipe conferiu. `evento` e `andamento` são opcionais e já vêm validados
 * (`validarEvento`, `validarAndamento`) — conferir sem criar nada também vale
 * ("só ciência").
 *
 * A publicação é marcada CONFERIDA ANTES de criar a tarefa e o andamento: um
 * clique duplo não cria duas tarefas, porque o segundo encontra a publicação
 * já conferida. Se a criação for recusada (responsável inativo, situação
 * inválida), ela volta para a fila.
 */
export async function conferirPublicacao(
  sessao: SessaoServidor,
  publicacaoId: string,
  pedido: { evento: DadosDeEvento | null; andamento: DadosDeAndamento | null },
  emailDoAutor: string | null,
): Promise<ResultadoDaFila> {
  exigirEquipe(sessao)

  const publicacao = await publicacaoDaFila(publicacaoId)
  if (publicacao === null) return { situacao: 'nao_encontrada' }
  if (publicacao.situacao !== SituacaoDaPublicacao.PENDENTE) return { situacao: 'ja_conferida' }
  if (publicacao.casoId === null && (pedido.evento !== null || pedido.andamento !== null)) {
    return { situacao: 'sem_caso' }
  }

  const reservada = await prisma.publicacao.updateMany({
    where: { id: publicacao.id, situacao: SituacaoDaPublicacao.PENDENTE },
    data: { situacao: SituacaoDaPublicacao.CONFERIDA, conferidaEm: new Date(), conferidaPorId: sessao.usuarioId },
  })
  if (reservada.count === 0) return { situacao: 'ja_conferida' }

  // Se uma tentativa anterior criou a tarefa ou o andamento e parou no
  // outro, não se cria de novo: reaproveita o que já existe.
  let eventoId = publicacao.eventoId
  let andamentoId = publicacao.andamentoId

  const devolverAFila = async () => {
    await prisma.publicacao.update({
      where: { id: publicacao.id },
      data: {
        situacao: SituacaoDaPublicacao.PENDENTE,
        conferidaEm: null,
        conferidaPorId: null,
        eventoId,
        andamentoId,
      },
    })
  }

  if (publicacao.casoId !== null && pedido.evento !== null && eventoId === null) {
    const evento = await criarEvento(sessao, publicacao.casoId, pedido.evento, emailDoAutor)
    if (evento.situacao !== 'criado') {
      await devolverAFila()
      return { situacao: evento.situacao }
    }
    eventoId = evento.eventoId
  }

  if (publicacao.casoId !== null && pedido.andamento !== null && andamentoId === null) {
    const andamento = await lancarAndamento(sessao, publicacao.casoId, pedido.andamento, emailDoAutor)
    if (andamento.situacao !== 'lancado') {
      await devolverAFila()
      return { situacao: andamento.situacao }
    }
    andamentoId = andamento.andamentoId
  }

  await prisma.$transaction(async (transacao) => {
    await transacao.publicacao.update({ where: { id: publicacao.id }, data: { eventoId, andamentoId } })
    await registrarAuditoria(
      {
        usuarioId: sessao.usuarioId,
        usuarioEmail: emailDoAutor,
        acao: AcaoAuditoria.ATUALIZACAO,
        entidade: 'publicacao',
        entidadeId: publicacao.id,
        detalhes: {
          motivo: 'conferida',
          casoId: publicacao.casoId,
          eventoId,
          andamentoId,
          prazoConfirmado: pedido.evento?.prazoDeEntrega.toISOString() ?? null,
        },
      },
      transacao,
    )
  })
  return { situacao: 'ok' }
}

/** Os casos que a equipe pode escolher ao ligar uma publicação "sem caso". */
export async function casosParaLigar(sessao: SessaoServidor) {
  exigirEquipe(sessao)
  return prisma.caso.findMany({
    where: filtroDeCasos(sessao),
    select: { id: true, assunto: true, numeroProcesso: true },
    orderBy: { criadoEm: 'desc' },
  })
}
