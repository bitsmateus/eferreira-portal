/**
 * Credenciais da API — Anexo I, itens 3.b e 3.c.
 *
 * Quem gere credencial é o **administrador** (CLAUDE.md, perfis de acesso).
 * Quem as usa são os serviços que o escritório indicar — dependência 3.3,
 * ainda sem resposta sobre quais serão.
 *
 * Regra 6: criar e revogar credencial são escritas, e ficam na auditoria. Não
 * fica na auditoria, e nunca pode ficar, o segredo da chave.
 */

import { AcaoAuditoria, PermissaoApi, PerfilUsuario, SituacaoUsuario } from '@prisma/client'
import { z } from 'zod'

import { exigirAdministrador, type SessaoServidor } from '@/lib/autorizacao'
import { prisma } from '@/lib/prisma'
import { registrarAuditoria } from '@/lib/auditoria'
import {
  gerarChave,
  lerChave,
  mascarar,
  prefixoDoAmbiente,
  segredoConfere,
} from '@/lib/chave-de-api'
import { errosPorCampo, type ResultadoDeFormulario } from '@/lib/formulario'
import type { LinhaDeCredencial } from '@/lib/permissoes-da-api'

export {
  DESCRICAO_DA_PERMISSAO,
  PERMISSOES_DA_API,
  ROTULO_DA_PERMISSAO,
  type LinhaDeCredencial,
} from '@/lib/permissoes-da-api'

// ---------------------------------------------------------------------------
// Criação
// ---------------------------------------------------------------------------

export const esquemaDeCredencial = z.object({
  nome: z
    .string()
    .trim()
    .min(3, 'Dê um nome que diga quem vai usar a chave.')
    .max(120, 'Nome longo demais.'),
  permissoes: z
    .array(z.nativeEnum(PermissaoApi))
    .min(1, 'Escolha ao menos uma permissão.'),
})

export type DadosDeCredencial = z.output<typeof esquemaDeCredencial>

export function validarCredencial(campos: {
  nome: string
  permissoes: string[]
}): ResultadoDeFormulario<DadosDeCredencial> {
  // O navegador manda o que quiser nos checkboxes; o que não for permissão
  // conhecida é descartado antes da validação, não depois.
  const conhecidas = Object.values(PermissaoApi) as string[]
  const permissoes = campos.permissoes.filter((valor) => conhecidas.includes(valor))

  const conferido = esquemaDeCredencial.safeParse({ nome: campos.nome, permissoes })
  return conferido.success
    ? { ok: true, dados: conferido.data }
    : { ok: false, erros: errosPorCampo(conferido.error) }
}

export type ResultadoDeCriacao = {
  credencialId: string
  /**
   * A chave inteira. É a única vez que ela existe fora do bolso de quem vai
   * usá-la — não é guardada em lugar nenhum, nem aqui, nem na auditoria.
   */
  chave: string
}

export async function criarCredencial(
  sessao: SessaoServidor,
  dados: DadosDeCredencial,
  emailDoAutor: string | null,
): Promise<ResultadoDeCriacao> {
  exigirAdministrador(sessao)

  const nova = gerarChave(prefixoDoAmbiente())

  const credencialId = await prisma.$transaction(async (transacao) => {
    // O usuário em nome de quem a API escreve. Sem e-mail e sem senha: não
    // entra por tela nenhuma, e ainda assim é autor identificado no andamento
    // que a API lançar (regra 6).
    const usuario = await transacao.usuario.create({
      data: {
        nome: `API · ${dados.nome}`,
        email: null,
        senhaHash: null,
        perfil: PerfilUsuario.OPERADOR,
        situacao: SituacaoUsuario.ATIVO,
      },
      select: { id: true },
    })

    const credencial = await transacao.credencialApi.create({
      data: {
        nome: dados.nome,
        prefixo: nova.prefixo,
        identificador: nova.identificador,
        segredoHash: nova.segredoHash,
        final: nova.final,
        permissoes: dados.permissoes,
        usuarioId: usuario.id,
        criadoPorId: sessao.usuarioId,
      },
      select: { id: true },
    })

    await registrarAuditoria(
      {
        usuarioId: sessao.usuarioId,
        usuarioEmail: emailDoAutor,
        acao: AcaoAuditoria.CRIACAO,
        entidade: 'credencial_api',
        entidadeId: credencial.id,
        // Identificador e permissões, sim. O segredo, nunca.
        detalhes: {
          nome: dados.nome,
          prefixo: nova.prefixo,
          identificador: nova.identificador,
          permissoes: dados.permissoes,
        },
      },
      transacao,
    )

    return credencial.id
  })

  return { credencialId, chave: nova.chave }
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

export async function listarCredenciais(
  sessao: SessaoServidor,
): Promise<LinhaDeCredencial[]> {
  exigirAdministrador(sessao)

  const credenciais = await prisma.credencialApi.findMany({
    select: {
      id: true,
      nome: true,
      prefixo: true,
      final: true,
      permissoes: true,
      criadoEm: true,
      ultimoUsoEm: true,
      revogadoEm: true,
      criadoPor: { select: { nome: true } },
    },
    orderBy: [{ revogadoEm: 'asc' }, { criadoEm: 'desc' }],
  })

  return credenciais.map((credencial) => ({
    id: credencial.id,
    nome: credencial.nome,
    mascarada: mascarar(credencial.prefixo, credencial.final),
    prefixo: credencial.prefixo,
    ehDeProducao: credencial.prefixo === 'ef_live_',
    permissoes: credencial.permissoes,
    ativa: credencial.revogadoEm === null,
    criadoEm: credencial.criadoEm,
    ultimoUsoEm: credencial.ultimoUsoEm,
    revogadoEm: credencial.revogadoEm,
    criadaPor: credencial.criadoPor?.nome ?? null,
  }))
}

// ---------------------------------------------------------------------------
// Revogação
// ---------------------------------------------------------------------------

export type ResultadoDeRevogacao =
  | { situacao: 'revogada' }
  | { situacao: 'nao_encontrada' }

/**
 * A chave para de funcionar na hora. A linha continua: a auditoria das
 * escritas feitas por ela aponta para cá e precisa continuar dizendo quem fez.
 */
export async function revogarCredencial(
  sessao: SessaoServidor,
  credencialId: string,
  emailDoAutor: string | null,
): Promise<ResultadoDeRevogacao> {
  exigirAdministrador(sessao)

  const credencial = await prisma.credencialApi.findUnique({
    where: { id: credencialId },
    select: { id: true, nome: true, usuarioId: true, revogadoEm: true },
  })
  if (credencial === null) return { situacao: 'nao_encontrada' }
  if (credencial.revogadoEm !== null) return { situacao: 'revogada' }

  const agora = new Date()

  await prisma.$transaction([
    prisma.credencialApi.update({
      where: { id: credencial.id },
      data: { revogadoEm: agora },
    }),
    // O usuário da credencial some junto. Se ele ficasse ATIVO, uma futura
    // tela de usuários poderia devolver acesso a uma chave já revogada.
    prisma.usuario.update({
      where: { id: credencial.usuarioId },
      data: { situacao: SituacaoUsuario.INATIVO },
    }),
  ])

  await registrarAuditoria({
    usuarioId: sessao.usuarioId,
    usuarioEmail: emailDoAutor,
    acao: AcaoAuditoria.EXCLUSAO,
    entidade: 'credencial_api',
    entidadeId: credencial.id,
    detalhes: { nome: credencial.nome },
  })

  return { situacao: 'revogada' }
}

// ---------------------------------------------------------------------------
// Autenticação das requisições
// ---------------------------------------------------------------------------

export type CredencialAutenticada = {
  credencialId: string
  nome: string
  permissoes: PermissaoApi[]
  /**
   * A sessão em nome da qual a API consulta e escreve.
   *
   * Perfil OPERADOR: o item 3.b pede consulta por CPF ou CNPJ de qualquer
   * cliente, que é o recorte do operador. O que a chave pode FAZER com esse
   * alcance é outra coisa, e quem decide é `permissoes` — conferida em cada
   * rota antes de chamar o domínio.
   */
  sessao: SessaoServidor
}

/**
 * Confere a chave apresentada. Devolve null para tudo que não presta — chave
 * malformada, identificador que não existe, segredo errado, credencial
 * revogada. Um motivo só, como na entrada do cliente: distinguir entregaria
 * quais identificadores existem.
 */
export async function autenticarChave(
  apresentada: string | null,
): Promise<CredencialAutenticada | null> {
  if (apresentada === null) return null

  const lida = lerChave(apresentada)
  if (lida === null) return null

  const credencial = await prisma.credencialApi.findUnique({
    where: { identificador: lida.identificador },
    select: {
      id: true,
      nome: true,
      prefixo: true,
      segredoHash: true,
      permissoes: true,
      revogadoEm: true,
      usuarioId: true,
    },
  })

  if (credencial === null) return null
  if (credencial.revogadoEm !== null) return null

  // A chave de produção não vale na instalação de testes, nem o contrário.
  if (credencial.prefixo !== lida.prefixo) return null

  if (!segredoConfere(lida.segredo, credencial.segredoHash)) return null

  return {
    credencialId: credencial.id,
    nome: credencial.nome,
    permissoes: credencial.permissoes,
    sessao: {
      usuarioId: credencial.usuarioId,
      perfil: PerfilUsuario.OPERADOR,
      clienteId: null,
      contratoAssinado: false,
    },
  }
}

export function podeNaApi(
  credencial: CredencialAutenticada,
  permissao: PermissaoApi,
): boolean {
  return credencial.permissoes.includes(permissao)
}

/**
 * Marca o uso. Fora do caminho da resposta de propósito: é informação de
 * operação ("esta chave ainda é usada?"), e uma escrita a cada requisição não
 * pode atrasar nem derrubar a requisição em si.
 */
export async function anotarUso(credencialId: string): Promise<void> {
  try {
    await prisma.credencialApi.update({
      where: { id: credencialId },
      data: { ultimoUsoEm: new Date() },
    })
  } catch {
    // Anotar o uso é conveniência; falhar aqui não pode virar erro 500.
  }
}
