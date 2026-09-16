/**
 * A exclusão de documento da pasta, contra o Postgres de verdade.
 *
 * O que importa é a RECUSA: documento assinado é a própria prova, e documento
 * já enviado para assinatura tem um `EnvioParaAssinatura` apontando para ele
 * com `onDelete: Cascade` — apagar o documento apagaria junto o registro de
 * quem recebeu o e-mail e quando. Só o que não deixou rastro nenhum sai.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PerfilUsuario, SituacaoDoEnvio, TipoDocumento, TipoPessoa } from '@prisma/client'

import { excluirDocumento } from '@/lib/documentos'
import { SemAutorizacao } from '@/lib/autorizacao'
import { prisma } from '@/lib/prisma'

const DOCUMENTO_DO_CLIENTE = '52998224725'
const EMAIL_DO_OPERADOR = 'operador.teste.exclusao.documento@exemplo.invalido'

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

function novoDocumento(dados: { assinadoEm?: Date } = {}) {
  return prisma.documento.create({
    data: {
      clienteId,
      tipo: TipoDocumento.ANEXO,
      nome: 'Documento de teste.pdf',
      chaveArquivo: `documentos/teste-exclusao-documento-${Date.now()}-${Math.random()}`,
      tipoConteudo: 'application/pdf',
      tamanhoBytes: 10,
      ...dados,
    },
    select: { id: true, chaveArquivo: true },
  })
}

async function limpar(): Promise<void> {
  await prisma.cliente.deleteMany({ where: { documento: DOCUMENTO_DO_CLIENTE } })
  await prisma.usuario.deleteMany({ where: { email: EMAIL_DO_OPERADOR } })
}

beforeAll(async () => {
  await limpar()

  const operador = await prisma.usuario.create({
    data: {
      nome: 'Operador do teste de exclusão de documento',
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
      nome: 'Cliente do teste de exclusão de documento',
      nomeBusca: 'cliente do teste de exclusao de documento',
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

describe('quem pode excluir', () => {
  it('a sessão do cliente não exclui documento nenhum', async () => {
    const documento = await novoDocumento()

    await expect(
      excluirDocumento(
        {
          usuarioId: 'qualquer',
          perfil: PerfilUsuario.CLIENTE,
          clienteId,
          contratoAssinado: true,
        },
        documento.id,
        null,
      ),
    ).rejects.toBeInstanceOf(SemAutorizacao)

    await prisma.documento.delete({ where: { id: documento.id } })
  })

  it('id que não existe devolve não encontrado', async () => {
    const resultado = await excluirDocumento(
      sessaoDaEquipe(),
      'id-que-nao-existe',
      EMAIL_DO_OPERADOR,
    )
    expect(resultado.situacao).toBe('nao_encontrado')
  })
})

describe('o documento sem rastro sai', () => {
  it('anexo comum é excluído', async () => {
    const documento = await novoDocumento()

    const resultado = await excluirDocumento(
      sessaoDaEquipe(),
      documento.id,
      EMAIL_DO_OPERADOR,
    )

    expect(resultado.situacao).toBe('excluido')
    expect(
      await prisma.documento.findUnique({ where: { id: documento.id } }),
    ).toBeNull()
  })

  it('a auditoria guarda o nome em texto', async () => {
    const documento = await prisma.documento.create({
      data: {
        clienteId,
        tipo: TipoDocumento.ANEXO,
        nome: 'Some mas fica no registro.pdf',
        chaveArquivo: `documentos/teste-exclusao-documento-${Date.now()}`,
        tipoConteudo: 'application/pdf',
        tamanhoBytes: 10,
      },
      select: { id: true },
    })

    await excluirDocumento(sessaoDaEquipe(), documento.id, EMAIL_DO_OPERADOR)

    const registro = await prisma.auditoria.findFirst({
      where: { entidade: 'documento', entidadeId: documento.id, acao: 'EXCLUSAO' },
      orderBy: { criadoEm: 'desc' },
    })

    expect(registro).not.toBeNull()
    expect(JSON.stringify(registro?.detalhes)).toContain('Some mas fica no registro')
  })
})

describe('o que tem rastro não sai', () => {
  it('documento assinado é recusado', async () => {
    const documento = await novoDocumento({ assinadoEm: new Date() })

    const resultado = await excluirDocumento(
      sessaoDaEquipe(),
      documento.id,
      EMAIL_DO_OPERADOR,
    )

    expect(resultado.situacao).toBe('assinado')
    expect(
      await prisma.documento.findUnique({ where: { id: documento.id } }),
    ).not.toBeNull()
  })

  // Mesmo NO_COFRE — subiu mas ainda não saiu — já é rastro: apagar o
  // documento apagaria junto, por cascata, o envio que aponta pra ele.
  it('documento com envio (mesmo NO_COFRE) é recusado', async () => {
    const documento = await novoDocumento()
    await prisma.envioParaAssinatura.create({
      data: {
        documentoId: documento.id,
        uuidDocumento: `uuid-teste-${Date.now()}`,
        cofre: 'cofre-de-teste',
        situacao: SituacaoDoEnvio.NO_COFRE,
        signatarios: [],
        pedidoPorId: operadorId,
      },
    })

    const resultado = await excluirDocumento(
      sessaoDaEquipe(),
      documento.id,
      EMAIL_DO_OPERADOR,
    )

    expect(resultado.situacao).toBe('enviado_para_assinatura')
    expect(
      await prisma.documento.findUnique({ where: { id: documento.id } }),
    ).not.toBeNull()
  })

  it('documento aguardando assinatura é recusado', async () => {
    const documento = await novoDocumento()
    await prisma.envioParaAssinatura.create({
      data: {
        documentoId: documento.id,
        uuidDocumento: `uuid-teste-${Date.now()}`,
        cofre: 'cofre-de-teste',
        situacao: SituacaoDoEnvio.AGUARDANDO,
        signatarios: [],
        enviadoEm: new Date(),
        pedidoPorId: operadorId,
      },
    })

    const resultado = await excluirDocumento(
      sessaoDaEquipe(),
      documento.id,
      EMAIL_DO_OPERADOR,
    )

    expect(resultado.situacao).toBe('enviado_para_assinatura')
  })
})
