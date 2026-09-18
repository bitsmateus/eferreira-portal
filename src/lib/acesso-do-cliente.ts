/**
 * Entrada do cliente — Anexo II, item 3.6 (resolvido): CPF ou CNPJ mais um
 * código enviado por e-mail.
 *
 * Por que o código existe, na frase do próprio protótipo: "sem ele, qualquer
 * pessoa que saiba um CPF ou CNPJ veria o processo daquele cliente. Dado de
 * processo é dado sensível de terceiro."
 *
 * ─────────────────────────────────────────────────────────────────────────
 * A RESPOSTA É SEMPRE A MESMA
 *
 * Pedir um código devolve o mesmo texto em todos os casos: documento que não
 * existe, cliente sem contrato assinado, cliente sem e-mail, limite de pedidos
 * estourado, SMTP fora do ar. Distinguir qualquer um deles transformaria esta
 * tela em consulta pública: "este CPF é cliente da E. Ferreira Advogados?" —
 * que é, em si, informação sensível sobre a pessoa.
 *
 * É a mesma razão pela qual a tela NÃO mostra o e-mail mascarado que o
 * protótipo desenhou. Ver o comentário na tela `/consultar`.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Regra 2 e a exceção legítima: aqui a consulta ao banco NÃO passa por
 * `filtroDeClientes`, porque ainda não existe sessão — este é justamente o
 * passo que cria uma. Nada do que é lido aqui chega à tela: o cliente só sai
 * desta função como identificador de sessão.
 */

import { randomInt } from 'node:crypto'
import { AcaoAuditoria, PerfilUsuario, SituacaoCliente, SituacaoUsuario } from '@prisma/client'
import { z } from 'zod'

import {
  DIGITOS_DO_CODIGO,
  JANELA_DE_PEDIDOS_MINUTOS,
  MINUTOS_DE_VALIDADE,
  PEDIDOS_POR_CLIENTE,
  PEDIDOS_POR_IP,
  SEGUNDOS_ENTRE_PEDIDOS,
  TENTATIVAS_POR_CODIGO,
} from '@/lib/acesso'
import { prisma } from '@/lib/prisma'
import { registrarAuditoria } from '@/lib/auditoria'
import { documentoValido, normalizarDocumento } from '@/lib/documento'
import { enviarEmail } from '@/lib/email'
import { mensagemDeCodigo } from '@/lib/mensagens'
import { gastarTempoDeVerificacao, gerarHashDeSenha, senhaConfere } from '@/lib/senha'
import { errosPorCampo, type ResultadoDeFormulario } from '@/lib/formulario'

const MS_POR_MINUTO = 60_000

/** Entidade sob a qual todo pedido e toda conferência entram na auditoria. */
const ENTIDADE_DE_AUDITORIA = 'codigo_de_acesso'

// ---------------------------------------------------------------------------
// Validação dos formulários
// ---------------------------------------------------------------------------

const campoDeDocumento = z
  .string()
  .trim()
  .transform((valor, contexto) => {
    const digitos = normalizarDocumento(valor)

    if (digitos === '') {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe o seu CPF ou CNPJ.',
      })
      return z.NEVER
    }

    // Regra 4: dígito verificador, não só máscara. Aqui isso também evita
    // consultar o banco para qualquer sequência digitada.
    if (!documentoValido(digitos)) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'CPF ou CNPJ inválido. Confira os números.',
      })
      return z.NEVER
    }

    return digitos
  })

export const esquemaDoPedido = z.object({ documento: campoDeDocumento })

export const esquemaDaConferencia = z.object({
  documento: campoDeDocumento,
  codigo: z
    .string()
    .trim()
    .transform((valor) => valor.replace(/\D/g, ''))
    .refine(
      (digitos) => digitos.length === DIGITOS_DO_CODIGO,
      `O código tem ${DIGITOS_DO_CODIGO} dígitos.`,
    ),
})

export type DadosDoPedido = z.output<typeof esquemaDoPedido>
export type DadosDaConferencia = z.output<typeof esquemaDaConferencia>

export function validarPedido(campos: {
  documento: string
}): ResultadoDeFormulario<DadosDoPedido> {
  const conferido = esquemaDoPedido.safeParse(campos)
  return conferido.success
    ? { ok: true, dados: conferido.data }
    : { ok: false, erros: errosPorCampo(conferido.error) }
}

export function validarConferencia(campos: {
  documento: string
  codigo: string
}): ResultadoDeFormulario<DadosDaConferencia> {
  const conferido = esquemaDaConferencia.safeParse(campos)
  return conferido.success
    ? { ok: true, dados: conferido.data }
    : { ok: false, erros: errosPorCampo(conferido.error) }
}

// ---------------------------------------------------------------------------
// O código em si
// ---------------------------------------------------------------------------

/**
 * Seis dígitos de `node:crypto`. `randomInt` sorteia sem o viés que
 * `Math.random() % 1000000` introduziria — e `Math.random` não serve para
 * segredo nenhum.
 */
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

type ClienteElegivel = { id: string; nome: string; email: string }

/**
 * Quem pode receber código: cliente que existe, com **contrato assinado**
 * (Anexo I, 1.d), com e-mail no cadastro e **ativo** (item 4 da lista de
 * melhorias — desativar não apaga nada, mas fecha a porta do portal, mesmo
 * padrão de `SituacaoUsuario` para a equipe). Devolve null para todo o resto,
 * sem dizer qual dos quatro motivos — quem chama não deve nem poder
 * distinguir "cliente inativo" de "documento nunca cadastrado".
 */
async function clienteElegivel(documento: string): Promise<ClienteElegivel | null> {
  const cliente = await prisma.cliente.findUnique({
    where: { documento },
    select: {
      id: true,
      nome: true,
      email: true,
      contratoAssinadoEm: true,
      situacao: true,
    },
  })

  if (cliente === null) return null
  if (cliente.situacao !== SituacaoCliente.ATIVO) return null
  if (cliente.contratoAssinadoEm === null) return null
  if (cliente.email === null || cliente.email.trim() === '') return null

  return { id: cliente.id, nome: cliente.nome, email: cliente.email.trim() }
}

/**
 * O `Usuario` de perfil CLIENTE que representa este cliente na sessão e na
 * auditoria. Idempotente: chamado ao registrar a assinatura e de novo a cada
 * entrada, para que nenhum cadastro fique sem porta.
 *
 * Sem e-mail de propósito — ver o comentário do campo no schema.
 */
export async function garantirUsuarioDoCliente(
  clienteId: string,
  nome: string,
): Promise<string> {
  const existente = await prisma.usuario.findFirst({
    where: { clienteId, perfil: PerfilUsuario.CLIENTE },
    select: { id: true, situacao: true },
  })

  if (existente !== null) {
    if (existente.situacao !== SituacaoUsuario.ATIVO) {
      await prisma.usuario.update({
        where: { id: existente.id },
        data: { situacao: SituacaoUsuario.ATIVO },
      })
    }
    return existente.id
  }

  const criado = await prisma.usuario.create({
    data: {
      nome,
      email: null,
      senhaHash: null,
      perfil: PerfilUsuario.CLIENTE,
      situacao: SituacaoUsuario.ATIVO,
      clienteId,
    },
    select: { id: true },
  })

  return criado.id
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

/**
 * Resposta única, de propósito. Não existe variante de sucesso nem de falha:
 * a tela mostra sempre o mesmo texto.
 */
export type ResultadoDoPedido = { situacao: 'pedido_registrado' }

export async function pedirCodigo(
  documento: string,
  origem: Origem = {},
): Promise<ResultadoDoPedido> {
  const agora = new Date()
  const enderecoIp = origem.enderecoIp ?? null
  const desde = new Date(agora.getTime() - JANELA_DE_PEDIDOS_MINUTOS * MS_POR_MINUTO)

  const excedeuOIp = (await pedidosRecentesDoIp(enderecoIp, desde)) >= PEDIDOS_POR_IP
  const cliente = excedeuOIp ? null : await clienteElegivel(documento)

  // Todo pedido entra na auditoria, inclusive o de documento que não é de
  // ninguém: é este registro que sustenta o limite por endereço, e é ele que
  // mostra, depois, que alguém varreu CPFs contra o portal.
  //
  // O documento tentado não é guardado quando não é de cliente — seria
  // acumular CPF de terceiro em log, sem utilidade e contra a LGPD.
  await registrarAuditoria({
    usuarioId: null,
    usuarioEmail: null,
    acao: AcaoAuditoria.AUTENTICACAO,
    entidade: ENTIDADE_DE_AUDITORIA,
    entidadeId: cliente?.id ?? null,
    detalhes: excedeuOIp
      ? { resultado: 'limite_por_endereco' }
      : { resultado: cliente === null ? 'sem_cliente_elegivel' : 'pedido' },
    enderecoIp,
    agenteUsuario: origem.agenteUsuario ?? null,
  })

  if (cliente === null) {
    // Mesmo tempo de resposta de um envio de verdade. Sem isto, a diferença
    // entrega quais documentos são de clientes.
    await gastarTempoDeVerificacao(documento)
    return { situacao: 'pedido_registrado' }
  }

  const recentes = await prisma.codigoDeAcesso.findMany({
    where: { clienteId: cliente.id, criadoEm: { gte: desde } },
    select: { id: true, criadoEm: true },
    orderBy: { criadoEm: 'desc' },
  })

  const ultimo = recentes[0]
  const cedoDemais =
    ultimo !== undefined &&
    agora.getTime() - ultimo.criadoEm.getTime() < SEGUNDOS_ENTRE_PEDIDOS * 1000

  if (cedoDemais || recentes.length >= PEDIDOS_POR_CLIENTE) {
    await gastarTempoDeVerificacao(documento)
    return { situacao: 'pedido_registrado' }
  }

  const codigo = gerarCodigo()
  const codigoHash = await gerarHashDeSenha(codigo)

  await prisma.$transaction([
    // Um código por vez: pedir outro mata o anterior. Dois códigos válidos ao
    // mesmo tempo dobrariam a chance de acerto de quem está chutando.
    prisma.codigoDeAcesso.updateMany({
      where: { clienteId: cliente.id, usadoEm: null, invalidadoEm: null },
      data: { invalidadoEm: agora },
    }),
    prisma.codigoDeAcesso.create({
      data: {
        clienteId: cliente.id,
        codigoHash,
        expiraEm: new Date(agora.getTime() + MINUTOS_DE_VALIDADE * MS_POR_MINUTO),
        enderecoIp,
        agenteUsuario: origem.agenteUsuario ?? null,
      },
    }),
  ])

  // O envio fica fora da transação e o resultado não muda a resposta: SMTP
  // fora do ar é problema do escritório, não informação para quem está do
  // outro lado da tela. A falha fica no log do servidor.
  await enviarEmail(
    mensagemDeCodigo(cliente.email, cliente.nome, codigo, MINUTOS_DE_VALIDADE),
  )

  return { situacao: 'pedido_registrado' }
}

// ---------------------------------------------------------------------------
// Conferir o código
// ---------------------------------------------------------------------------

export type ResultadoDaConferencia =
  | { situacao: 'confere'; usuarioId: string; clienteId: string; nome: string }
  /** Documento, código, validade, tentativas — tudo cai aqui. Um motivo só. */
  | { situacao: 'nao_confere' }

export async function conferirCodigo(
  documento: string,
  codigo: string,
  origem: Origem = {},
): Promise<ResultadoDaConferencia> {
  const agora = new Date()
  const cliente = await clienteElegivel(documento)

  if (cliente === null) {
    await gastarTempoDeVerificacao(codigo)
    await registrarFalha(null, origem)
    return { situacao: 'nao_confere' }
  }

  const pendente = await prisma.codigoDeAcesso.findFirst({
    where: {
      clienteId: cliente.id,
      usadoEm: null,
      invalidadoEm: null,
      expiraEm: { gt: agora },
    },
    orderBy: { criadoEm: 'desc' },
    select: { id: true, codigoHash: true, tentativas: true },
  })

  if (pendente === null) {
    await gastarTempoDeVerificacao(codigo)
    await registrarFalha(cliente.id, origem)
    return { situacao: 'nao_confere' }
  }

  if (await senhaConfere(codigo, pendente.codigoHash)) {
    const usuarioId = await garantirUsuarioDoCliente(cliente.id, cliente.nome)

    await prisma.$transaction([
      prisma.codigoDeAcesso.update({
        where: { id: pendente.id },
        data: { usadoEm: agora },
      }),
      prisma.usuario.update({
        where: { id: usuarioId },
        data: { ultimoAcessoEm: agora, tentativasFalhas: 0, bloqueadoAte: null },
      }),
    ])

    await registrarAuditoria({
      usuarioId,
      usuarioEmail: null,
      acao: AcaoAuditoria.AUTENTICACAO,
      entidade: ENTIDADE_DE_AUDITORIA,
      entidadeId: cliente.id,
      detalhes: { resultado: 'sucesso', clienteId: cliente.id },
      enderecoIp: origem.enderecoIp ?? null,
      agenteUsuario: origem.agenteUsuario ?? null,
    })

    return {
      situacao: 'confere',
      usuarioId,
      clienteId: cliente.id,
      nome: cliente.nome,
    }
  }

  const tentativas = pendente.tentativas + 1
  await prisma.codigoDeAcesso.update({
    where: { id: pendente.id },
    data: {
      tentativas,
      // Na quinta errada o código morre e o cliente precisa pedir outro. Sem
      // isto, seis dígitos caem em poucas horas de chute.
      invalidadoEm: tentativas >= TENTATIVAS_POR_CODIGO ? agora : null,
    },
  })

  await registrarFalha(cliente.id, origem, tentativas)
  return { situacao: 'nao_confere' }
}

async function registrarFalha(
  clienteId: string | null,
  origem: Origem,
  tentativas?: number,
): Promise<void> {
  await registrarAuditoria({
    usuarioId: null,
    usuarioEmail: null,
    acao: AcaoAuditoria.AUTENTICACAO,
    entidade: ENTIDADE_DE_AUDITORIA,
    entidadeId: clienteId,
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
