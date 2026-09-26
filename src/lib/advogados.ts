/**
 * Advogados — quem pode ser o OUTORGADO da procuração (25/09/2026).
 *
 * O escritório perguntou onde incluir advogado: até aqui a lista vivia no
 * código, com só dois nomes. Agora é cadastro, e a equipe (operador e
 * administrador) mantém — é o mesmo tipo de dado que as Partes: informação de
 * trabalho, sem risco de vazar dado de cliente.
 *
 * Não é usuário do sistema: o advogado cadastrado aqui não entra, não assina
 * nada e não vê nada. É só o que a procuração cita. Desativar não apaga: a
 * auditoria dos documentos já gerados aponta para o id.
 *
 * O endereço profissional, o e-mail e o telefone que a procuração traz são os
 * do ESCRITÓRIO, iguais para todos (`ESCRITORIO`, em `escritorio.ts`).
 */

import { AcaoAuditoria } from '@prisma/client'
import { z } from 'zod'

import { exigirEquipe, type SessaoServidor } from '@/lib/autorizacao'
import { registrarAuditoria } from '@/lib/auditoria'
import { ESTADOS_CIVIS } from '@/lib/campos-do-cliente'
import { ADVOGADO_PADRAO, type AdvogadoOutorgado } from '@/lib/escritorio'
import { errosPorCampo, type ResultadoDeFormulario } from '@/lib/formulario'
import { prisma } from '@/lib/prisma'
import { ufValida } from '@/lib/formatos'

// ---------------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------------

export const esquemaDeAdvogado = z.object({
  nome: z.string().trim().min(5, 'Informe o nome completo, com o tratamento (Dr./Dra.).').max(120, 'Nome longo demais.'),
  genero: z.enum(['M', 'F'], { errorMap: () => ({ message: 'Escolha masculino ou feminino.' }) }),
  nacionalidade: z.string().trim().min(3, 'A nacionalidade é obrigatória.').max(60, 'Texto longo demais.'),
  estadoCivil: z
    .string()
    .trim()
    .refine((valor) => (ESTADOS_CIVIS as readonly string[]).includes(valor), 'Escolha o estado civil.'),
  oab: z
    .string()
    .trim()
    .min(3, 'O número da OAB é obrigatório.')
    .max(20, 'Número longo demais.')
    .regex(/^[0-9.]+$/, 'Só números (pode usar ponto), como 378.532.'),
  oabUf: z
    .string()
    .trim()
    .toUpperCase()
    .refine((valor) => ufValida(valor), 'Informe a UF da seccional, como SP.'),
})

export type DadosDeAdvogado = z.output<typeof esquemaDeAdvogado>
export type CamposDeAdvogado = Record<keyof z.input<typeof esquemaDeAdvogado>, string>

export function validarAdvogado(
  campos: CamposDeAdvogado,
): ResultadoDeFormulario<DadosDeAdvogado> {
  const conferido = esquemaDeAdvogado.safeParse(campos)
  return conferido.success
    ? { ok: true, dados: conferido.data }
    : { ok: false, erros: errosPorCampo(conferido.error) }
}

// ---------------------------------------------------------------------------
// Do cadastro para o documento
// ---------------------------------------------------------------------------

/** Como a qualificação entra depois do nome: "brasileira, divorciada, advogada". */
export function qualificacaoDoAdvogado(dados: {
  nacionalidade: string
  estadoCivil: string
  feminino: boolean
}): string {
  return [
    dados.nacionalidade.trim(),
    dados.estadoCivil.trim().toLocaleLowerCase('pt-BR'),
    dados.feminino ? 'advogada' : 'advogado',
  ].join(', ')
}

type LinhaDoBanco = {
  id: string
  nome: string
  feminino: boolean
  nacionalidade: string
  estadoCivil: string
  oab: string
  oabUf: string
}

function paraODocumento(linha: LinhaDoBanco): AdvogadoOutorgado {
  return {
    id: linha.id,
    nome: linha.nome,
    feminino: linha.feminino,
    qualificacao: qualificacaoDoAdvogado(linha),
    oab: linha.oab,
    oabUf: linha.oabUf,
  }
}

/**
 * O advogado da procuração. `null` ou vazio = o padrão. Id que não existe (ou
 * de advogado desativado) devolve `undefined` e quem chama recusa: o navegador
 * não inventa quem assina como outorgado (regra 2).
 *
 * Sem nenhum advogado no banco (base recém-criada, antes da semente), cai nos
 * dois de `escritorio.ts`, para gerar procuração nunca depender de cadastro.
 */
export async function obterAdvogadoParaDocumento(
  id: string | null,
): Promise<AdvogadoOutorgado | undefined> {
  if (id !== null && id !== '') {
    const linha = await prisma.advogado.findFirst({ where: { id, ativo: true } })
    return linha === null ? undefined : paraODocumento(linha)
  }

  const padrao =
    (await prisma.advogado.findFirst({ where: { ativo: true, padrao: true } })) ??
    (await prisma.advogado.findFirst({ where: { ativo: true }, orderBy: { criadoEm: 'asc' } }))

  return padrao === null ? ADVOGADO_PADRAO : paraODocumento(padrao)
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

export type LinhaDeAdvogado = LinhaDoBanco & { padrao: boolean; ativo: boolean }

export async function listarAdvogados(sessao: SessaoServidor): Promise<LinhaDeAdvogado[]> {
  exigirEquipe(sessao)

  return prisma.advogado.findMany({
    orderBy: [{ ativo: 'desc' }, { padrao: 'desc' }, { nome: 'asc' }],
  })
}

/** Os que aparecem no seletor de "Gerar documento". */
export async function listarAdvogadosAtivos(sessao: SessaoServidor): Promise<LinhaDeAdvogado[]> {
  exigirEquipe(sessao)

  return prisma.advogado.findMany({
    where: { ativo: true },
    orderBy: [{ padrao: 'desc' }, { nome: 'asc' }],
  })
}

// ---------------------------------------------------------------------------
// Escrita — sempre com auditoria (regra 6)
// ---------------------------------------------------------------------------

export type ResultadoDeAdvogado =
  | { situacao: 'ok'; id: string }
  | { situacao: 'nao_encontrado' }
  | { situacao: 'repetido' }
  | { situacao: 'ultimo_ativo' }

function dadosParaGravar(dados: DadosDeAdvogado) {
  return {
    nome: dados.nome,
    feminino: dados.genero === 'F',
    nacionalidade: dados.nacionalidade,
    estadoCivil: dados.estadoCivil,
    oab: dados.oab,
    oabUf: dados.oabUf,
  }
}

export async function criarAdvogado(
  sessao: SessaoServidor,
  dados: DadosDeAdvogado,
  emailDoAutor: string | null,
): Promise<ResultadoDeAdvogado> {
  exigirEquipe(sessao)

  // A OAB é o que identifica o advogado: o mesmo número na mesma seccional
  // duas vezes é cadastro em duplicidade.
  const existente = await prisma.advogado.findFirst({
    where: { oab: dados.oab, oabUf: dados.oabUf },
    select: { id: true },
  })
  if (existente !== null) return { situacao: 'repetido' }

  const id = await prisma.$transaction(async (transacao) => {
    const criado = await transacao.advogado.create({
      data: dadosParaGravar(dados),
      select: { id: true },
    })

    await registrarAuditoria(
      {
        usuarioId: sessao.usuarioId,
        usuarioEmail: emailDoAutor,
        acao: AcaoAuditoria.CRIACAO,
        entidade: 'advogado',
        entidadeId: criado.id,
        detalhes: { nome: dados.nome, oab: `${dados.oab}/${dados.oabUf}` },
      },
      transacao,
    )

    return criado.id
  })

  return { situacao: 'ok', id }
}

export async function atualizarAdvogado(
  sessao: SessaoServidor,
  id: string,
  dados: DadosDeAdvogado,
  emailDoAutor: string | null,
): Promise<ResultadoDeAdvogado> {
  exigirEquipe(sessao)

  const alvo = await prisma.advogado.findUnique({ where: { id }, select: { id: true } })
  if (alvo === null) return { situacao: 'nao_encontrado' }

  const repetido = await prisma.advogado.findFirst({
    where: { oab: dados.oab, oabUf: dados.oabUf, id: { not: id } },
    select: { id: true },
  })
  if (repetido !== null) return { situacao: 'repetido' }

  await prisma.$transaction(async (transacao) => {
    await transacao.advogado.update({ where: { id }, data: dadosParaGravar(dados) })

    await registrarAuditoria(
      {
        usuarioId: sessao.usuarioId,
        usuarioEmail: emailDoAutor,
        acao: AcaoAuditoria.ATUALIZACAO,
        entidade: 'advogado',
        entidadeId: id,
        detalhes: { nome: dados.nome, oab: `${dados.oab}/${dados.oabUf}` },
      },
      transacao,
    )
  })

  return { situacao: 'ok', id }
}

/**
 * Desativar e reativar. Sempre sobra um advogado ativo: sem nenhum, o seletor
 * de "Gerar documento" ficaria vazio. Desativar o padrão passa o padrão para
 * outro ativo.
 */
export async function alterarSituacaoDoAdvogado(
  sessao: SessaoServidor,
  id: string,
  ativo: boolean,
  emailDoAutor: string | null,
): Promise<ResultadoDeAdvogado> {
  exigirEquipe(sessao)

  const alvo = await prisma.advogado.findUnique({ where: { id } })
  if (alvo === null) return { situacao: 'nao_encontrado' }
  if (alvo.ativo === ativo) return { situacao: 'ok', id }

  if (!ativo) {
    const outrosAtivos = await prisma.advogado.count({ where: { ativo: true, id: { not: id } } })
    if (outrosAtivos === 0) return { situacao: 'ultimo_ativo' }
  }

  await prisma.$transaction(async (transacao) => {
    await transacao.advogado.update({
      where: { id },
      data: { ativo, ...(ativo ? {} : { padrao: false }) },
    })

    if (!ativo && alvo.padrao) {
      const proximo = await transacao.advogado.findFirst({
        where: { ativo: true },
        orderBy: { criadoEm: 'asc' },
        select: { id: true },
      })
      if (proximo !== null) {
        await transacao.advogado.update({ where: { id: proximo.id }, data: { padrao: true } })
      }
    }

    await registrarAuditoria(
      {
        usuarioId: sessao.usuarioId,
        usuarioEmail: emailDoAutor,
        acao: AcaoAuditoria.ATUALIZACAO,
        entidade: 'advogado',
        entidadeId: id,
        detalhes: { ativo },
      },
      transacao,
    )
  })

  return { situacao: 'ok', id }
}

export async function tornarAdvogadoPadrao(
  sessao: SessaoServidor,
  id: string,
  emailDoAutor: string | null,
): Promise<ResultadoDeAdvogado> {
  exigirEquipe(sessao)

  const alvo = await prisma.advogado.findFirst({ where: { id, ativo: true }, select: { id: true } })
  if (alvo === null) return { situacao: 'nao_encontrado' }

  await prisma.$transaction(async (transacao) => {
    await transacao.advogado.updateMany({ where: { padrao: true }, data: { padrao: false } })
    await transacao.advogado.update({ where: { id }, data: { padrao: true } })

    await registrarAuditoria(
      {
        usuarioId: sessao.usuarioId,
        usuarioEmail: emailDoAutor,
        acao: AcaoAuditoria.ATUALIZACAO,
        entidade: 'advogado',
        entidadeId: id,
        detalhes: { padrao: true },
      },
      transacao,
    )
  })

  return { situacao: 'ok', id }
}
