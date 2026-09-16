/**
 * A exclusão de caso, contra o Postgres de verdade.
 *
 * Mesmo desenho de `exclusao-de-cliente.teste.ts`: o que importa é a RECUSA.
 * Caso sem nada dentro sai fácil; caso com andamento ou documento é recusado,
 * porque ali existe histórico de processo e prova de diligência.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PerfilUsuario, TipoDocumento, TipoPessoa } from '@prisma/client'

import { excluirCaso } from '@/lib/casos'
import { SemAutorizacao } from '@/lib/autorizacao'
import { prisma } from '@/lib/prisma'

const DOCUMENTO_DO_CLIENTE = '52998224725'
const EMAIL_DO_OPERADOR = 'operador.teste.exclusao.caso@exemplo.invalido'
const NOME_DO_STATUS = 'Situação do teste de exclusão de caso'

let operadorId: string
let clienteId: string
let statusId: string

function sessaoDaEquipe() {
  return {
    usuarioId: operadorId,
    perfil: PerfilUsuario.OPERADOR,
    clienteId: null,
    contratoAssinado: false,
  }
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
      nome: 'Operador do teste de exclusão de caso',
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
      nome: 'Cliente do teste de exclusão de caso',
      nomeBusca: 'cliente do teste de exclusao de caso',
      tipoPessoa: TipoPessoa.FISICA,
      cidade: 'São Paulo',
      uf: 'SP',
    },
    select: { id: true },
  })
  clienteId = cliente.id

  const status = await prisma.statusAndamento.create({
    data: { nome: NOME_DO_STATUS },
    select: { id: true },
  })
  statusId = status.id
})

afterAll(async () => {
  await limpar()
  await prisma.$disconnect()
})

describe('quem pode excluir', () => {
  it('a sessão do cliente não exclui caso nenhum', async () => {
    const caso = await prisma.caso.create({
      data: { clienteId, assunto: 'Caso vazio' },
      select: { id: true },
    })

    await expect(
      excluirCaso(
        {
          usuarioId: 'qualquer',
          perfil: PerfilUsuario.CLIENTE,
          clienteId,
          contratoAssinado: true,
        },
        caso.id,
        null,
      ),
    ).rejects.toBeInstanceOf(SemAutorizacao)

    await prisma.caso.delete({ where: { id: caso.id } })
  })

  it('id que não existe devolve não encontrado', async () => {
    const resultado = await excluirCaso(
      sessaoDaEquipe(),
      'id-que-nao-existe',
      EMAIL_DO_OPERADOR,
    )
    expect(resultado.situacao).toBe('nao_encontrado')
  })
})

describe('o caso feito por engano sai', () => {
  it('caso sem andamento e sem documento é excluído', async () => {
    const caso = await prisma.caso.create({
      data: { clienteId, assunto: 'Cadastrado por engano' },
      select: { id: true },
    })

    const resultado = await excluirCaso(sessaoDaEquipe(), caso.id, EMAIL_DO_OPERADOR)

    expect(resultado.situacao).toBe('excluido')
    expect(await prisma.caso.findUnique({ where: { id: caso.id } })).toBeNull()
  })

  // As parcelas são dado do próprio caso, não histórico de nada.
  it('as parcelas de honorários somem junto, por cascata', async () => {
    const caso = await prisma.caso.create({
      data: { clienteId, assunto: 'Com parcelas' },
      select: { id: true },
    })
    const parcela = await prisma.parcelaDeHonorarios.create({
      data: {
        casoId: caso.id,
        numero: 1,
        valorEmCentavos: 100000,
        vencimento: new Date(),
      },
      select: { id: true },
    })

    const resultado = await excluirCaso(sessaoDaEquipe(), caso.id, EMAIL_DO_OPERADOR)

    expect(resultado.situacao).toBe('excluido')
    expect(
      await prisma.parcelaDeHonorarios.findUnique({ where: { id: parcela.id } }),
    ).toBeNull()
  })

  it('a auditoria guarda assunto e número em texto', async () => {
    const caso = await prisma.caso.create({
      data: { clienteId, assunto: 'Some mas fica no registro', numeroProcesso: null },
      select: { id: true },
    })

    await excluirCaso(sessaoDaEquipe(), caso.id, EMAIL_DO_OPERADOR)

    const registro = await prisma.auditoria.findFirst({
      where: { entidade: 'caso', entidadeId: caso.id, acao: 'EXCLUSAO' },
      orderBy: { criadoEm: 'desc' },
    })

    expect(registro).not.toBeNull()
    expect(JSON.stringify(registro?.detalhes)).toContain('Some mas fica no registro')
  })
})

describe('o que tem rastro não sai', () => {
  it('caso com andamento é recusado', async () => {
    const caso = await prisma.caso.create({
      data: { clienteId, assunto: 'Com andamento' },
      select: { id: true },
    })
    await prisma.andamento.create({
      data: {
        casoId: caso.id,
        data: new Date(),
        statusId,
        descricao: 'Petição protocolada e aguardando decisão.',
        autorId: operadorId,
      },
    })

    const resultado = await excluirCaso(sessaoDaEquipe(), caso.id, EMAIL_DO_OPERADOR)

    expect(resultado.situacao).toBe('tem_historico')
    if (resultado.situacao === 'tem_historico') {
      expect(resultado.andamentos).toBe(1)
      expect(resultado.documentos).toBe(0)
    }
    expect(await prisma.caso.findUnique({ where: { id: caso.id } })).not.toBeNull()
  })

  it('caso com documento é recusado', async () => {
    const caso = await prisma.caso.create({
      data: { clienteId, assunto: 'Com documento' },
      select: { id: true },
    })
    await prisma.documento.create({
      data: {
        clienteId,
        casoId: caso.id,
        tipo: TipoDocumento.CONTRATO,
        nome: 'Contrato.pdf',
        chaveArquivo: `documentos/teste-exclusao-caso-${Date.now()}`,
        tipoConteudo: 'application/pdf',
        tamanhoBytes: 10,
      },
    })

    const resultado = await excluirCaso(sessaoDaEquipe(), caso.id, EMAIL_DO_OPERADOR)

    expect(resultado.situacao).toBe('tem_historico')
    if (resultado.situacao === 'tem_historico') {
      expect(resultado.documentos).toBe(1)
    }
    expect(await prisma.caso.findUnique({ where: { id: caso.id } })).not.toBeNull()
  })
})
