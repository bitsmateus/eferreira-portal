/**
 * Eventos do caso — prazo e tarefa interna da equipe (05/10/2026), contra o
 * Postgres de verdade. Ver o comentário grande em `src/lib/eventos.ts` sobre
 * por que este módulo existe, fora do Anexo I/II original.
 *
 * O que importa conferir aqui: nenhuma sessão de perfil CLIENTE alcança
 * nada deste arquivo (`exigirEquipe` em toda função), o responsável é
 * sempre conferido contra a equipe ativa, e marcar/desmarcar o mesmo estado
 * duas vezes não duplica auditoria.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PerfilUsuario, SituacaoUsuario, TipoPessoa } from '@prisma/client'

import {
  criarEvento,
  definirCumprimentoDoEvento,
  excluirEvento,
  listarEventosDoCaso,
} from '@/lib/eventos'
import { SemAutorizacao } from '@/lib/autorizacao'
import { prisma } from '@/lib/prisma'

const DOCUMENTO_DO_CLIENTE = '96822487082'
const EMAIL_DO_OPERADOR = 'operador.teste.eventos@exemplo.invalido'
const EMAIL_DO_OPERADOR_INATIVO = 'operador.inativo.teste.eventos@exemplo.invalido'

let operadorId: string
let operadorInativoId: string
let clienteId: string

function sessaoDaEquipe() {
  return {
    usuarioId: operadorId,
    perfil: PerfilUsuario.OPERADOR,
    clienteId: null,
    contratoAssinado: false,
  }
}

function sessaoDoCliente() {
  return {
    usuarioId: 'qualquer',
    perfil: PerfilUsuario.CLIENTE,
    clienteId,
    contratoAssinado: true,
  }
}

function dados(troca: Partial<{ responsavelId: string; assunto: string; prazoDeEntrega: Date }> = {}) {
  return {
    responsavelId: operadorId,
    assunto: 'Protocolar recurso',
    prazoDeEntrega: new Date('2026-12-01T12:00:00Z'),
    ...troca,
  }
}

async function criarCaso() {
  return prisma.caso.create({
    data: { clienteId, assunto: 'Caso do teste de eventos' },
    select: { id: true },
  })
}

async function limpar(): Promise<void> {
  await prisma.cliente.deleteMany({ where: { documento: DOCUMENTO_DO_CLIENTE } })
  await prisma.usuario.deleteMany({
    where: { email: { in: [EMAIL_DO_OPERADOR, EMAIL_DO_OPERADOR_INATIVO] } },
  })
}

beforeAll(async () => {
  await limpar()

  const operador = await prisma.usuario.create({
    data: {
      nome: 'Operador do teste de eventos',
      email: EMAIL_DO_OPERADOR,
      senhaHash: 'nao-usado',
      perfil: PerfilUsuario.OPERADOR,
    },
    select: { id: true },
  })
  operadorId = operador.id

  const operadorInativo = await prisma.usuario.create({
    data: {
      nome: 'Operador inativo do teste de eventos',
      email: EMAIL_DO_OPERADOR_INATIVO,
      senhaHash: 'nao-usado',
      perfil: PerfilUsuario.OPERADOR,
      situacao: SituacaoUsuario.INATIVO,
    },
    select: { id: true },
  })
  operadorInativoId = operadorInativo.id

  const cliente = await prisma.cliente.create({
    data: {
      documento: DOCUMENTO_DO_CLIENTE,
      nome: 'Cliente do teste de eventos',
      nomeBusca: 'cliente do teste de eventos',
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

describe('criarEvento', () => {
  it('a sessão do cliente não cria evento nenhum', async () => {
    const caso = await criarCaso()

    await expect(
      criarEvento(sessaoDoCliente(), caso.id, dados(), null),
    ).rejects.toBeInstanceOf(SemAutorizacao)
  })

  it('caso que a sessão não enxerga devolve não encontrado', async () => {
    const resultado = await criarEvento(
      sessaoDaEquipe(),
      'id-que-nao-existe',
      dados(),
      EMAIL_DO_OPERADOR,
    )
    expect(resultado.situacao).toBe('caso_nao_encontrado')
  })

  it('responsável inativo é recusado', async () => {
    const caso = await criarCaso()

    const resultado = await criarEvento(
      sessaoDaEquipe(),
      caso.id,
      dados({ responsavelId: operadorInativoId }),
      EMAIL_DO_OPERADOR,
    )
    expect(resultado.situacao).toBe('responsavel_invalido')
  })

  it('responsável inexistente é recusado', async () => {
    const caso = await criarCaso()

    const resultado = await criarEvento(
      sessaoDaEquipe(),
      caso.id,
      dados({ responsavelId: 'id-que-nao-existe' }),
      EMAIL_DO_OPERADOR,
    )
    expect(resultado.situacao).toBe('responsavel_invalido')
  })

  it('cria o evento e audita a criação, com o id de quem criou', async () => {
    const caso = await criarCaso()

    const resultado = await criarEvento(sessaoDaEquipe(), caso.id, dados(), EMAIL_DO_OPERADOR)
    expect(resultado.situacao).toBe('criado')
    if (resultado.situacao !== 'criado') return

    const evento = await prisma.evento.findUniqueOrThrow({ where: { id: resultado.eventoId } })
    expect(evento.casoId).toBe(caso.id)
    expect(evento.responsavelId).toBe(operadorId)
    expect(evento.criadoPorId).toBe(operadorId)
    expect(evento.cumpridoEm).toBeNull()

    const auditoria = await prisma.auditoria.findFirst({
      where: { entidade: 'evento', entidadeId: resultado.eventoId, acao: 'CRIACAO' },
    })
    expect(auditoria).not.toBeNull()
    expect(auditoria?.usuarioEmail).toBe(EMAIL_DO_OPERADOR)
  })
})

describe('listarEventosDoCaso', () => {
  it('a sessão do cliente não lista evento nenhum', async () => {
    const caso = await criarCaso()

    await expect(
      listarEventosDoCaso(sessaoDoCliente(), caso.id),
    ).rejects.toBeInstanceOf(SemAutorizacao)
  })

  it('pendente aparece antes de cumprido, e pelo prazo mais próximo primeiro', async () => {
    const caso = await criarCaso()

    const maisLonge = await criarEvento(
      sessaoDaEquipe(),
      caso.id,
      dados({ assunto: 'Prazo mais longe', prazoDeEntrega: new Date('2026-12-20T12:00:00Z') }),
      EMAIL_DO_OPERADOR,
    )
    const maisProximo = await criarEvento(
      sessaoDaEquipe(),
      caso.id,
      dados({ assunto: 'Prazo mais próximo', prazoDeEntrega: new Date('2026-12-05T12:00:00Z') }),
      EMAIL_DO_OPERADOR,
    )
    const jaCumprido = await criarEvento(
      sessaoDaEquipe(),
      caso.id,
      dados({ assunto: 'Já cumprido', prazoDeEntrega: new Date('2026-11-01T12:00:00Z') }),
      EMAIL_DO_OPERADOR,
    )
    if (
      maisLonge.situacao !== 'criado' ||
      maisProximo.situacao !== 'criado' ||
      jaCumprido.situacao !== 'criado'
    ) {
      throw new Error('setup falhou')
    }
    await definirCumprimentoDoEvento(sessaoDaEquipe(), jaCumprido.eventoId, true, EMAIL_DO_OPERADOR)

    const lista = await listarEventosDoCaso(sessaoDaEquipe(), caso.id)

    expect(lista.map((evento) => evento.assunto)).toEqual([
      'Prazo mais próximo',
      'Prazo mais longe',
      'Já cumprido',
    ])
  })
})

describe('definirCumprimentoDoEvento', () => {
  it('evento que não existe devolve não encontrado', async () => {
    const resultado = await definirCumprimentoDoEvento(
      sessaoDaEquipe(),
      'id-que-nao-existe',
      true,
      EMAIL_DO_OPERADOR,
    )
    expect(resultado.situacao).toBe('nao_encontrado')
  })

  it('marca como cumprido e audita', async () => {
    const caso = await criarCaso()
    const criado = await criarEvento(sessaoDaEquipe(), caso.id, dados(), EMAIL_DO_OPERADOR)
    if (criado.situacao !== 'criado') throw new Error('setup falhou')

    const resultado = await definirCumprimentoDoEvento(
      sessaoDaEquipe(),
      criado.eventoId,
      true,
      EMAIL_DO_OPERADOR,
    )
    expect(resultado.situacao).toBe('atualizado')

    const evento = await prisma.evento.findUniqueOrThrow({ where: { id: criado.eventoId } })
    expect(evento.cumpridoEm).not.toBeNull()

    const auditoria = await prisma.auditoria.findFirst({
      where: { entidade: 'evento', entidadeId: criado.eventoId, acao: 'ATUALIZACAO' },
    })
    expect(auditoria).not.toBeNull()
  })

  // Marcar de novo o que já está cumprido não é fato novo — mesmo padrão de
  // `encerraOCaso` em `andamentos.ts`.
  it('marcar de novo o que já está cumprido não duplica auditoria', async () => {
    const caso = await criarCaso()
    const criado = await criarEvento(sessaoDaEquipe(), caso.id, dados(), EMAIL_DO_OPERADOR)
    if (criado.situacao !== 'criado') throw new Error('setup falhou')

    await definirCumprimentoDoEvento(sessaoDaEquipe(), criado.eventoId, true, EMAIL_DO_OPERADOR)
    await definirCumprimentoDoEvento(sessaoDaEquipe(), criado.eventoId, true, EMAIL_DO_OPERADOR)

    const quantas = await prisma.auditoria.count({
      where: { entidade: 'evento', entidadeId: criado.eventoId, acao: 'ATUALIZACAO' },
    })
    expect(quantas).toBe(1)
  })

  it('reabre o evento cumprido', async () => {
    const caso = await criarCaso()
    const criado = await criarEvento(sessaoDaEquipe(), caso.id, dados(), EMAIL_DO_OPERADOR)
    if (criado.situacao !== 'criado') throw new Error('setup falhou')

    await definirCumprimentoDoEvento(sessaoDaEquipe(), criado.eventoId, true, EMAIL_DO_OPERADOR)
    await definirCumprimentoDoEvento(sessaoDaEquipe(), criado.eventoId, false, EMAIL_DO_OPERADOR)

    const evento = await prisma.evento.findUniqueOrThrow({ where: { id: criado.eventoId } })
    expect(evento.cumpridoEm).toBeNull()
  })
})

describe('excluirEvento', () => {
  it('evento que não existe devolve não encontrado', async () => {
    const resultado = await excluirEvento(sessaoDaEquipe(), 'id-que-nao-existe', EMAIL_DO_OPERADOR)
    expect(resultado.situacao).toBe('nao_encontrado')
  })

  it('exclui e audita, com o assunto guardado no registro', async () => {
    const caso = await criarCaso()
    const criado = await criarEvento(
      sessaoDaEquipe(),
      caso.id,
      dados({ assunto: 'Evento a ser excluído' }),
      EMAIL_DO_OPERADOR,
    )
    if (criado.situacao !== 'criado') throw new Error('setup falhou')

    const resultado = await excluirEvento(sessaoDaEquipe(), criado.eventoId, EMAIL_DO_OPERADOR)
    expect(resultado.situacao).toBe('excluido')

    expect(await prisma.evento.findUnique({ where: { id: criado.eventoId } })).toBeNull()

    const auditoria = await prisma.auditoria.findFirst({
      where: { entidade: 'evento', entidadeId: criado.eventoId, acao: 'EXCLUSAO' },
    })
    expect(auditoria).not.toBeNull()
    expect(JSON.stringify(auditoria?.detalhes)).toContain('Evento a ser excluído')
  })
})
