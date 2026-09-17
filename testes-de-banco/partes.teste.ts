/**
 * `criarParte`, `listarPartes`, `excluirParte` — o cadastro de quem assina um
 * documento avulso sem ser cliente do escritório (17/09/2026).
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PapelDaParte, PerfilUsuario } from '@prisma/client'

import { criarParte, excluirParte, listarPartes } from '@/lib/partes'
import { prisma } from '@/lib/prisma'

const EMAIL_DO_OPERADOR = 'operador.teste.partes@exemplo.invalido'
const EMAIL_DA_PARTE = 'testemunha.teste.partes@exemplo.invalido'

let operadorId: string

function sessaoDaEquipe() {
  return {
    usuarioId: operadorId,
    perfil: PerfilUsuario.OPERADOR,
    clienteId: null,
    contratoAssinado: false,
  }
}

async function limpar(): Promise<void> {
  await prisma.parte.deleteMany({ where: { email: EMAIL_DA_PARTE } })
  await prisma.usuario.deleteMany({ where: { email: EMAIL_DO_OPERADOR } })
}

beforeAll(async () => {
  await limpar()

  const operador = await prisma.usuario.create({
    data: {
      nome: 'Operador do teste de partes',
      email: EMAIL_DO_OPERADOR,
      senhaHash: 'nao-usado',
      perfil: PerfilUsuario.OPERADOR,
    },
    select: { id: true },
  })
  operadorId = operador.id
})

afterAll(async () => {
  await limpar()
  await prisma.$disconnect()
})

describe('cadastro de partes', () => {
  it('cria, lista e depois exclui', async () => {
    const criada = await criarParte(
      sessaoDaEquipe(),
      {
        nome: 'Testemunha de Teste',
        email: EMAIL_DA_PARTE,
        telefone: null,
        papel: PapelDaParte.TESTEMUNHA,
        observacoes: 'Testemunha do acordo de teste',
      },
      EMAIL_DO_OPERADOR,
    )

    const listadas = await listarPartes(sessaoDaEquipe())
    expect(listadas.some((parte) => parte.id === criada.id)).toBe(true)

    const auditoria = await prisma.auditoria.findFirst({
      where: { entidade: 'parte', entidadeId: criada.id, acao: 'CRIACAO' },
    })
    expect(auditoria).not.toBeNull()

    const excluida = await excluirParte(sessaoDaEquipe(), criada.id, EMAIL_DO_OPERADOR)
    expect(excluida).toBe(true)

    const depoisDeExcluir = await listarPartes(sessaoDaEquipe())
    expect(depoisDeExcluir.some((parte) => parte.id === criada.id)).toBe(false)

    const auditoriaDaExclusao = await prisma.auditoria.findFirst({
      where: { entidade: 'parte', entidadeId: criada.id, acao: 'EXCLUSAO' },
    })
    expect(auditoriaDaExclusao).not.toBeNull()
  })

  it('excluir uma parte que não existe devolve falso, sem lançar', async () => {
    const excluida = await excluirParte(sessaoDaEquipe(), 'id-que-nao-existe', EMAIL_DO_OPERADOR)
    expect(excluida).toBe(false)
  })
})
