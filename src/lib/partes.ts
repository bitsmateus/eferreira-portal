/**
 * Cadastro de partes — o registro de quem assina um documento avulso sem ser
 * cliente do escritório (reunião de 17/09/2026): parte contrária, testemunha,
 * advogado externo, ou outro papel livre.
 *
 * Separado de `Cliente` de propósito — ver o comentário grande em
 * `prisma/schema.prisma`, no modelo `Parte`. Não existe trava de "tem
 * histórico" como em `excluirCliente`/`excluirCaso`: uma `Parte` não é
 * referenciada por chave estrangeira em lugar nenhum — quem já assinou um
 * envio fica gravado em `EnvioParaAssinatura.signatarios`, um retrato JSON
 * daquele momento, então apagar a `Parte` depois não apaga rastro nenhum.
 */

import { AcaoAuditoria, PapelDaParte, type Prisma } from '@prisma/client'
import { z } from 'zod'

import { exigirEquipe, type SessaoServidor } from '@/lib/autorizacao'
import { prisma } from '@/lib/prisma'
import { registrarAuditoria } from '@/lib/auditoria'
import { errosPorCampo, type ResultadoDeFormulario } from '@/lib/formulario'

// Mora em `rotulos-de-assinatura.ts`, sem nada de servidor: é o que permite à
// tela de partes ('use client') mostrar o rótulo do papel sem arrastar
// Prisma, auditoria e sessão inteiros para o pacote do navegador.
export { ROTULO_DO_PAPEL_DA_PARTE } from '@/lib/rotulos-de-assinatura'

const opcional = z
  .string()
  .trim()
  .max(240, 'Texto longo demais para este campo.')
  .transform((valor) => (valor === '' ? null : valor))

export const esquemaDeParte = z.object({
  nome: z
    .string()
    .trim()
    .min(2, 'Informe o nome de quem vai assinar.')
    .max(180, 'Nome longo demais.'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .transform((valor, contexto) => {
      const conferido = z.string().min(1).email().safeParse(valor)
      if (!conferido.success) {
        contexto.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'E-mail inválido. Sem e-mail válido não há como mandar o convite de assinatura.',
        })
        return z.NEVER
      }
      return conferido.data
    }),
  telefone: opcional,
  papel: z.nativeEnum(PapelDaParte, {
    errorMap: () => ({ message: 'Escolha um papel para esta parte.' }),
  }),
  observacoes: opcional,
})

export type DadosDaParte = z.output<typeof esquemaDeParte>
export type CamposDeParte = Record<keyof z.input<typeof esquemaDeParte>, string>

export function validarParte(campos: CamposDeParte): ResultadoDeFormulario<DadosDaParte> {
  const conferido = esquemaDeParte.safeParse(campos)
  if (!conferido.success) {
    return { ok: false, erros: errosPorCampo(conferido.error) }
  }
  return { ok: true, dados: conferido.data }
}

const RESUMO = {
  id: true,
  nome: true,
  email: true,
  telefone: true,
  papel: true,
  observacoes: true,
  criadoEm: true,
} satisfies Prisma.ParteSelect

export type LinhaDeParte = Prisma.ParteGetPayload<{ select: typeof RESUMO }>

/** Só a equipe cadastra e usa partes avulsas — cliente não tem acesso a isto. */
export async function listarPartes(sessao: SessaoServidor): Promise<LinhaDeParte[]> {
  exigirEquipe(sessao)

  return prisma.parte.findMany({
    select: RESUMO,
    orderBy: { nome: 'asc' },
  })
}

export async function criarParte(
  sessao: SessaoServidor,
  dados: DadosDaParte,
  emailDoAutor: string | null,
): Promise<{ id: string }> {
  exigirEquipe(sessao)

  return prisma.$transaction(async (transacao) => {
    const criado = await transacao.parte.create({
      data: { ...dados, criadoPorId: sessao.usuarioId },
      select: { id: true },
    })

    await registrarAuditoria(
      {
        usuarioId: sessao.usuarioId,
        usuarioEmail: emailDoAutor,
        acao: AcaoAuditoria.CRIACAO,
        entidade: 'parte',
        entidadeId: criado.id,
        detalhes: { nome: dados.nome, papel: dados.papel },
      },
      transacao,
    )

    return criado
  })
}

export async function excluirParte(
  sessao: SessaoServidor,
  parteId: string,
  emailDoAutor: string | null,
): Promise<boolean> {
  exigirEquipe(sessao)

  const parte = await prisma.parte.findUnique({
    where: { id: parteId },
    select: { id: true, nome: true, papel: true },
  })
  if (parte === null) return false

  await prisma.$transaction(async (transacao) => {
    await transacao.parte.delete({ where: { id: parte.id } })

    await registrarAuditoria(
      {
        usuarioId: sessao.usuarioId,
        usuarioEmail: emailDoAutor,
        acao: AcaoAuditoria.EXCLUSAO,
        entidade: 'parte',
        entidadeId: parte.id,
        detalhes: { nome: parte.nome, papel: parte.papel },
      },
      transacao,
    )
  })

  return true
}
