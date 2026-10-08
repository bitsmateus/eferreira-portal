/**
 * A entrada do ATENDIMENTO (a IA no WhatsApp): código por e-mail antes de
 * qualquer consulta.
 *
 * Como em `api-do-escritorio.teste.ts`, as requisições entram pelas rotas de
 * verdade. O único ponto substituído é o envio de e-mail, que é por onde o
 * teste lê o código que o cliente receberia.
 *
 * O que está sendo provado: a consulta do atendimento NÃO responde sem o
 * código; o comprovante vale só para a conversa, o documento e o tempo certos;
 * e o CPF de terceiros não sai na consulta por empresa.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { PerfilUsuario, PermissaoApi, SituacaoCliente, TipoPessoa } from '@prisma/client'

const { enviados } = vi.hoisted(() => ({
  enviados: [] as { para: string; texto: string }[],
}))

vi.mock('@/lib/email', () => ({
  enviarEmail: async (mensagem: { para: string; texto: string }) => {
    enviados.push({ para: mensagem.para, texto: mensagem.texto })
    return { situacao: 'enviado' as const }
  },
  configuracaoSmtp: () => null,
  fecharTransporte: () => undefined,
}))

import { POST as postCodigo } from '@/app/api/v1/atendimento/codigo/route'
import { POST as postValidar } from '@/app/api/v1/atendimento/validar/route'
import { GET as getConsulta } from '@/app/api/v1/atendimento/consulta/route'
import { GET as getConsultaEmpresa } from '@/app/api/v1/atendimento/consulta/empresa/route'
import { acessoVerificado } from '@/lib/acesso-do-atendimento'
import { criarCredencial, revogarCredencial } from '@/lib/credenciais'
import type { SessaoServidor } from '@/lib/autorizacao'
import { prisma } from '@/lib/prisma'

const BASE = 'https://homologacao.exemplo.invalido'

/** Sintéticos e válidos no dígito verificador. Os do protótipo reprovam. */
const CPF_DO_CLIENTE = '11144477735'
const CNPJ_DA_EMPRESA = '11444777000161'
const DOCUMENTO_DE_NINGUEM = '39053344705'
const DOCUMENTOS = [CPF_DO_CLIENTE, CNPJ_DA_EMPRESA]

const EMAIL_DO_ADMIN = 'admin.teste.atendimento@exemplo.invalido'
const NOME_DA_CHAVE = 'Teste · atendimento'

const CONVERSA_A = '5511999990001-ticket-1'
const CONVERSA_B = '5511999990002-ticket-2'

let chave: string
let credencialId: string
let clienteId: string
let empresaId: string
let sessaoDoAdmin: SessaoServidor

function requisicao(
  caminho: string,
  opcoes: { chave?: string | null; metodo?: string; corpo?: unknown } = {},
): NextRequest {
  const cabecalhos = new Headers()
  const chaveDaChamada = opcoes.chave === undefined ? chave : opcoes.chave
  if (chaveDaChamada !== null) cabecalhos.set('authorization', `Bearer ${chaveDaChamada}`)
  if (opcoes.corpo !== undefined) cabecalhos.set('content-type', 'application/json')

  return new NextRequest(`${BASE}${caminho}`, {
    method: opcoes.metodo ?? 'GET',
    headers: cabecalhos,
    ...(opcoes.corpo === undefined ? {} : { body: JSON.stringify(opcoes.corpo) }),
  })
}

async function corpoDe(resposta: Response): Promise<Record<string, unknown>> {
  return (await resposta.json()) as Record<string, unknown>
}

function codigoDoUltimoEmail(): string {
  const ultimo = enviados[enviados.length - 1]
  return /\b(\d{6})\b/.exec(ultimo?.texto ?? '')?.[1] ?? ''
}

/** A janela de pedidos é real (um por minuto); testes rodam em milissegundos. */
async function pedirCodigoDe(documento: string, origem: string): Promise<string> {
  await prisma.codigoDeAcesso.deleteMany({ where: { cliente: { documento } } })
  // O limite por origem (10 pedidos na janela) conta a auditoria; sem isto o
  // teste passa a falhar sozinho depois de uma ou duas execuções seguidas.
  await prisma.auditoria.deleteMany({ where: { enderecoIp: { startsWith: 'api:' } } })
  enviados.length = 0

  const resposta = await postCodigo(
    requisicao('/api/v1/atendimento/codigo', { metodo: 'POST', corpo: { documento, origem } }),
  )
  expect(resposta.status).toBe(200)
  expect(await corpoDe(resposta)).toEqual({ situacao: 'pedido_registrado' })

  const codigo = codigoDoUltimoEmail()
  expect(codigo).toHaveLength(6)
  return codigo
}

async function validar(documento: string, codigo: string, origem: string) {
  return corpoDe(
    await postValidar(
      requisicao('/api/v1/atendimento/validar', {
        metodo: 'POST',
        corpo: { documento, codigo, origem },
      }),
    ),
  )
}

function consultar(documento: string, origem: string) {
  return getConsulta(
    requisicao(`/api/v1/atendimento/consulta?documento=${documento}&origem=${origem}`),
  )
}

function consultarEmpresa(documento: string, origem: string) {
  return getConsultaEmpresa(
    requisicao(`/api/v1/atendimento/consulta/empresa?documento=${documento}&origem=${origem}`),
  )
}

async function limpar(): Promise<void> {
  await prisma.cliente.deleteMany({ where: { documento: { in: DOCUMENTOS } } })
  await prisma.credencialApi.deleteMany({ where: { nome: NOME_DA_CHAVE } })
  await prisma.usuario.deleteMany({ where: { email: EMAIL_DO_ADMIN } })
}

beforeAll(async () => {
  await limpar()

  const admin = await prisma.usuario.create({
    data: {
      nome: 'Administrador do teste do atendimento',
      email: EMAIL_DO_ADMIN,
      senhaHash: null,
      perfil: PerfilUsuario.ADMINISTRADOR,
    },
    select: { id: true },
  })
  sessaoDoAdmin = {
    usuarioId: admin.id,
    perfil: PerfilUsuario.ADMINISTRADOR,
    clienteId: null,
    contratoAssinado: false,
  }

  const criada = await criarCredencial(
    sessaoDoAdmin,
    { nome: NOME_DA_CHAVE, permissoes: [PermissaoApi.CONSULTAR] },
    EMAIL_DO_ADMIN,
  )
  chave = criada.chave
  credencialId = criada.credencialId

  const empresa = await prisma.cliente.create({
    data: {
      documento: CNPJ_DA_EMPRESA,
      nome: 'Empresa do teste do atendimento Ltda',
      nomeBusca: 'empresa do teste do atendimento ltda',
      tipoPessoa: TipoPessoa.JURIDICA,
      email: `${CNPJ_DA_EMPRESA}@exemplo.invalido`,
      contratoAssinadoEm: new Date('2026-02-12T12:00:00.000Z'),
    },
    select: { id: true },
  })
  empresaId = empresa.id

  const cliente = await prisma.cliente.create({
    data: {
      documento: CPF_DO_CLIENTE,
      nome: 'Cliente do teste do atendimento',
      nomeBusca: 'cliente do teste do atendimento',
      tipoPessoa: TipoPessoa.FISICA,
      email: `${CPF_DO_CLIENTE}@exemplo.invalido`,
      contratoAssinadoEm: new Date('2026-02-12T12:00:00.000Z'),
    },
    select: { id: true },
  })
  clienteId = cliente.id

  await prisma.caso.create({
    data: {
      clienteId,
      assunto: 'Ação de cobrança do teste do atendimento',
      empresaVinculadaId: empresaId,
    },
  })
})

afterAll(async () => {
  await limpar()
  await prisma.$disconnect()
})

// ---------------------------------------------------------------------------

describe('sem o código, a consulta do atendimento não responde', () => {
  it('consulta do cliente: 403 nao_verificado, sem dado nenhum', async () => {
    await prisma.codigoDeAcesso.deleteMany({ where: { clienteId } })

    const resposta = await consultar(CPF_DO_CLIENTE, CONVERSA_A)
    expect(resposta.status).toBe(403)
    const corpo = await corpoDe(resposta)
    expect(corpo.erro).toBe('nao_verificado')
    expect(JSON.stringify(corpo)).not.toContain('Cliente do teste')
  })

  it('consulta da empresa: 403 nao_verificado', async () => {
    const resposta = await consultarEmpresa(CNPJ_DA_EMPRESA, CONVERSA_A)
    expect(resposta.status).toBe(403)
    expect((await corpoDe(resposta)).erro).toBe('nao_verificado')
  })

  it('documento que não é de ninguém responde igual a "não verificado"', async () => {
    const resposta = await consultar(DOCUMENTO_DE_NINGUEM, CONVERSA_A)
    expect(resposta.status).toBe(403)
    expect((await corpoDe(resposta)).erro).toBe('nao_verificado')
  })

  it('exige a chave de API como todas as outras rotas', async () => {
    const resposta = await getConsulta(
      requisicao(
        `/api/v1/atendimento/consulta?documento=${CPF_DO_CLIENTE}&origem=${CONVERSA_A}`,
        { chave: null },
      ),
    )
    expect(resposta.status).toBe(401)
  })

  it('sem origem, é erro de quem chamou', async () => {
    const resposta = await getConsulta(
      requisicao(`/api/v1/atendimento/consulta?documento=${CPF_DO_CLIENTE}`),
    )
    expect(resposta.status).toBe(422)
  })
})

describe('pedir o código tem sempre a mesma resposta', () => {
  it('documento de ninguém responde igual e não manda e-mail', async () => {
    enviados.length = 0

    const resposta = await postCodigo(
      requisicao('/api/v1/atendimento/codigo', {
        metodo: 'POST',
        corpo: { documento: DOCUMENTO_DE_NINGUEM, origem: CONVERSA_A },
      }),
    )

    expect(resposta.status).toBe(200)
    expect(await corpoDe(resposta)).toEqual({ situacao: 'pedido_registrado' })
    expect(enviados).toHaveLength(0)
  })

  it('o código vai para o e-mail do cadastro, nunca para um endereço informado', async () => {
    enviados.length = 0
    await prisma.codigoDeAcesso.deleteMany({ where: { clienteId } })
    await prisma.auditoria.deleteMany({ where: { enderecoIp: { startsWith: 'api:' } } })

    await postCodigo(
      requisicao('/api/v1/atendimento/codigo', {
        metodo: 'POST',
        corpo: { documento: CPF_DO_CLIENTE, origem: CONVERSA_A, email: 'outro@exemplo.invalido' },
      }),
    )

    expect(enviados).toHaveLength(1)
    expect(enviados[0]?.para).toBe(`${CPF_DO_CLIENTE}@exemplo.invalido`)
  })

  it('documento que reprova no dígito verificador é erro 422', async () => {
    const resposta = await postCodigo(
      requisicao('/api/v1/atendimento/codigo', {
        metodo: 'POST',
        corpo: { documento: '12345678900', origem: CONVERSA_A },
      }),
    )
    expect(resposta.status).toBe(422)
  })
})

describe('acertar o código abre a consulta, só para quem acertou', () => {
  it('a conversa que acertou consulta os casos do cliente', async () => {
    const codigo = await pedirCodigoDe(CPF_DO_CLIENTE, CONVERSA_A)

    const resultado = await validar(CPF_DO_CLIENTE, codigo, CONVERSA_A)
    expect(resultado.situacao).toBe('confere')
    expect(resultado.nome).toBe('Cliente do teste do atendimento')

    const resposta = await consultar(CPF_DO_CLIENTE, CONVERSA_A)
    expect(resposta.status).toBe(200)
    const corpo = await corpoDe(resposta)
    expect(JSON.stringify(corpo)).toContain('Ação de cobrança do teste do atendimento')
  })

  it('outra conversa, mesmo com o documento certo, continua sem acesso', async () => {
    const codigo = await pedirCodigoDe(CPF_DO_CLIENTE, CONVERSA_A)
    expect((await validar(CPF_DO_CLIENTE, codigo, CONVERSA_A)).situacao).toBe('confere')

    const resposta = await consultar(CPF_DO_CLIENTE, CONVERSA_B)
    expect(resposta.status).toBe(403)
  })

  it('o comprovante é de UM documento: verificar o CPF não abre o CNPJ', async () => {
    const codigo = await pedirCodigoDe(CPF_DO_CLIENTE, CONVERSA_A)
    await validar(CPF_DO_CLIENTE, codigo, CONVERSA_A)

    const resposta = await consultarEmpresa(CNPJ_DA_EMPRESA, CONVERSA_A)
    expect(resposta.status).toBe(403)
  })

  it('código errado não abre nada', async () => {
    const certo = await pedirCodigoDe(CPF_DO_CLIENTE, CONVERSA_A)
    const errado = certo === '000000' ? '000001' : '000000'

    expect((await validar(CPF_DO_CLIENTE, errado, CONVERSA_A)).situacao).toBe('nao_confere')
    expect((await consultar(CPF_DO_CLIENTE, CONVERSA_A)).status).toBe(403)
  })

  it('na quinta tentativa errada o código morre, até o certo', async () => {
    const certo = await pedirCodigoDe(CPF_DO_CLIENTE, CONVERSA_A)
    const errado = certo === '000000' ? '000001' : '000000'

    for (let i = 0; i < 5; i += 1) {
      expect((await validar(CPF_DO_CLIENTE, errado, CONVERSA_A)).situacao).toBe('nao_confere')
    }

    expect((await validar(CPF_DO_CLIENTE, certo, CONVERSA_A)).situacao).toBe('nao_confere')
    expect((await consultar(CPF_DO_CLIENTE, CONVERSA_A)).status).toBe(403)
  })

  it('um código acertado por outra conversa não serve de comprovante', async () => {
    // A conversa A pede; a B acerta o código (alguém que viu o e-mail).
    const codigo = await pedirCodigoDe(CPF_DO_CLIENTE, CONVERSA_A)
    await validar(CPF_DO_CLIENTE, codigo, CONVERSA_B)

    expect((await consultar(CPF_DO_CLIENTE, CONVERSA_B)).status).toBe(403)
    expect((await consultar(CPF_DO_CLIENTE, CONVERSA_A)).status).toBe(403)
  })
})

describe('o comprovante vence e acompanha o cliente', () => {
  it('passados 30 minutos, a conversa precisa de outro código', async () => {
    const codigo = await pedirCodigoDe(CPF_DO_CLIENTE, CONVERSA_A)
    await validar(CPF_DO_CLIENTE, codigo, CONVERSA_A)

    const agora = new Date()
    expect(await acessoVerificado(CPF_DO_CLIENTE, CONVERSA_A, agora)).toBe(true)
    expect(
      await acessoVerificado(CPF_DO_CLIENTE, CONVERSA_A, new Date(agora.getTime() + 31 * 60_000)),
    ).toBe(false)
  })

  it('cliente desativado perde a consulta na hora, sem esperar o vencimento', async () => {
    const codigo = await pedirCodigoDe(CPF_DO_CLIENTE, CONVERSA_A)
    await validar(CPF_DO_CLIENTE, codigo, CONVERSA_A)
    expect((await consultar(CPF_DO_CLIENTE, CONVERSA_A)).status).toBe(200)

    await prisma.cliente.update({
      where: { id: clienteId },
      data: { situacao: SituacaoCliente.INATIVO },
    })
    try {
      expect((await consultar(CPF_DO_CLIENTE, CONVERSA_A)).status).toBe(403)
    } finally {
      await prisma.cliente.update({
        where: { id: clienteId },
        data: { situacao: SituacaoCliente.ATIVO },
      })
    }
  })

  it('chave revogada para de funcionar nas rotas do atendimento', async () => {
    const codigo = await pedirCodigoDe(CPF_DO_CLIENTE, CONVERSA_A)
    await validar(CPF_DO_CLIENTE, codigo, CONVERSA_A)

    await revogarCredencial(sessaoDoAdmin, credencialId, EMAIL_DO_ADMIN)
    expect((await consultar(CPF_DO_CLIENTE, CONVERSA_A)).status).toBe(401)
  })
})

describe('a consulta por empresa depende do código DA EMPRESA e não vaza CPF', () => {
  it('com o código do CNPJ, lista os casos e só o nome do cliente', async () => {
    // A chave do teste anterior foi revogada: cria outra.
    const nova = await criarCredencial(
      sessaoDoAdmin,
      { nome: NOME_DA_CHAVE, permissoes: [PermissaoApi.CONSULTAR] },
      EMAIL_DO_ADMIN,
    )
    chave = nova.chave
    credencialId = nova.credencialId

    const codigo = await pedirCodigoDe(CNPJ_DA_EMPRESA, CONVERSA_A)
    expect((await validar(CNPJ_DA_EMPRESA, codigo, CONVERSA_A)).situacao).toBe('confere')

    const resposta = await consultarEmpresa(CNPJ_DA_EMPRESA, CONVERSA_A)
    expect(resposta.status).toBe(200)

    const corpo = await corpoDe(resposta)
    expect(corpo.total).toBe(1)
    const casos = corpo.casos as Record<string, unknown>[]
    expect(casos[0]?.cliente).toBe('Cliente do teste do atendimento')
    expect(casos[0]?.assunto).toBe('Ação de cobrança do teste do atendimento')

    // O CPF e o id de terceiros não saem pelo WhatsApp.
    const texto = JSON.stringify(corpo)
    expect(texto).not.toContain(CPF_DO_CLIENTE)
    expect(texto).not.toContain('111.444.777-35')
    expect(texto).not.toContain(clienteId)
  })
})
