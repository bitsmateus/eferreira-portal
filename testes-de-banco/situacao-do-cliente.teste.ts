/**
 * Situação do cliente (item 4 da lista de melhorias — "não há como remover
 * cliente cadastrado por engano"): desativar sem apagar nada, e o cliente
 * inativo para de conseguir pedir código de acesso — mesma resposta genérica
 * de sempre, para não revelar que aquele CPF existe e está só desativado.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PerfilUsuario, SituacaoCliente, TipoPessoa } from '@prisma/client'

import { alterarSituacaoDoCliente } from '@/lib/clientes'
import { pedirCodigo } from '@/lib/acesso-do-cliente'
import { prisma } from '@/lib/prisma'

const DOCUMENTO_ATIVO = '52998224725'
const DOCUMENTO_INATIVO = '11144477735'
const EMAIL_DO_OPERADOR = 'operador.teste.situacao.cliente@exemplo.invalido'

let operadorId: string
let clienteAtivoId: string
let clienteInativoId: string

function sessaoDaEquipe() {
  return {
    usuarioId: operadorId,
    perfil: PerfilUsuario.OPERADOR,
    clienteId: null,
    contratoAssinado: false,
  }
}

async function limpar(): Promise<void> {
  await prisma.cliente.deleteMany({
    where: { documento: { in: [DOCUMENTO_ATIVO, DOCUMENTO_INATIVO] } },
  })
  await prisma.usuario.deleteMany({ where: { email: EMAIL_DO_OPERADOR } })
}

beforeAll(async () => {
  await limpar()

  const operador = await prisma.usuario.create({
    data: {
      nome: 'Operador do teste de situação do cliente',
      email: EMAIL_DO_OPERADOR,
      senhaHash: 'nao-usado',
      perfil: PerfilUsuario.OPERADOR,
    },
    select: { id: true },
  })
  operadorId = operador.id

  const dadosComuns = {
    tipoPessoa: TipoPessoa.FISICA,
    cidade: 'São Paulo',
    uf: 'SP',
    contratoAssinadoEm: new Date(),
  }

  const ativo = await prisma.cliente.create({
    data: {
      ...dadosComuns,
      documento: DOCUMENTO_ATIVO,
      nome: 'Cliente Ativo do Teste',
      nomeBusca: 'cliente ativo do teste',
      email: 'cliente.ativo.teste@exemplo.invalido',
    },
    select: { id: true },
  })
  clienteAtivoId = ativo.id

  const inativo = await prisma.cliente.create({
    data: {
      ...dadosComuns,
      documento: DOCUMENTO_INATIVO,
      nome: 'Cliente Inativo do Teste',
      nomeBusca: 'cliente inativo do teste',
      email: 'cliente.inativo.teste@exemplo.invalido',
      situacao: SituacaoCliente.INATIVO,
    },
    select: { id: true },
  })
  clienteInativoId = inativo.id
})

afterAll(async () => {
  await limpar()
  await prisma.$disconnect()
})

describe('alterarSituacaoDoCliente', () => {
  it('desativa, grava auditoria e reativa depois', async () => {
    const desativado = await alterarSituacaoDoCliente(
      sessaoDaEquipe(),
      clienteAtivoId,
      SituacaoCliente.INATIVO,
      EMAIL_DO_OPERADOR,
    )
    expect(desativado).toEqual({ situacao: 'alterado' })

    const depoisDeDesativar = await prisma.cliente.findUniqueOrThrow({
      where: { id: clienteAtivoId },
    })
    expect(depoisDeDesativar.situacao).toBe(SituacaoCliente.INATIVO)

    const auditoria = await prisma.auditoria.findFirst({
      where: { entidade: 'cliente', entidadeId: clienteAtivoId, acao: 'ATUALIZACAO' },
      orderBy: { criadoEm: 'desc' },
    })
    expect(JSON.stringify(auditoria?.detalhes)).toContain('INATIVO')

    // Reativa — nada foi apagado, e desfazer é só trocar de novo.
    const reativado = await alterarSituacaoDoCliente(
      sessaoDaEquipe(),
      clienteAtivoId,
      SituacaoCliente.ATIVO,
      EMAIL_DO_OPERADOR,
    )
    expect(reativado).toEqual({ situacao: 'alterado' })

    const depoisDeReativar = await prisma.cliente.findUniqueOrThrow({
      where: { id: clienteAtivoId },
    })
    expect(depoisDeReativar.situacao).toBe(SituacaoCliente.ATIVO)
  })

  it('devolve nao_encontrado para id inexistente', async () => {
    const resultado = await alterarSituacaoDoCliente(
      sessaoDaEquipe(),
      'id-que-nao-existe',
      SituacaoCliente.INATIVO,
      EMAIL_DO_OPERADOR,
    )
    expect(resultado).toEqual({ situacao: 'nao_encontrado' })
  })
})

describe('pedirCodigo — cliente inativo não recebe código', () => {
  it('cliente ativo, elegível, gera um código de verdade', async () => {
    const antes = await prisma.codigoDeAcesso.count({
      where: { clienteId: clienteAtivoId },
    })

    await pedirCodigo(DOCUMENTO_ATIVO)

    const depois = await prisma.codigoDeAcesso.count({
      where: { clienteId: clienteAtivoId },
    })
    expect(depois).toBe(antes + 1)
  })

  // O ponto central deste arquivo: desativado é tratado exatamente como
  // "não é cliente elegível" — nenhum código é gerado, e a resposta pública
  // (`pedido_registrado`) é a mesma de sempre, sem distinguir o motivo.
  it('cliente inativo não gera código, mesmo com contrato assinado e e-mail', async () => {
    const resultado = await pedirCodigo(DOCUMENTO_INATIVO)
    expect(resultado).toEqual({ situacao: 'pedido_registrado' })

    const quantos = await prisma.codigoDeAcesso.count({
      where: { clienteId: clienteInativoId },
    })
    expect(quantos).toBe(0)
  })
})
