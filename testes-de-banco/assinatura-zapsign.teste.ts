/**
 * Assinatura eletrônica pela ZapSign (troca da D4Sign, 11/2026), contra o
 * Postgres de verdade. A ZapSign e a D4Sign são substituídas por um `fetch`
 * dublado — do outro lado não há ensaio: cada documento criado conta no plano
 * e manda e-mail de verdade. O armazenamento também é dublado: aqui se prova o
 * que o portal grava, não o MinIO.
 *
 * O que se prova:
 *  - o envio cria UM documento na ZapSign, com a âncora de cada um, sem selfie;
 *  - documento avulso vai com a posição por coordenada, logo depois de criar;
 *  - a conferência e o aviso automático arquivam o assinado como
 *    ASSINADO_NA_ZAPSIGN e, no contrato, liberam o acesso do cliente;
 *  - o reenvio do que ficou na D4Sign não faz NADA com a ZapSign desligada, e
 *    com ela ligada só cancela na D4Sign depois que o envio novo saiu.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import {
  OrigemDoDocumento,
  PapelDaParte,
  PerfilUsuario,
  ProvedorAssinatura,
  SituacaoDoEnvio,
  TipoDocumento,
  TipoPessoa,
} from '@prisma/client'

import { pdfMinimo } from '../testes/ajudas/pdf-minimo'

const TEXTO = 'CONTRATO DE PRESTACAO DE SERVICOS ADVOCATICIOS ENTRE AS PARTES ABAIXO'
const ORIGINAL = pdfMinimo([[{ texto: TEXTO, x: 72, y: 760 }], [{ texto: 'continua', x: 72, y: 760 }]])
// O assinado da ZapSign: o documento inteiro mais o relatório de assinaturas.
const ASSINADO = pdfMinimo([
  [{ texto: TEXTO, x: 72, y: 760 }],
  [{ texto: 'continua', x: 72, y: 760 }],
  [{ texto: 'Relatorio de Assinaturas', x: 72, y: 760 }],
])

vi.mock('@/lib/armazenamento', async (original) => ({
  ...(await original<typeof import('@/lib/armazenamento')>()),
  lerArquivo: vi.fn(async () => ORIGINAL),
  enviarArquivo: vi.fn(async () => undefined),
  removerArquivo: vi.fn(async () => undefined),
}))

const { conferirAssinatura, enviarParaAssinatura, reenviarPelaZapSign } = await import(
  '@/lib/assinaturas'
)
const { prisma } = await import('@/lib/prisma')
const { POST: retornoDaZapSign } = await import('@/app/api/zapsign/retorno/route')

const CPF = '39053344705'
const EMAIL_DO_CLIENTE = 'cliente.zapsign@exemplo.invalido'
const EMAIL_DO_OPERADOR = 'operador.zapsign@exemplo.invalido'

const AMBIENTE = {
  ASSINATURA_PROVEDOR: 'zapsign',
  ZAPSIGN_API_TOKEN: 'chave-de-mentira',
  ZAPSIGN_BASE_URL: 'https://zapsign.test/api/v1',
  ZAPSIGN_RETORNO_SEGREDO: 'segredo123',
  // A D4Sign só aparece no reenvio, para cancelar o envio antigo.
  D4SIGN_TOKEN_API: 'token-de-mentira',
  D4SIGN_CRYPT_KEY: 'crypt-de-mentira',
  D4SIGN_COFRE: 'cofre-de-mentira',
  D4SIGN_URL: 'https://d4sign.test/api/v1',
}

let ambienteAnterior: NodeJS.ProcessEnv
let operadorId: string
let clienteId: string

// --------------------------------------------------------- plataformas dubladas

type Chamada = { url: string; metodo: string; corpo: Record<string, unknown> | null }
let chamadas: Chamada[] = []
const naZapSign = new Map<string, { status: string; signers: { email: string; status: string; token: string }[] }>()
let proximo = 0
let criarFalha = false

function json(dados: unknown, status = 200): Response {
  return new Response(JSON.stringify(dados), { status, headers: { 'Content-Type': 'application/json' } })
}

const fetchDublado = vi.fn(async (entrada: string | URL, init?: RequestInit) => {
  const url = String(entrada)
  const metodo = init?.method ?? 'GET'
  const corpo = typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : null
  chamadas.push({ url, metodo, corpo })

  if (url.startsWith('https://arquivos.zapsign.test/')) return new Response(Buffer.from(ASSINADO))
  if (url.startsWith('https://d4sign.test/')) {
    return url.includes('/cancel') ? json({ message: 'ok' }) : json({}, 500)
  }

  const caminho = url.replace('https://zapsign.test/api/v1', '')
  if (caminho === '/docs/' && metodo === 'POST') {
    if (criarFalha) return json({ detail: 'Plano sem documentos.' }, 402)
    const token = `zs-${++proximo}-${Date.now()}`
    const signers = (corpo?.['signers'] as { email: string }[]).map((s, i) => ({
      email: s.email,
      status: 'new',
      token: `${token}-s${i}`,
    }))
    naZapSign.set(token, { status: 'pending', signers })
    return json({ token, status: 'pending', signers })
  }
  if (/^\/docs\/[^/]+\/place-signatures\/$/.test(caminho)) return json({ message: 'ok' })
  const detalhe = /^\/docs\/([^/]+)\/$/.exec(caminho)
  if (detalhe !== null && metodo === 'GET') {
    const doc = naZapSign.get(decodeURIComponent(detalhe[1] ?? ''))
    if (doc === undefined) return json({ detail: 'Not found' }, 404)
    return json({
      token: detalhe[1],
      status: doc.status,
      signers: doc.signers,
      signed_file: doc.status === 'signed' ? 'https://arquivos.zapsign.test/assinado.pdf' : null,
    })
  }
  return json({ detail: `inesperado: ${metodo} ${caminho}` }, 500)
})

function assinarTodos(token: string): void {
  const doc = naZapSign.get(token)
  if (doc === undefined) throw new Error('documento inexistente na ZapSign dublada')
  doc.status = 'signed'
  for (const s of doc.signers) s.status = 'signed'
}

// ------------------------------------------------------------------- cenário

function sessao() {
  return { usuarioId: operadorId, perfil: PerfilUsuario.OPERADOR, clienteId: null, contratoAssinado: false }
}

async function documento(tipo: TipoDocumento, nome: string): Promise<string> {
  const criado = await prisma.documento.create({
    data: {
      clienteId,
      tipo,
      nome,
      chaveArquivo: `documentos/teste-zapsign-${nome}-${Date.now()}`,
      tipoConteudo: 'application/pdf',
      tamanhoBytes: ORIGINAL.byteLength,
    },
    select: { id: true },
  })
  return criado.id
}

async function limpar(): Promise<void> {
  await prisma.cliente.deleteMany({ where: { documento: CPF } })
  await prisma.usuario.deleteMany({ where: { email: EMAIL_DO_OPERADOR } })
}

beforeAll(async () => {
  ambienteAnterior = { ...process.env }
  Object.assign(process.env, AMBIENTE)
  await limpar()

  const operador = await prisma.usuario.create({
    data: {
      nome: 'Operador ZapSign',
      email: EMAIL_DO_OPERADOR,
      senhaHash: 'nao-usado',
      perfil: PerfilUsuario.OPERADOR,
    },
    select: { id: true },
  })
  operadorId = operador.id

  const cliente = await prisma.cliente.create({
    data: {
      documento: CPF,
      nome: 'Cliente ZapSign',
      nomeBusca: 'cliente zapsign',
      tipoPessoa: TipoPessoa.FISICA,
      email: EMAIL_DO_CLIENTE,
      cidade: 'Mogi das Cruzes',
      uf: 'SP',
    },
    select: { id: true },
  })
  clienteId = cliente.id
})

beforeEach(() => {
  chamadas = []
  criarFalha = false
  process.env['ASSINATURA_PROVEDOR'] = 'zapsign'
  vi.stubGlobal('fetch', fetchDublado)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

afterAll(async () => {
  await limpar()
  process.env = ambienteAnterior
  await prisma.$disconnect()
})

// ------------------------------------------------------------------- testes

describe('envio pela ZapSign', () => {
  it('procuração: um documento só, âncora da parte, sem selfie, gravado como ZAPSIGN', async () => {
    const id = await documento(TipoDocumento.PROCURACAO, 'Procuracao.pdf')

    const resultado = await enviarParaAssinatura(sessao(), id, EMAIL_DO_OPERADOR)
    expect(resultado.situacao).toBe('enviado')

    const criacoes = chamadas.filter((c) => c.url.endsWith('/docs/') && c.metodo === 'POST')
    expect(criacoes).toHaveLength(1)
    const signers = criacoes[0]?.corpo?.['signers'] as Record<string, unknown>[]
    expect(signers).toHaveLength(1)
    expect(signers[0]).toMatchObject({
      email: EMAIL_DO_CLIENTE,
      signature_placement: '[[assina:parte]]',
      require_selfie_photo: false,
    })

    const envio = await prisma.envioParaAssinatura.findFirstOrThrow({ where: { documentoId: id } })
    expect(envio).toMatchObject({
      provedor: ProvedorAssinatura.ZAPSIGN,
      situacao: SituacaoDoEnvio.AGUARDANDO,
      cofre: 'zapsign',
    })
    expect(envio.enviadoEm).not.toBeNull()
  })

  it('documento avulso: posição por coordenada logo depois de criar', async () => {
    const id = await documento(TipoDocumento.ANEXO, 'Acordo.pdf')

    const resultado = await enviarParaAssinatura(sessao(), id, EMAIL_DO_OPERADOR, [
      {
        nome: 'Parte Contrária',
        email: 'contraria@exemplo.invalido',
        papel: PapelDaParte.PARTE_CONTRARIA,
        posicao: { pagina: 1, lado: 'esquerda', alturaEmPercentual: 80 },
      },
    ])
    expect(resultado.situacao).toBe('enviado')

    const posicao = chamadas.find((c) => c.url.includes('/place-signatures/'))
    const rubricas = posicao?.corpo?.['rubricas'] as Record<string, unknown>[]
    expect(rubricas).toHaveLength(1)
    // página 1 da tela = página 0 da ZapSign
    expect(rubricas[0]).toMatchObject({ page: 0, type: 'signature' })
    expect(String(rubricas[0]?.['signer_token'])).toMatch(/-s0$/)

    const envio = await prisma.envioParaAssinatura.findFirstOrThrow({ where: { documentoId: id } })
    expect(envio.posicoesDefinidasEm).not.toBeNull()
  })

  it('recusa da ZapSign na criação: nada gravado', async () => {
    criarFalha = true
    const id = await documento(TipoDocumento.DECLARACAO, 'Declaracao-recusada.pdf')

    const resultado = await enviarParaAssinatura(sessao(), id, EMAIL_DO_OPERADOR)
    expect(resultado.situacao).toBe('falha_na_d4sign')
    if (resultado.situacao === 'falha_na_d4sign') expect(resultado.motivo).toMatch(/plano/)
    expect(await prisma.envioParaAssinatura.count({ where: { documentoId: id } })).toBe(0)
  })
})

describe('a volta: conferência e aviso automático', () => {
  it('pendente: registra quantos assinaram, sem arquivar', async () => {
    const id = await documento(TipoDocumento.DECLARACAO, 'Declaracao-pendente.pdf')
    await enviarParaAssinatura(sessao(), id, EMAIL_DO_OPERADOR)
    const envio = await prisma.envioParaAssinatura.findFirstOrThrow({ where: { documentoId: id } })

    const resultado = await conferirAssinatura(sessao(), envio.id, EMAIL_DO_OPERADOR)
    expect(resultado.situacao).toBe('aguardando')
    const depois = await prisma.envioParaAssinatura.findUniqueOrThrow({ where: { id: envio.id } })
    expect(depois.situacaoNaD4Sign).toBe('0 de 1 assinaram')
  })

  it('contrato assinado, pelo aviso da ZapSign: arquiva como ASSINADO_NA_ZAPSIGN e libera o acesso', async () => {
    const id = await documento(TipoDocumento.CONTRATO, 'Contrato.pdf')
    await enviarParaAssinatura(sessao(), id, EMAIL_DO_OPERADOR)
    const envio = await prisma.envioParaAssinatura.findFirstOrThrow({ where: { documentoId: id } })
    assinarTodos(envio.uuidDocumento)

    const aviso = (corpo: unknown, chave = 'segredo123') =>
      retornoDaZapSign(
        new NextRequest(`https://portal.test/api/zapsign/retorno?chave=${chave}`, {
          method: 'POST',
          body: JSON.stringify(corpo),
        }),
      )

    // chave errada não consulta nada
    expect((await aviso({ token: envio.uuidDocumento }, 'errada')).status).toBe(401)

    // o corpo não decide nada: só o token é lido
    expect((await aviso({ token: envio.uuidDocumento, status: 'qualquer' })).status).toBe(200)
    // aviso repetido não duplica
    expect((await aviso({ token: envio.uuidDocumento })).status).toBe(200)

    const depois = await prisma.envioParaAssinatura.findUniqueOrThrow({ where: { id: envio.id } })
    expect(depois.situacao).toBe(SituacaoDoEnvio.ASSINADO)
    const assinados = await prisma.documento.findMany({
      where: { clienteId, origem: OrigemDoDocumento.ASSINADO_NA_ZAPSIGN, tipo: TipoDocumento.CONTRATO },
    })
    expect(assinados).toHaveLength(1)

    const cliente = await prisma.cliente.findUniqueOrThrow({ where: { id: clienteId } })
    expect(cliente.contratoAssinadoEm).not.toBeNull()
  })

  it('aviso de documento que não é deste portal: 200 e nada muda', async () => {
    const resposta = await retornoDaZapSign(
      new NextRequest('https://portal.test/api/zapsign/retorno?chave=segredo123', {
        method: 'POST',
        body: JSON.stringify({ token: 'documento-de-fora-do-portal' }),
      }),
    )
    expect(resposta.status).toBe(200)
  })
})

describe('reenvio pela ZapSign do que ficou pendente na D4Sign', () => {
  async function pendenteNaD4Sign(nome: string): Promise<{ documentoId: string; envioId: string; uuid: string }> {
    const documentoId = await documento(TipoDocumento.CONTRATO, nome)
    const uuid = `d4-${nome}-${Date.now()}`
    const envio = await prisma.envioParaAssinatura.create({
      data: {
        documentoId,
        provedor: ProvedorAssinatura.D4SIGN,
        uuidDocumento: uuid,
        cofre: 'cofre-de-mentira',
        situacao: SituacaoDoEnvio.AGUARDANDO,
        signatarios: [
          { papel: 'cliente', nome: 'Cliente ZapSign', email: EMAIL_DO_CLIENTE },
          { papel: 'escritorio', nome: 'Dr. Sergio', email: 'contato@eferreira.adv.br' },
          { papel: PapelDaParte.TESTEMUNHA, nome: 'Testemunha', email: 'testemunha@exemplo.invalido' },
        ],
        enviadoEm: new Date(),
        pedidoPorId: operadorId,
      },
      select: { id: true },
    })
    return { documentoId, envioId: envio.id, uuid }
  }

  it('com a ZapSign desligada: nada acontece, nem na D4Sign', async () => {
    const { documentoId, envioId } = await pendenteNaD4Sign('desligada')
    process.env['ASSINATURA_PROVEDOR'] = 'd4sign'

    const resultado = await reenviarPelaZapSign(sessao(), documentoId, EMAIL_DO_OPERADOR)
    expect(resultado.situacao).toBe('zapsign_desligada')
    expect(chamadas).toHaveLength(0)
    const intacto = await prisma.envioParaAssinatura.findUniqueOrThrow({ where: { id: envioId } })
    expect(intacto.situacao).toBe(SituacaoDoEnvio.AGUARDANDO)
  })

  it('ligada: envia pela ZapSign com as mesmas pessoas e SÓ DEPOIS cancela na D4Sign', async () => {
    const { documentoId, envioId, uuid } = await pendenteNaD4Sign('ligada')

    const resultado = await reenviarPelaZapSign(sessao(), documentoId, EMAIL_DO_OPERADOR)
    expect(resultado.situacao).toBe('enviado')

    const ordem = chamadas.map((c) => c.url)
    const criou = ordem.findIndex((u) => u.endsWith('/docs/'))
    const cancelou = ordem.findIndex((u) => u.includes(`/documents/${uuid}/cancel`))
    expect(criou).toBeGreaterThanOrEqual(0)
    expect(cancelou).toBeGreaterThan(criou)

    // a testemunha do envio antigo continua na lista
    const signers = chamadas[criou]?.corpo?.['signers'] as { email: string }[]
    expect(signers.map((s) => s.email)).toContain('testemunha@exemplo.invalido')

    const antigo = await prisma.envioParaAssinatura.findUniqueOrThrow({ where: { id: envioId } })
    expect(antigo.situacao).toBe(SituacaoDoEnvio.CANCELADO)
    expect(antigo.situacaoNaD4Sign).toMatch(/cancelado na D4Sign/)
    const novo = await prisma.envioParaAssinatura.findFirstOrThrow({
      where: { documentoId, provedor: ProvedorAssinatura.ZAPSIGN },
    })
    expect(novo.situacao).toBe(SituacaoDoEnvio.AGUARDANDO)
  })

  it('se o envio novo não sair, o da D4Sign volta a valer e nada lá é cancelado', async () => {
    const { documentoId, envioId } = await pendenteNaD4Sign('falhou')
    criarFalha = true

    const resultado = await reenviarPelaZapSign(sessao(), documentoId, EMAIL_DO_OPERADOR)
    expect(resultado.situacao).toBe('falha_na_d4sign')
    expect(chamadas.some((c) => c.url.includes('/cancel'))).toBe(false)
    const antigo = await prisma.envioParaAssinatura.findUniqueOrThrow({ where: { id: envioId } })
    expect(antigo.situacao).toBe(SituacaoDoEnvio.AGUARDANDO)
  })
})
