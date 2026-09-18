/**
 * `listarTodosOsDocumentos` + `enviosRecentes` — a tela de Documentos (item 2
 * da lista de melhorias): "quais contratos estão aguardando assinatura?" sem
 * abrir cliente por cliente.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  PerfilUsuario,
  SituacaoDoEnvio,
  TipoDocumento,
  TipoPessoa,
} from '@prisma/client'

import { enviosRecentes } from '@/lib/assinaturas'
import { SemAutorizacao } from '@/lib/autorizacao'
import {
  listarTodosOsDocumentos,
  situacaoDeAssinaturaDoDocumento,
} from '@/lib/documentos'
import { prisma } from '@/lib/prisma'

const DOCUMENTO_A = '52998224725'
const DOCUMENTO_B = '11144477735'
const EMAIL_DO_OPERADOR = 'operador.teste.tela.documentos@exemplo.invalido'

let operadorId: string
let clienteAId: string
let clienteBId: string
let contratoAguardandoId: string
let anexoNaoEnviadoId: string

function sessaoDaEquipe() {
  return {
    usuarioId: operadorId,
    perfil: PerfilUsuario.OPERADOR,
    clienteId: null,
    contratoAssinado: false,
  }
}

function sessaoDeCliente() {
  return {
    usuarioId: 'usuario-de-cliente-qualquer',
    perfil: PerfilUsuario.CLIENTE,
    clienteId: clienteAId,
    contratoAssinado: true,
  }
}

async function limpar(): Promise<void> {
  await prisma.cliente.deleteMany({ where: { documento: { in: [DOCUMENTO_A, DOCUMENTO_B] } } })
  await prisma.usuario.deleteMany({ where: { email: EMAIL_DO_OPERADOR } })
}

beforeAll(async () => {
  await limpar()

  const operador = await prisma.usuario.create({
    data: {
      nome: 'Operador do teste da tela de documentos',
      email: EMAIL_DO_OPERADOR,
      senhaHash: 'nao-usado',
      perfil: PerfilUsuario.OPERADOR,
    },
    select: { id: true },
  })
  operadorId = operador.id

  const clienteA = await prisma.cliente.create({
    data: {
      documento: DOCUMENTO_A,
      nome: 'Fulano da Tela de Documentos',
      nomeBusca: 'fulano da tela de documentos',
      tipoPessoa: TipoPessoa.FISICA,
    },
    select: { id: true },
  })
  clienteAId = clienteA.id

  const clienteB = await prisma.cliente.create({
    data: {
      documento: DOCUMENTO_B,
      nome: 'Beltrana da Tela de Documentos',
      nomeBusca: 'beltrana da tela de documentos',
      tipoPessoa: TipoPessoa.FISICA,
    },
    select: { id: true },
  })
  clienteBId = clienteB.id

  const contrato = await prisma.documento.create({
    data: {
      clienteId: clienteAId,
      tipo: TipoDocumento.CONTRATO,
      nome: 'Contrato - Fulano.pdf',
      chaveArquivo: 'documentos/teste-tela-documentos-contrato',
      tipoConteudo: 'application/pdf',
      tamanhoBytes: 10,
    },
    select: { id: true },
  })
  contratoAguardandoId = contrato.id

  await prisma.envioParaAssinatura.create({
    data: {
      documentoId: contrato.id,
      uuidDocumento: 'uuid-tela-documentos-aguardando',
      cofre: 'cofre-de-mentira',
      situacao: SituacaoDoEnvio.AGUARDANDO,
      signatarios: [{ papel: 'cliente', nome: 'Fulano', email: 'fulano@exemplo.invalido' }],
      enviadoEm: new Date(),
      pedidoPorId: operadorId,
    },
  })

  const anexo = await prisma.documento.create({
    data: {
      clienteId: clienteBId,
      tipo: TipoDocumento.ANEXO,
      nome: 'RG-beltrana.pdf',
      chaveArquivo: 'documentos/teste-tela-documentos-anexo',
      tipoConteudo: 'application/pdf',
      tamanhoBytes: 10,
    },
    select: { id: true },
  })
  anexoNaoEnviadoId = anexo.id
})

afterAll(async () => {
  await limpar()
  await prisma.$disconnect()
})

describe('listarTodosOsDocumentos', () => {
  it('cruza documentos de clientes diferentes numa lista só', async () => {
    const lista = await listarTodosOsDocumentos(sessaoDaEquipe(), '', {
      tipo: '',
      situacao: '',
    })

    const ids = lista.linhas.map((linha) => linha.id)
    expect(ids).toContain(contratoAguardandoId)
    expect(ids).toContain(anexoNaoEnviadoId)
  })

  it('filtra por tipo', async () => {
    const lista = await listarTodosOsDocumentos(sessaoDaEquipe(), '', {
      tipo: TipoDocumento.ANEXO,
      situacao: '',
    })

    const ids = lista.linhas.map((linha) => linha.id)
    expect(ids).toContain(anexoNaoEnviadoId)
    expect(ids).not.toContain(contratoAguardandoId)
  })

  it('busca por nome do cliente e por CPF/CNPJ', async () => {
    const porNome = await listarTodosOsDocumentos(sessaoDaEquipe(), 'Beltrana', {
      tipo: '',
      situacao: '',
    })
    expect(porNome.linhas.map((linha) => linha.id)).toEqual([anexoNaoEnviadoId])

    const porDocumento = await listarTodosOsDocumentos(sessaoDaEquipe(), DOCUMENTO_A, {
      tipo: '',
      situacao: '',
    })
    expect(porDocumento.linhas.map((linha) => linha.id)).toEqual([contratoAguardandoId])
  })

  it('traz o cliente dono de cada documento', async () => {
    const lista = await listarTodosOsDocumentos(sessaoDaEquipe(), '', {
      tipo: '',
      situacao: '',
    })

    const linha = lista.linhas.find((item) => item.id === contratoAguardandoId)
    expect(linha?.cliente.nome).toBe('Fulano da Tela de Documentos')
  })

  it('sessão de cliente não enxerga a lista geral', async () => {
    await expect(
      listarTodosOsDocumentos(sessaoDeCliente(), '', { tipo: '', situacao: '' }),
    ).rejects.toBeInstanceOf(SemAutorizacao)
  })
})

describe('enviosRecentes + situacaoDeAssinaturaDoDocumento, juntos', () => {
  it('o contrato aparece aguardando, o anexo aparece não enviado', async () => {
    const envios = await enviosRecentes(sessaoDaEquipe())

    const situacaoDoContrato = situacaoDeAssinaturaDoDocumento(
      { assinadoEm: null },
      envios.get(contratoAguardandoId) ?? null,
    )
    const situacaoDoAnexo = situacaoDeAssinaturaDoDocumento(
      { assinadoEm: null },
      envios.get(anexoNaoEnviadoId) ?? null,
    )

    expect(situacaoDoContrato).toBe('aguardando')
    expect(situacaoDoAnexo).toBe('nao_enviado')
  })
})
