/**
 * A situação personalizada do andamento, contra o Postgres de verdade.
 *
 * O que importa aqui é o efeito no banco: o texto digitado vira uma linha
 * NOVA em `StatusAndamento` — e continua sendo a MESMA linha da próxima vez
 * que alguém digitar o texto de novo, mesmo com maiúsculas diferentes. Sem
 * isso a lista do escritório enche de quase-duplicados que ninguém percebe
 * até já ter acontecido.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PerfilUsuario, TipoPessoa } from '@prisma/client'

import { SENTINELA_STATUS_PERSONALIZADO, lancarAndamento } from '@/lib/andamentos'
import { prisma } from '@/lib/prisma'

const DOCUMENTO_DO_CLIENTE = '52998224725'
const EMAIL_DO_OPERADOR = 'operador.teste.status.personalizado@exemplo.invalido'
const NOME_DO_STATUS_NOVO = 'Aguardando perícia do teste'

let operadorId: string
let casoId: string

function sessaoDaEquipe() {
  return {
    usuarioId: operadorId,
    perfil: PerfilUsuario.OPERADOR,
    clienteId: null,
    contratoAssinado: false,
  }
}

function dados(statusId: string, statusPersonalizado = '') {
  return {
    data: new Date(),
    statusId,
    statusPersonalizado,
    descricao: 'Descrição de teste, com mais de dez caracteres.',
  }
}

async function limpar(): Promise<void> {
  await prisma.cliente.deleteMany({ where: { documento: DOCUMENTO_DO_CLIENTE } })
  await prisma.usuario.deleteMany({ where: { email: EMAIL_DO_OPERADOR } })
  await prisma.statusAndamento.deleteMany({
    where: { nome: { equals: NOME_DO_STATUS_NOVO, mode: 'insensitive' } },
  })
}

beforeAll(async () => {
  await limpar()

  const operador = await prisma.usuario.create({
    data: {
      nome: 'Operador do teste de status personalizado',
      email: EMAIL_DO_OPERADOR,
      senhaHash: 'nao-usado',
      perfil: PerfilUsuario.OPERADOR,
    },
    select: { id: true },
  })
  operadorId = operador.id

  const cliente = await prisma.cliente.create({
    data: {
      documento: DOCUMENTO_DO_CLIENTE,
      nome: 'Cliente do teste de status personalizado',
      nomeBusca: 'cliente do teste de status personalizado',
      tipoPessoa: TipoPessoa.FISICA,
      cidade: 'São Paulo',
      uf: 'SP',
    },
    select: { id: true },
  })

  const caso = await prisma.caso.create({
    data: { clienteId: cliente.id, assunto: 'Caso do teste de status personalizado' },
    select: { id: true },
  })
  casoId = caso.id
})

afterAll(async () => {
  await limpar()
  await prisma.$disconnect()
})

describe('lancarAndamento com situação personalizada', () => {
  it('cria uma StatusAndamento nova a partir do texto digitado', async () => {
    const antes = await prisma.statusAndamento.count({
      where: { nome: { equals: NOME_DO_STATUS_NOVO, mode: 'insensitive' } },
    })
    expect(antes).toBe(0)

    const resultado = await lancarAndamento(
      sessaoDaEquipe(),
      casoId,
      dados(SENTINELA_STATUS_PERSONALIZADO, NOME_DO_STATUS_NOVO),
      EMAIL_DO_OPERADOR,
    )

    expect(resultado.situacao).toBe('lancado')

    const criado = await prisma.statusAndamento.findFirst({
      where: { nome: NOME_DO_STATUS_NOVO },
    })
    expect(criado).not.toBeNull()
    expect(criado?.ativo).toBe(true)
  })

  // O mesmo texto, com maiúsculas diferentes, é a MESMA situação — não pode
  // virar uma segunda linha na lista do escritório.
  it('reaproveita a mesma linha para o mesmo texto em maiúsculas diferentes', async () => {
    const antes = await prisma.statusAndamento.count({
      where: { nome: { equals: NOME_DO_STATUS_NOVO, mode: 'insensitive' } },
    })

    const resultado = await lancarAndamento(
      sessaoDaEquipe(),
      casoId,
      dados(SENTINELA_STATUS_PERSONALIZADO, NOME_DO_STATUS_NOVO.toUpperCase()),
      EMAIL_DO_OPERADOR,
    )

    expect(resultado.situacao).toBe('lancado')

    const depois = await prisma.statusAndamento.count({
      where: { nome: { equals: NOME_DO_STATUS_NOVO, mode: 'insensitive' } },
    })
    expect(depois).toBe(antes)

    // E o andamento aponta para a linha reaproveitada, não para uma nova.
    if (resultado.situacao === 'lancado') {
      const andamento = await prisma.andamento.findUnique({
        where: { id: resultado.andamentoId },
        select: { status: { select: { nome: true } } },
      })
      expect(andamento?.status?.nome).toBe(NOME_DO_STATUS_NOVO)
    }
  })

  it('recusa a sentinela sem texto', async () => {
    // Chega aqui só se alguém pular a validação do formulário — o servidor
    // não pode confiar cegamente no que vier.
    const resultado = await lancarAndamento(
      sessaoDaEquipe(),
      casoId,
      dados(SENTINELA_STATUS_PERSONALIZADO, ''),
      EMAIL_DO_OPERADOR,
    )

    expect(resultado.situacao).toBe('status_invalido')
  })
})
