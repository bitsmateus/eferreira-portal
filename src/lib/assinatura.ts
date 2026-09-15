/**
 * O gatilho do Anexo I, 1.d: **só depois que o contrato é assinado** o cliente
 * entra no portal.
 *
 * Até aqui o sistema perguntava isso em três telas e não tinha onde responder:
 * `contratoAssinadoEm` era lido e nunca escrito, e portanto nenhum cliente
 * jamais entraria. É esta função que destranca a porta.
 *
 * Desde 15/09/2026 a assinatura eletrônica chama `registrarAssinatura` sozinha
 * quando o CONTRATO volta assinado da D4Sign — ver `src/lib/assinaturas.ts`
 * (no plural). Esta tela continua existindo e continua necessária: contrato
 * assinado EM PAPEL também existe, e erro de data também.
 *
 * Regra 6: registrar e revogar são escritas, e escrita sem autor identificado
 * não serve de prova. As duas passam pela auditoria.
 */

import { AcaoAuditoria, PerfilUsuario, SituacaoUsuario } from '@prisma/client'
import { z } from 'zod'

import { exigirEquipe, filtroDeClientes, type SessaoServidor } from '@/lib/autorizacao'
import { prisma } from '@/lib/prisma'
import { registrarAuditoria } from '@/lib/auditoria'
import { garantirUsuarioDoCliente } from '@/lib/acesso-do-cliente'
import { diaCivilParaData, diaEmSaoPaulo } from '@/lib/datas'
import { errosPorCampo, type ResultadoDeFormulario } from '@/lib/formulario'

export const esquemaDeAssinatura = z.object({
  assinadoEm: z
    .string()
    .trim()
    .transform((valor, contexto) => {
      if (valor === '') {
        contexto.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Informe a data da assinatura.',
        })
        return z.NEVER
      }

      const data = diaCivilParaData(valor)
      if (data === null) {
        contexto.addIssue({ code: z.ZodIssueCode.custom, message: 'Data inválida.' })
        return z.NEVER
      }

      // Assinatura é fato consumado. Data futura viraria acesso liberado antes
      // de o contrato existir.
      if (valor > diaEmSaoPaulo(new Date())) {
        contexto.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'A data da assinatura não pode estar no futuro.',
        })
        return z.NEVER
      }

      return data
    }),
})

export type DadosDeAssinatura = z.output<typeof esquemaDeAssinatura>

export function validarAssinatura(campos: {
  assinadoEm: string
}): ResultadoDeFormulario<DadosDeAssinatura> {
  const conferido = esquemaDeAssinatura.safeParse(campos)
  return conferido.success
    ? { ok: true, dados: conferido.data }
    : { ok: false, erros: errosPorCampo(conferido.error) }
}

export type ResultadoDeAssinatura =
  | { situacao: 'registrada' }
  | { situacao: 'cliente_nao_encontrado' }
  /**
   * Sem e-mail no cadastro não há para onde mandar o código, e o acesso
   * "liberado" seria mentira na tela. O escritório pediu exatamente isso em
   * 14/09/2026: "melhor não deixar salvar, para não criar futuras pendências".
   */
  | { situacao: 'sem_email' }

export async function registrarAssinatura(
  sessao: SessaoServidor,
  clienteId: string,
  dados: DadosDeAssinatura,
  emailDoAutor: string | null,
): Promise<ResultadoDeAssinatura> {
  exigirEquipe(sessao)

  // Regra 2: o id vem da tela, mas quem decide se ele pode ser tocado é o
  // filtro montado a partir da sessão.
  const cliente = await prisma.cliente.findFirst({
    where: filtroDeClientes(sessao, { id: clienteId }),
    select: { id: true, nome: true, email: true, contratoAssinadoEm: true },
  })
  if (cliente === null) return { situacao: 'cliente_nao_encontrado' }

  if (cliente.email === null || cliente.email.trim() === '') {
    return { situacao: 'sem_email' }
  }

  await prisma.cliente.update({
    where: { id: cliente.id },
    data: { contratoAssinadoEm: dados.assinadoEm },
  })

  // O acesso do cliente nasce aqui, junto com o gatilho. Idempotente: registrar
  // a assinatura de novo (para corrigir a data) não cria um segundo usuário.
  await garantirUsuarioDoCliente(cliente.id, cliente.nome)

  await registrarAuditoria({
    usuarioId: sessao.usuarioId,
    usuarioEmail: emailDoAutor,
    acao: AcaoAuditoria.ATUALIZACAO,
    entidade: 'cliente',
    entidadeId: cliente.id,
    detalhes: {
      campo: 'contratoAssinadoEm',
      de: cliente.contratoAssinadoEm?.toISOString() ?? null,
      para: dados.assinadoEm.toISOString(),
      efeito: 'acesso_do_cliente_liberado',
    },
  })

  return { situacao: 'registrada' }
}

export type ResultadoDeRevogacao =
  | { situacao: 'revogado' }
  | { situacao: 'cliente_nao_encontrado' }

/**
 * Desfaz o gatilho: o cliente deixa de entrar.
 *
 * Existe porque erro de digitação acontece e porque, em LGPD, a capacidade de
 * cortar um acesso é tão obrigatória quanto a de concedê-lo. Três coisas
 * precisam cair juntas, ou o acesso sobrevive à revogação:
 *
 *  1. a data do gatilho;
 *  2. o usuário de perfil CLIENTE, que passa a INATIVO;
 *  3. os códigos ainda válidos, que viram pó.
 *
 * A sessão já emitida é conferida contra o banco a cada requisição
 * (`exigirSessaoDeCliente`), então ela também morre na hora — o `contratoAssinado`
 * gravado no cookie não vale nada sozinho.
 */
export async function revogarAcesso(
  sessao: SessaoServidor,
  clienteId: string,
  emailDoAutor: string | null,
): Promise<ResultadoDeRevogacao> {
  exigirEquipe(sessao)

  const cliente = await prisma.cliente.findFirst({
    where: filtroDeClientes(sessao, { id: clienteId }),
    select: { id: true, contratoAssinadoEm: true },
  })
  if (cliente === null) return { situacao: 'cliente_nao_encontrado' }

  const agora = new Date()

  await prisma.$transaction([
    prisma.cliente.update({
      where: { id: cliente.id },
      data: { contratoAssinadoEm: null },
    }),
    prisma.usuario.updateMany({
      where: { clienteId: cliente.id, perfil: PerfilUsuario.CLIENTE },
      data: { situacao: SituacaoUsuario.INATIVO },
    }),
    prisma.codigoDeAcesso.updateMany({
      where: { clienteId: cliente.id, usadoEm: null, invalidadoEm: null },
      data: { invalidadoEm: agora },
    }),
  ])

  await registrarAuditoria({
    usuarioId: sessao.usuarioId,
    usuarioEmail: emailDoAutor,
    acao: AcaoAuditoria.ATUALIZACAO,
    entidade: 'cliente',
    entidadeId: cliente.id,
    detalhes: {
      campo: 'contratoAssinadoEm',
      de: cliente.contratoAssinadoEm?.toISOString() ?? null,
      para: null,
      efeito: 'acesso_do_cliente_revogado',
    },
  })

  return { situacao: 'revogado' }
}
