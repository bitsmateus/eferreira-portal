/**
 * "Este andamento encerra o caso" — a caixinha do formulário de andamento,
 * contra o Postgres de verdade. Pedido do escritório (17/09/2026): arquivar o
 * caso no mesmo passo de lançar o andamento, em vez de precisar abrir
 * "Editar" depois só para trocar a situação.
 *
 * O que importa aqui é o efeito em cascata: o caso muda de EM_ANDAMENTO para
 * ARQUIVADO dentro da MESMA transação do andamento, e fica registrado na
 * auditoria (regra 6) de um jeito que se distingue de uma edição manual.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PerfilUsuario, SituacaoCaso, TipoPessoa } from '@prisma/client'

import { lancarAndamento } from '@/lib/andamentos'
import { prisma } from '@/lib/prisma'

const DOCUMENTO_DO_CLIENTE = '11144477735'
const EMAIL_DO_OPERADOR = 'operador.teste.encerrar.caso@exemplo.invalido'
const NOME_DO_STATUS = 'Situação do teste de encerrar caso'

let operadorId: string
let statusId: string
let clienteId: string

function sessaoDaEquipe() {
  return {
    usuarioId: operadorId,
    perfil: PerfilUsuario.OPERADOR,
    clienteId: null,
    contratoAssinado: false,
  }
}

function dados(encerraOCaso: boolean) {
  return {
    data: new Date(),
    statusId,
    statusPersonalizado: '',
    descricao: 'Descrição de teste, com mais de dez caracteres.',
    encerraOCaso,
  }
}

async function criarCaso() {
  return prisma.caso.create({
    data: { clienteId, assunto: 'Caso do teste de encerrar caso' },
    select: { id: true, situacao: true },
  })
}

async function limpar(): Promise<void> {
  await prisma.cliente.deleteMany({ where: { documento: DOCUMENTO_DO_CLIENTE } })
  await prisma.usuario.deleteMany({ where: { email: EMAIL_DO_OPERADOR } })
  await prisma.statusAndamento.deleteMany({ where: { nome: NOME_DO_STATUS } })
}

beforeAll(async () => {
  await limpar()

  const operador = await prisma.usuario.create({
    data: {
      nome: 'Operador do teste de encerrar caso',
      email: EMAIL_DO_OPERADOR,
      senhaHash: 'nao-usado',
      perfil: PerfilUsuario.OPERADOR,
    },
    select: { id: true },
  })
  operadorId = operador.id

  const status = await prisma.statusAndamento.create({
    data: { nome: NOME_DO_STATUS },
    select: { id: true },
  })
  statusId = status.id

  const cliente = await prisma.cliente.create({
    data: {
      documento: DOCUMENTO_DO_CLIENTE,
      nome: 'Cliente do teste de encerrar caso',
      nomeBusca: 'cliente do teste de encerrar caso',
      tipoPessoa: TipoPessoa.FISICA,
      cidade: 'São Paulo',
      uf: 'SP',
    },
    select: { id: true },
  })
  clienteId = cliente.id
})

afterAll(async () => {
  await limpar()
  await prisma.$disconnect()
})

describe('encerraOCaso ao lançar andamento', () => {
  it('marcado: arquiva o caso e audita a mudança', async () => {
    const caso = await criarCaso()
    expect(caso.situacao).toBe(SituacaoCaso.EM_ANDAMENTO)

    const resultado = await lancarAndamento(
      sessaoDaEquipe(),
      caso.id,
      dados(true),
      EMAIL_DO_OPERADOR,
    )
    expect(resultado.situacao).toBe('lancado')

    const casoDepois = await prisma.caso.findUniqueOrThrow({ where: { id: caso.id } })
    expect(casoDepois.situacao).toBe(SituacaoCaso.ARQUIVADO)

    const auditoria = await prisma.auditoria.findFirst({
      where: { entidade: 'caso', entidadeId: caso.id, acao: 'ATUALIZACAO' },
      orderBy: { criadoEm: 'desc' },
    })
    expect(auditoria).not.toBeNull()
    expect(JSON.stringify(auditoria?.detalhes)).toContain('encerrado_junto_com_o_andamento')
  })

  it('desmarcado: não mexe na situação do caso', async () => {
    const caso = await criarCaso()

    const resultado = await lancarAndamento(
      sessaoDaEquipe(),
      caso.id,
      dados(false),
      EMAIL_DO_OPERADOR,
    )
    expect(resultado.situacao).toBe('lancado')

    const casoDepois = await prisma.caso.findUniqueOrThrow({ where: { id: caso.id } })
    expect(casoDepois.situacao).toBe(SituacaoCaso.EM_ANDAMENTO)

    const auditoria = await prisma.auditoria.findFirst({
      where: { entidade: 'caso', entidadeId: caso.id, acao: 'ATUALIZACAO' },
    })
    expect(auditoria).toBeNull()
  })

  // Marcar de novo um caso já arquivado não é fato novo: sem isto, cada
  // andamento lançado num caso encerrado criaria um registro de auditoria
  // repetindo a mesma mudança que já tinha acontecido.
  it('caso já arquivado: não grava um segundo registro de auditoria', async () => {
    const caso = await criarCaso()

    await lancarAndamento(sessaoDaEquipe(), caso.id, dados(true), EMAIL_DO_OPERADOR)
    await lancarAndamento(sessaoDaEquipe(), caso.id, dados(true), EMAIL_DO_OPERADOR)

    const casoDepois = await prisma.caso.findUniqueOrThrow({ where: { id: caso.id } })
    expect(casoDepois.situacao).toBe(SituacaoCaso.ARQUIVADO)

    const quantos = await prisma.auditoria.count({
      where: { entidade: 'caso', entidadeId: caso.id, acao: 'ATUALIZACAO' },
    })
    expect(quantos).toBe(1)
  })
})
