/**
 * A exclusão de cliente, contra o Postgres de verdade.
 *
 * O que está sendo provado é a RECUSA. Apagar um cadastro feito por engano é
 * fácil; o que não pode acontecer é apagar cliente que já tem documento,
 * andamento ou contrato assinado — ali existe prova de diligência e histórico
 * de processo, e num escritório de advocacia isso não some com dois cliques.
 *
 * Contra o banco de verdade porque o que interessa é o efeito em cascata: o
 * que o Prisma leva junto quando a linha do cliente cai.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PerfilUsuario, TipoDocumento, TipoPessoa } from '@prisma/client'

import { excluirCliente } from '@/lib/clientes'
import { SemAutorizacao } from '@/lib/autorizacao'
import { prisma } from '@/lib/prisma'

const VAZIO = '52998224725'
const COM_DOCUMENTO = '11144477735'
const COM_ANDAMENTO = '11222333000181'
const COM_CONTRATO = '39053344705'
const COM_TUDO_FORCADO = '11144477896'
const DOCUMENTOS = [VAZIO, COM_DOCUMENTO, COM_ANDAMENTO, COM_CONTRATO, COM_TUDO_FORCADO]
const EMAIL_DO_OPERADOR = 'operador.teste.exclusao@exemplo.invalido'
const EMAIL_DO_ADMINISTRADOR = 'administrador.teste.exclusao@exemplo.invalido'
const NOME_DO_STATUS = 'Situação do teste de exclusão'

let operadorId: string
let administradorId: string
let statusId: string

function sessaoDaEquipe() {
  return {
    usuarioId: operadorId,
    perfil: PerfilUsuario.OPERADOR,
    clienteId: null,
    contratoAssinado: false,
  }
}

function sessaoDoAdministrador() {
  return {
    usuarioId: administradorId,
    perfil: PerfilUsuario.ADMINISTRADOR,
    clienteId: null,
    contratoAssinado: false,
  }
}

async function limpar(): Promise<void> {
  await prisma.cliente.deleteMany({ where: { documento: { in: DOCUMENTOS } } })
  await prisma.usuario.deleteMany({
    where: { email: { in: [EMAIL_DO_OPERADOR, EMAIL_DO_ADMINISTRADOR] } },
  })
  await prisma.statusAndamento.deleteMany({ where: { nome: NOME_DO_STATUS } })
}

async function criarCliente(documento: string, nome: string, assinado = false) {
  return prisma.cliente.create({
    data: {
      documento,
      nome,
      nomeBusca: nome.toLowerCase(),
      tipoPessoa: documento.length === 11 ? TipoPessoa.FISICA : TipoPessoa.JURIDICA,
      email: 'teste.exclusao@exemplo.invalido',
      cidade: 'São Paulo',
      uf: 'SP',
      ...(assinado ? { contratoAssinadoEm: new Date() } : {}),
    },
    select: { id: true },
  })
}

beforeAll(async () => {
  await limpar()

  const operador = await prisma.usuario.create({
    data: {
      nome: 'Operador do teste de exclusão',
      email: EMAIL_DO_OPERADOR,
      senhaHash: 'nao-usado',
      perfil: PerfilUsuario.OPERADOR,
    },
    select: { id: true },
  })
  operadorId = operador.id

  const administrador = await prisma.usuario.create({
    data: {
      nome: 'Administrador do teste de exclusão',
      email: EMAIL_DO_ADMINISTRADOR,
      senhaHash: 'nao-usado',
      perfil: PerfilUsuario.ADMINISTRADOR,
    },
    select: { id: true },
  })
  administradorId = administrador.id

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
  it('a sessão do cliente não exclui ninguém', async () => {
    const cliente = await criarCliente(VAZIO, 'Cliente vazio')

    await expect(
      excluirCliente(
        {
          usuarioId: 'qualquer',
          perfil: PerfilUsuario.CLIENTE,
          clienteId: cliente.id,
          contratoAssinado: true,
        },
        cliente.id,
        null,
      ),
    ).rejects.toBeInstanceOf(SemAutorizacao)

    await prisma.cliente.delete({ where: { id: cliente.id } })
  })

  it('id que não existe devolve não encontrado', async () => {
    const resultado = await excluirCliente(
      sessaoDaEquipe(),
      'id-que-nao-existe',
      EMAIL_DO_OPERADOR,
    )
    expect(resultado.situacao).toBe('nao_encontrado')
  })
})

describe('o cadastro feito por engano sai', () => {
  it('cliente sem nada é excluído', async () => {
    const cliente = await criarCliente(VAZIO, 'Cadastrado por engano')

    const resultado = await excluirCliente(
      sessaoDaEquipe(),
      cliente.id,
      EMAIL_DO_OPERADOR,
    )

    expect(resultado.situacao).toBe('excluido')
    expect(
      await prisma.cliente.findUnique({ where: { id: cliente.id } }),
    ).toBeNull()
  })

  // Caso sem andamento e sem documento é casca: não é histórico de nada.
  it('caso vazio some junto, por cascata', async () => {
    const cliente = await criarCliente(VAZIO, 'Com caso vazio')
    const caso = await prisma.caso.create({
      data: { clienteId: cliente.id, assunto: 'Caso ainda vazio' },
      select: { id: true },
    })

    const resultado = await excluirCliente(
      sessaoDaEquipe(),
      cliente.id,
      EMAIL_DO_OPERADOR,
    )

    expect(resultado.situacao).toBe('excluido')
    expect(await prisma.caso.findUnique({ where: { id: caso.id } })).toBeNull()
  })

  // Regra 6: depois da exclusão a linha do cliente não existe mais para ser
  // consultada, então nome e documento ficam em texto na auditoria — sem
  // isso, "excluiu o cliente cmu48..." não diria nada a ninguém.
  it('a auditoria guarda nome e documento em texto', async () => {
    const cliente = await criarCliente(VAZIO, 'Some mas fica no registro')

    await excluirCliente(sessaoDaEquipe(), cliente.id, EMAIL_DO_OPERADOR)

    const registro = await prisma.auditoria.findFirst({
      where: { entidade: 'cliente', entidadeId: cliente.id, acao: 'EXCLUSAO' },
      orderBy: { criadoEm: 'desc' },
    })

    expect(registro).not.toBeNull()
    expect(JSON.stringify(registro?.detalhes)).toContain('Some mas fica no registro')
    expect(JSON.stringify(registro?.detalhes)).toContain(VAZIO)
  })
})

describe('o que tem rastro não sai', () => {
  it('cliente com documento na pasta é recusado', async () => {
    const cliente = await criarCliente(COM_DOCUMENTO, 'Tem documento')
    await prisma.documento.create({
      data: {
        clienteId: cliente.id,
        tipo: TipoDocumento.PROCURACAO,
        nome: 'Procuracao.pdf',
        chaveArquivo: `documentos/teste-exclusao-${Date.now()}`,
        tipoConteudo: 'application/pdf',
        tamanhoBytes: 10,
      },
    })

    const resultado = await excluirCliente(
      sessaoDaEquipe(),
      cliente.id,
      EMAIL_DO_OPERADOR,
    )

    expect(resultado.situacao).toBe('tem_historico')
    if (resultado.situacao === 'tem_historico') {
      expect(resultado.documentos).toBe(1)
    }

    // E continua lá.
    expect(
      await prisma.cliente.findUnique({ where: { id: cliente.id } }),
    ).not.toBeNull()
  })

  it('cliente com andamento lançado é recusado', async () => {
    const cliente = await criarCliente(COM_ANDAMENTO, 'Tem andamento')
    const caso = await prisma.caso.create({
      data: { clienteId: cliente.id, assunto: 'Com histórico' },
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

    const resultado = await excluirCliente(
      sessaoDaEquipe(),
      cliente.id,
      EMAIL_DO_OPERADOR,
    )

    expect(resultado.situacao).toBe('tem_historico')
    if (resultado.situacao === 'tem_historico') {
      expect(resultado.andamentos).toBe(1)
    }
    expect(
      await prisma.caso.findUnique({ where: { id: caso.id } }),
    ).not.toBeNull()
  })

  // Contrato assinado é o gatilho do Anexo I, 1.d: existe cliente entrando no
  // portal por causa dele.
  it('cliente com contrato assinado é recusado, mesmo sem documento nem andamento', async () => {
    const cliente = await criarCliente(COM_CONTRATO, 'Contrato assinado', true)

    const resultado = await excluirCliente(
      sessaoDaEquipe(),
      cliente.id,
      EMAIL_DO_OPERADOR,
    )

    expect(resultado.situacao).toBe('tem_historico')
    if (resultado.situacao === 'tem_historico') {
      expect(resultado.contratoAssinado).toBe(true)
      expect(resultado.documentos).toBe(0)
      expect(resultado.andamentos).toBe(0)
    }
  })
})

describe('exclusão forçada — pedido do escritório (16/09/2026)', () => {
  async function criarClienteComTudo(documento: string, nome: string) {
    const cliente = await criarCliente(documento, nome, true)
    const caso = await prisma.caso.create({
      data: { clienteId: cliente.id, assunto: 'Caso do teste forçado' },
      select: { id: true },
    })
    await prisma.andamento.create({
      data: {
        casoId: caso.id,
        data: new Date(),
        statusId,
        descricao: 'Andamento do teste forçado.',
        autorId: operadorId,
      },
    })
    await prisma.documento.create({
      data: {
        clienteId: cliente.id,
        tipo: TipoDocumento.CONTRATO,
        nome: 'Contrato.pdf',
        chaveArquivo: `documentos/teste-exclusao-forcada-${Date.now()}`,
        tipoConteudo: 'application/pdf',
        tamanhoBytes: 10,
      },
    })
    return cliente
  }

  it('o operador não pode forçar, mesmo pedindo', async () => {
    const cliente = await criarClienteComTudo(COM_TUDO_FORCADO, 'Só o admin força isto')

    await expect(
      excluirCliente(sessaoDaEquipe(), cliente.id, EMAIL_DO_OPERADOR, { forcar: true }),
    ).rejects.toBeInstanceOf(SemAutorizacao)

    // Nada foi tocado: a recusa acontece antes de qualquer escrita.
    expect(
      await prisma.cliente.findUnique({ where: { id: cliente.id } }),
    ).not.toBeNull()

    await prisma.cliente.delete({ where: { id: cliente.id } })
  })

  it('o administrador força e apaga cliente, caso, andamento e documento juntos', async () => {
    const cliente = await criarClienteComTudo(COM_TUDO_FORCADO, 'Vai tudo com o admin')

    const resultado = await excluirCliente(
      sessaoDoAdministrador(),
      cliente.id,
      EMAIL_DO_ADMINISTRADOR,
      { forcar: true },
    )

    expect(resultado.situacao).toBe('excluido')
    expect(
      await prisma.cliente.findUnique({ where: { id: cliente.id } }),
    ).toBeNull()
    expect(
      await prisma.andamento.findMany({ where: { caso: { clienteId: cliente.id } } }),
    ).toHaveLength(0)
    expect(
      await prisma.documento.findMany({ where: { clienteId: cliente.id } }),
    ).toHaveLength(0)
  })

  // Regra 6: a linha do cliente, do andamento e do documento não existem mais
  // para serem consultadas depois — a auditoria é a única prova de que aquele
  // histórico existiu e de que alguém decidiu apagá-lo mesmo assim.
  it('a auditoria da exclusão forçada guarda os números do que foi apagado', async () => {
    const cliente = await criarClienteComTudo(COM_TUDO_FORCADO, 'Fica só na auditoria')

    await excluirCliente(sessaoDoAdministrador(), cliente.id, EMAIL_DO_ADMINISTRADOR, {
      forcar: true,
    })

    const registro = await prisma.auditoria.findFirst({
      where: { entidade: 'cliente', entidadeId: cliente.id, acao: 'EXCLUSAO' },
      orderBy: { criadoEm: 'desc' },
    })

    expect(registro).not.toBeNull()
    const detalhes = JSON.stringify(registro?.detalhes)
    expect(detalhes).toContain('"forcado":true')
    expect(detalhes).toContain('"documentosApagados":1')
    expect(detalhes).toContain('"andamentosApagados":1')
  })
})
