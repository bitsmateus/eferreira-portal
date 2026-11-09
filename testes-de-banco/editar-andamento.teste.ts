/**
 * Corrigir um andamento já lançado (14/10/2026) — pedido do escritório: uma
 * movimentação foi gravada com a data errada. Contra o Postgres de verdade.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PerfilUsuario, TipoPessoa } from '@prisma/client'

import { editarAndamento, excluirAndamento, lancarAndamento } from '@/lib/andamentos'
import { prisma } from '@/lib/prisma'

const DOCUMENTO_DO_CLIENTE = '52998224725'
const EMAIL_DO_OPERADOR = 'operador.teste.editar.andamento@exemplo.invalido'
const NOME_DO_STATUS = 'Situação do teste de editar andamento'
const NOME_DO_OUTRO_STATUS = 'Outra situação do teste de editar andamento'

let operadorId: string
let statusId: string
let outroStatusId: string
let clienteId: string

function sessaoDaEquipe() {
  return {
    usuarioId: operadorId,
    perfil: PerfilUsuario.OPERADOR,
    clienteId: null,
    contratoAssinado: false,
  }
}

function dados(troca: Partial<{ data: Date; statusId: string; descricao: string }> = {}) {
  return {
    data: new Date('2026-10-01T12:00:00Z'),
    statusId,
    statusPersonalizado: '',
    descricao: 'Descrição de teste, com mais de dez caracteres.',
    encerraOCaso: false,
    ...troca,
  }
}

async function andamentoLancado() {
  const caso = await prisma.caso.create({
    data: { clienteId, assunto: 'Caso do teste de editar andamento' },
    select: { id: true },
  })
  const lancado = await lancarAndamento(sessaoDaEquipe(), caso.id, dados(), EMAIL_DO_OPERADOR)
  if (lancado.situacao !== 'lancado') throw new Error('não lançou')
  return { casoId: caso.id, andamentoId: lancado.andamentoId }
}

async function limpar(): Promise<void> {
  await prisma.cliente.deleteMany({ where: { documento: DOCUMENTO_DO_CLIENTE } })
  await prisma.usuario.deleteMany({ where: { email: EMAIL_DO_OPERADOR } })
  await prisma.statusAndamento.deleteMany({
    where: { nome: { in: [NOME_DO_STATUS, NOME_DO_OUTRO_STATUS] } },
  })
}

beforeAll(async () => {
  await limpar()

  const operador = await prisma.usuario.create({
    data: {
      nome: 'Operador do teste de editar andamento',
      email: EMAIL_DO_OPERADOR,
      senhaHash: 'nao-usado',
      perfil: PerfilUsuario.OPERADOR,
    },
    select: { id: true },
  })
  operadorId = operador.id

  statusId = (
    await prisma.statusAndamento.create({ data: { nome: NOME_DO_STATUS }, select: { id: true } })
  ).id
  outroStatusId = (
    await prisma.statusAndamento.create({
      data: { nome: NOME_DO_OUTRO_STATUS },
      select: { id: true },
    })
  ).id

  clienteId = (
    await prisma.cliente.create({
      data: {
        documento: DOCUMENTO_DO_CLIENTE,
        nome: 'Cliente do teste de editar andamento',
        nomeBusca: 'cliente do teste de editar andamento',
        tipoPessoa: TipoPessoa.FISICA,
        cidade: 'São Paulo',
        uf: 'SP',
      },
      select: { id: true },
    })
  ).id
})

afterAll(async () => {
  await limpar()
  await prisma.$disconnect()
})

describe('editarAndamento', () => {
  it('corrige a data, mantém o autor e audita o antes e o depois', async () => {
    const { andamentoId } = await andamentoLancado()
    const nova = new Date('2026-09-28T12:00:00Z')

    const resultado = await editarAndamento(
      sessaoDaEquipe(),
      andamentoId,
      dados({ data: nova }),
      EMAIL_DO_OPERADOR,
    )
    expect(resultado.situacao).toBe('atualizado')

    const depois = await prisma.andamento.findUniqueOrThrow({ where: { id: andamentoId } })
    expect(depois.data.toISOString()).toBe(nova.toISOString())
    expect(depois.autorId).toBe(operadorId)

    const auditoria = await prisma.auditoria.findFirst({
      where: { entidade: 'andamento', entidadeId: andamentoId, acao: 'ATUALIZACAO' },
    })
    const texto = JSON.stringify(auditoria?.detalhes)
    expect(texto).toContain('2026-10-01')
    expect(texto).toContain('2026-09-28')
  })

  it('troca a situação e a descrição', async () => {
    const { andamentoId } = await andamentoLancado()

    await editarAndamento(
      sessaoDaEquipe(),
      andamentoId,
      dados({ statusId: outroStatusId, descricao: 'Texto corrigido pelo operador.' }),
      EMAIL_DO_OPERADOR,
    )

    const depois = await prisma.andamento.findUniqueOrThrow({ where: { id: andamentoId } })
    expect(depois.statusId).toBe(outroStatusId)
    expect(depois.descricao).toBe('Texto corrigido pelo operador.')
  })

  it('não grava nem audita quando nada mudou', async () => {
    const { andamentoId } = await andamentoLancado()

    const resultado = await editarAndamento(sessaoDaEquipe(), andamentoId, dados(), EMAIL_DO_OPERADOR)
    expect(resultado.situacao).toBe('atualizado')

    const auditoria = await prisma.auditoria.findFirst({
      where: { entidade: 'andamento', entidadeId: andamentoId, acao: 'ATUALIZACAO' },
    })
    expect(auditoria).toBeNull()
  })

  it('recusa situação inexistente', async () => {
    const { andamentoId } = await andamentoLancado()

    const resultado = await editarAndamento(
      sessaoDaEquipe(),
      andamentoId,
      dados({ statusId: 'nao-existe' }),
      EMAIL_DO_OPERADOR,
    )
    expect(resultado.situacao).toBe('status_invalido')
  })

  it('andamento inexistente', async () => {
    const resultado = await editarAndamento(
      sessaoDaEquipe(),
      'nao-existe',
      dados(),
      EMAIL_DO_OPERADOR,
    )
    expect(resultado.situacao).toBe('nao_encontrado')
  })

  it('recusa sessão de cliente', async () => {
    const { andamentoId } = await andamentoLancado()

    await expect(
      editarAndamento(
        { usuarioId: operadorId, perfil: PerfilUsuario.CLIENTE, clienteId, contratoAssinado: true },
        andamentoId,
        dados(),
        null,
      ),
    ).rejects.toThrow()
  })
})

describe('excluirAndamento', () => {
  it('apaga o andamento e guarda o conteúdo na auditoria', async () => {
    const { casoId, andamentoId } = await andamentoLancado()

    const resultado = await excluirAndamento(sessaoDaEquipe(), andamentoId, EMAIL_DO_OPERADOR)
    expect(resultado.situacao).toBe('excluido')

    expect(await prisma.andamento.findUnique({ where: { id: andamentoId } })).toBeNull()
    expect(await prisma.caso.findUnique({ where: { id: casoId } })).not.toBeNull()

    const auditoria = await prisma.auditoria.findFirst({
      where: { entidade: 'andamento', entidadeId: andamentoId, acao: 'EXCLUSAO' },
    })
    expect(auditoria?.usuarioId).toBe(operadorId)
    expect(JSON.stringify(auditoria?.detalhes)).toContain('Descrição de teste')
  })

  it('andamento inexistente', async () => {
    const resultado = await excluirAndamento(sessaoDaEquipe(), 'nao-existe', EMAIL_DO_OPERADOR)
    expect(resultado.situacao).toBe('nao_encontrado')
  })

  it('recusa sessão de cliente', async () => {
    const { andamentoId } = await andamentoLancado()

    await expect(
      excluirAndamento(
        { usuarioId: operadorId, perfil: PerfilUsuario.CLIENTE, clienteId, contratoAssinado: true },
        andamentoId,
        null,
      ),
    ).rejects.toThrow()
    expect(await prisma.andamento.findUnique({ where: { id: andamentoId } })).not.toBeNull()
  })
})
