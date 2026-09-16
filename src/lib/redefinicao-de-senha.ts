/**
 * "Esqueci minha senha" — operador e administrador (Anexo I, 1.b: acesso
 * individual por e-mail e senha). O cliente não passa por aqui: ele entra por
 * CPF/CNPJ e código, sem senha para esquecer — ver `src/lib/acesso-do-cliente.ts`.
 *
 * O desenho é o mesmo do código de acesso do cliente, de propósito: um só
 * padrão de recuperação por e-mail no sistema inteiro, em vez de dois.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * A RESPOSTA É SEMPRE A MESMA
 *
 * Pedir um código devolve o mesmo texto exista ou não um usuário com aquele
 * e-mail. Diferenciar revelaria quais e-mails têm acesso ao painel — e por
 * tabela, quem trabalha no escritório.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { randomInt } from 'node:crypto'
import { AcaoAuditoria, PerfilUsuario, SituacaoUsuario } from '@prisma/client'
import { z } from 'zod'

import {
  DIGITOS_DO_CODIGO,
  JANELA_DE_PEDIDOS_MINUTOS,
  MINUTOS_DE_VALIDADE,
  PEDIDOS_POR_IP,
  PEDIDOS_POR_USUARIO,
  SEGUNDOS_ENTRE_PEDIDOS,
  TENTATIVAS_POR_CODIGO,
} from '@/lib/redefinicao'
import { prisma } from '@/lib/prisma'
import { registrarAuditoria } from '@/lib/auditoria'
import { enviarEmail } from '@/lib/email'
import { mensagemDeRedefinicaoDeSenha } from '@/lib/mensagens'
import { gastarTempoDeVerificacao, gerarHashDeSenha, senhaConfere } from '@/lib/senha'
import { errosPorCampo, type ResultadoDeFormulario } from '@/lib/formulario'

const MS_POR_MINUTO = 60_000

/** Entidade sob a qual todo pedido e toda tentativa entram na auditoria. */
const ENTIDADE_DE_AUDITORIA = 'redefinicao_de_senha'

// ---------------------------------------------------------------------------
// Validação dos formulários
// ---------------------------------------------------------------------------

const campoDeEmail = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Informe o seu e-mail.')
  .email('E-mail inválido. Confira o que foi digitado.')

const campoDeSenhaNova = z
  .string()
  .min(8, 'A senha precisa de pelo menos 8 caracteres.')

export const esquemaDoPedido = z.object({ email: campoDeEmail })

export const esquemaDaRedefinicao = z
  .object({
    email: campoDeEmail,
    codigo: z
      .string()
      .trim()
      .transform((valor) => valor.replace(/\D/g, ''))
      .refine(
        (digitos) => digitos.length === DIGITOS_DO_CODIGO,
        `O código tem ${DIGITOS_DO_CODIGO} dígitos.`,
      ),
    senha: campoDeSenhaNova,
    confirmacao: z.string(),
  })
  .refine((dados) => dados.senha === dados.confirmacao, {
    message: 'As senhas digitadas não são iguais.',
    path: ['confirmacao'],
  })

export type DadosDoPedido = z.output<typeof esquemaDoPedido>
export type DadosDaRedefinicao = z.output<typeof esquemaDaRedefinicao>

export function validarPedido(campos: {
  email: string
}): ResultadoDeFormulario<DadosDoPedido> {
  const conferido = esquemaDoPedido.safeParse(campos)
  return conferido.success
    ? { ok: true, dados: conferido.data }
    : { ok: false, erros: errosPorCampo(conferido.error) }
}

export function validarRedefinicao(campos: {
  email: string
  codigo: string
  senha: string
  confirmacao: string
}): ResultadoDeFormulario<DadosDaRedefinicao> {
  const conferido = esquemaDaRedefinicao.safeParse(campos)
  return conferido.success
    ? { ok: true, dados: conferido.data }
    : { ok: false, erros: errosPorCampo(conferido.error) }
}

// ---------------------------------------------------------------------------
// O código em si
// ---------------------------------------------------------------------------

/** Seis dígitos de `node:crypto` — mesma escolha do código do cliente. */
export function gerarCodigo(): string {
  return String(randomInt(0, 10 ** DIGITOS_DO_CODIGO)).padStart(
    DIGITOS_DO_CODIGO,
    '0',
  )
}

export type Origem = {
  enderecoIp?: string | null
  agenteUsuario?: string | null
}

// ---------------------------------------------------------------------------
// Elegibilidade
// ---------------------------------------------------------------------------

type UsuarioElegivel = { id: string; nome: string; email: string }

/**
 * Quem pode pedir redefinição: um usuário da EQUIPE (operador ou
 * administrador — regra 2, o cliente não tem senha), ativo e com e-mail
 * próprio. Devolve null para todo o resto, sem dizer qual dos motivos —
 * quem chama não deve nem poder distinguir.
 */
async function usuarioElegivel(email: string): Promise<UsuarioElegivel | null> {
  const usuario = await prisma.usuario.findUnique({
    where: { email },
    select: {
      id: true,
      nome: true,
      email: true,
      perfil: true,
      situacao: true,
      senhaHash: true,
    },
  })

  if (usuario === null) return null
  if (usuario.email === null) return null
  if (usuario.senhaHash === null) return null
  if (usuario.situacao !== SituacaoUsuario.ATIVO) return null
  if (usuario.perfil !== PerfilUsuario.OPERADOR && usuario.perfil !== PerfilUsuario.ADMINISTRADOR) {
    return null
  }

  return { id: usuario.id, nome: usuario.nome, email: usuario.email }
}

// ---------------------------------------------------------------------------
// Limites
// ---------------------------------------------------------------------------

/** Quantos pedidos saíram deste endereço na janela — inclusive os recusados. */
async function pedidosRecentesDoIp(
  enderecoIp: string | null,
  desde: Date,
): Promise<number> {
  if (enderecoIp === null || enderecoIp === '') return 0

  return prisma.auditoria.count({
    where: {
      entidade: ENTIDADE_DE_AUDITORIA,
      acao: AcaoAuditoria.AUTENTICACAO,
      enderecoIp,
      criadoEm: { gte: desde },
    },
  })
}

// ---------------------------------------------------------------------------
// Pedir o código
// ---------------------------------------------------------------------------

/** Resposta única, de propósito — ver o comentário no topo do arquivo. */
export type ResultadoDoPedido = { situacao: 'pedido_registrado' }

export async function pedirRedefinicao(
  email: string,
  origem: Origem = {},
): Promise<ResultadoDoPedido> {
  const agora = new Date()
  const enderecoIp = origem.enderecoIp ?? null
  const desde = new Date(agora.getTime() - JANELA_DE_PEDIDOS_MINUTOS * MS_POR_MINUTO)

  const excedeuOIp = (await pedidosRecentesDoIp(enderecoIp, desde)) >= PEDIDOS_POR_IP
  const usuario = excedeuOIp ? null : await usuarioElegivel(email)

  // Todo pedido entra na auditoria, inclusive o de e-mail que não é de
  // ninguém: é este registro que sustenta o limite por endereço.
  await registrarAuditoria({
    usuarioId: usuario?.id ?? null,
    usuarioEmail: usuario?.email ?? null,
    acao: AcaoAuditoria.AUTENTICACAO,
    entidade: ENTIDADE_DE_AUDITORIA,
    entidadeId: usuario?.id ?? null,
    detalhes: excedeuOIp
      ? { resultado: 'limite_por_endereco' }
      : { resultado: usuario === null ? 'sem_usuario_elegivel' : 'pedido' },
    enderecoIp,
    agenteUsuario: origem.agenteUsuario ?? null,
  })

  if (usuario === null) {
    // Mesmo tempo de resposta de um envio de verdade — sem isto, a diferença
    // entrega quais e-mails têm acesso ao painel.
    await gastarTempoDeVerificacao(email)
    return { situacao: 'pedido_registrado' }
  }

  const recentes = await prisma.tokenDeRedefinicaoDeSenha.findMany({
    where: { usuarioId: usuario.id, criadoEm: { gte: desde } },
    select: { id: true, criadoEm: true },
    orderBy: { criadoEm: 'desc' },
  })

  const ultimo = recentes[0]
  const cedoDemais =
    ultimo !== undefined &&
    agora.getTime() - ultimo.criadoEm.getTime() < SEGUNDOS_ENTRE_PEDIDOS * 1000

  if (cedoDemais || recentes.length >= PEDIDOS_POR_USUARIO) {
    await gastarTempoDeVerificacao(email)
    return { situacao: 'pedido_registrado' }
  }

  const codigo = gerarCodigo()
  const codigoHash = await gerarHashDeSenha(codigo)

  await prisma.$transaction([
    // Um código por vez: pedir outro mata o anterior.
    prisma.tokenDeRedefinicaoDeSenha.updateMany({
      where: { usuarioId: usuario.id, usadoEm: null, invalidadoEm: null },
      data: { invalidadoEm: agora },
    }),
    prisma.tokenDeRedefinicaoDeSenha.create({
      data: {
        usuarioId: usuario.id,
        codigoHash,
        expiraEm: new Date(agora.getTime() + MINUTOS_DE_VALIDADE * MS_POR_MINUTO),
        enderecoIp,
        agenteUsuario: origem.agenteUsuario ?? null,
      },
    }),
  ])

  // O envio fica fora da transação e o resultado não muda a resposta: SMTP
  // fora do ar é problema do escritório, não informação para quem pediu.
  await enviarEmail(
    mensagemDeRedefinicaoDeSenha(usuario.email, usuario.nome, codigo, MINUTOS_DE_VALIDADE),
  )

  return { situacao: 'pedido_registrado' }
}

// ---------------------------------------------------------------------------
// Confirmar o código e trocar a senha
// ---------------------------------------------------------------------------

export type ResultadoDaRedefinicao =
  | { situacao: 'redefinida' }
  /** E-mail, código, validade, tentativas — tudo cai aqui. Um motivo só. */
  | { situacao: 'nao_confere' }

export async function confirmarRedefinicao(
  email: string,
  codigo: string,
  senhaNova: string,
  origem: Origem = {},
): Promise<ResultadoDaRedefinicao> {
  const agora = new Date()
  const usuario = await usuarioElegivel(email)

  if (usuario === null) {
    await gastarTempoDeVerificacao(codigo)
    await registrarFalha(null, origem)
    return { situacao: 'nao_confere' }
  }

  const pendente = await prisma.tokenDeRedefinicaoDeSenha.findFirst({
    where: {
      usuarioId: usuario.id,
      usadoEm: null,
      invalidadoEm: null,
      expiraEm: { gt: agora },
    },
    orderBy: { criadoEm: 'desc' },
    select: { id: true, codigoHash: true, tentativas: true },
  })

  if (pendente === null) {
    await gastarTempoDeVerificacao(codigo)
    await registrarFalha(usuario.id, origem)
    return { situacao: 'nao_confere' }
  }

  if (await senhaConfere(codigo, pendente.codigoHash)) {
    await prisma.$transaction(async (transacao) => {
      await transacao.tokenDeRedefinicaoDeSenha.update({
        where: { id: pendente.id },
        data: { usadoEm: agora },
      })
      await transacao.usuario.update({
        where: { id: usuario.id },
        // Redefinir também destrava o bloqueio de tentativas — a pessoa acaba
        // de provar quem é pelo e-mail, o mesmo padrão do "Redefinir senha" do
        // administrador em `src/lib/usuarios.ts`.
        data: {
          senhaHash: await gerarHashDeSenha(senhaNova),
          tentativasFalhas: 0,
          bloqueadoAte: null,
        },
      })
      await registrarAuditoria(
        {
          usuarioId: usuario.id,
          usuarioEmail: usuario.email,
          acao: AcaoAuditoria.ATUALIZACAO,
          entidade: 'usuario',
          entidadeId: usuario.id,
          detalhes: { motivo: 'redefinicao_por_esquecimento' },
        },
        transacao,
      )
    })

    return { situacao: 'redefinida' }
  }

  const tentativas = pendente.tentativas + 1
  await prisma.tokenDeRedefinicaoDeSenha.update({
    where: { id: pendente.id },
    data: {
      tentativas,
      // Na quinta errada o código morre e é preciso pedir outro.
      invalidadoEm: tentativas >= TENTATIVAS_POR_CODIGO ? agora : null,
    },
  })

  await registrarFalha(usuario.id, origem, tentativas)
  return { situacao: 'nao_confere' }
}

async function registrarFalha(
  usuarioId: string | null,
  origem: Origem,
  tentativas?: number,
): Promise<void> {
  await registrarAuditoria({
    usuarioId: null,
    usuarioEmail: null,
    acao: AcaoAuditoria.AUTENTICACAO,
    entidade: ENTIDADE_DE_AUDITORIA,
    entidadeId: usuarioId,
    detalhes:
      tentativas === undefined
        ? { resultado: 'codigo_incorreto' }
        : {
            resultado: 'codigo_incorreto',
            tentativas,
            invalidou: tentativas >= TENTATIVAS_POR_CODIGO,
          },
    enderecoIp: origem.enderecoIp ?? null,
    agenteUsuario: origem.agenteUsuario ?? null,
  })
}
