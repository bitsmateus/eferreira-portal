/**
 * Origem do documento (item 5 da lista de melhorias — "'anexado por' aparece
 * em documento que o sistema gerou. Falta distinguir gerado de anexado").
 *
 * Só `anexarDocumento` é testado aqui contra o banco: é o único dos três
 * caminhos (gerado, anexado, assinado na D4Sign) que não depende de
 * Playwright nem da D4Sign de verdade — os outros dois (`gerarDocumento`,
 * `arquivarAssinado`) só têm uma linha nova cada (`origem: ...`), e este
 * projeto não testa esses caminhos contra o banco por dependerem de
 * ferramentas externas pesadas (ver `testes-de-banco/assinatura-eletronica.
 * teste.ts`, que para exatamente antes de falar com a D4Sign de verdade).
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { OrigemDoDocumento, PerfilUsuario, TipoDocumento, TipoPessoa } from '@prisma/client'

import { anexarDocumento } from '@/lib/documentos'
import { prisma } from '@/lib/prisma'

const DOCUMENTO_DO_CLIENTE = '39053344705'
const EMAIL_DO_OPERADOR = 'operador.teste.origem.documento@exemplo.invalido'

let operadorId: string
let clienteId: string

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
}

beforeAll(async () => {
  await limpar()

  const operador = await prisma.usuario.create({
    data: {
      nome: 'Operador do teste de origem do documento',
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
      nome: 'Cliente do teste de origem do documento',
      nomeBusca: 'cliente do teste de origem do documento',
      tipoPessoa: TipoPessoa.FISICA,
    },
    select: { id: true },
  })
  clienteId = cliente.id
})

afterAll(async () => {
  await limpar()
  await prisma.$disconnect()
})

describe('anexarDocumento grava origem: ANEXADO', () => {
  it('mesmo escolhendo um tipo "jurídico" (ex.: contrato em papel digitalizado)', async () => {
    const resultado = await anexarDocumento(
      sessaoDaEquipe(),
      clienteId,
      { tipo: TipoDocumento.CONTRATO, casoId: null },
      {
        nome: 'contrato-assinado-em-papel.pdf',
        tipoConteudo: 'application/pdf',
        conteudo: new Uint8Array([1, 2, 3]),
      },
      EMAIL_DO_OPERADOR,
    )

    expect(resultado.situacao).toBe('anexado')
    if (resultado.situacao !== 'anexado') return

    const documento = await prisma.documento.findUniqueOrThrow({
      where: { id: resultado.documentoId },
    })
    // Tipo é CONTRATO (o que a tela escolheu), mas a origem é ANEXADO — quem
    // subiu isso foi um humano, não `gerarDocumento`.
    expect(documento.tipo).toBe(TipoDocumento.CONTRATO)
    expect(documento.origem).toBe(OrigemDoDocumento.ANEXADO)
  })
})
