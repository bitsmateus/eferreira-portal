/**
 * O envio com a posição das assinaturas ligada (24/09/2026), contra o banco e
 * o armazenamento de verdade; a D4Sign é um `fetch` dublado.
 *
 * O que se prova: com `D4SIGN_POSICIONAR_ASSINATURA=1` o `addpins` sai DEPOIS
 * dos signatários e ANTES do passo que cobra; se ele falhar, nada é cobrado; e
 * um retry não repete o que já funcionou. Desligado (o padrão), a chamada nem
 * acontece — `assinatura-de-anexo-avulso.teste.ts` já prova isso, porque um
 * `addpins` inesperado ali faria o `fetch` dublado lançar.
 */

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  PapelDaParte,
  PerfilUsuario,
  SituacaoDoEnvio,
  TipoDocumento,
  TipoPessoa,
} from '@prisma/client'

import { enviarParaAssinatura } from '@/lib/assinaturas'
import { enviarArquivo, removerArquivo } from '@/lib/armazenamento'
import { prisma } from '@/lib/prisma'
import { pdfMinimo } from '../testes/ajudas/pdf-minimo'

const DOCUMENTO_DO_CLIENTE = '52998224725'
const EMAIL_DO_OPERADOR = 'operador.teste.posicao.assinatura@exemplo.invalido'
const CHAVES_DO_PDF = [1, 2].map((n) => `documentos/teste-posicao-${DOCUMENTO_DO_CLIENTE}-${n}.pdf`)
let proximaChave = 0

const CREDENCIAIS = {
  D4SIGN_TOKEN_API: 'token-de-mentira',
  D4SIGN_CRYPT_KEY: 'crypt-de-mentira',
  D4SIGN_COFRE: 'cofre-de-mentira',
  D4SIGN_URL: 'https://d4sign.invalido/api/v1',
  D4SIGN_POSICIONAR_ASSINATURA: '1',
  D4SIGN_PIN_AJUSTE_X_MM: '0',
  D4SIGN_PIN_AJUSTE_Y_MM: '0',
}

let ambienteAnterior: NodeJS.ProcessEnv
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

function respostaJson(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

async function limpar(): Promise<void> {
  await prisma.cliente.deleteMany({ where: { documento: DOCUMENTO_DO_CLIENTE } })
  await prisma.usuario.deleteMany({ where: { email: EMAIL_DO_OPERADOR } })
}

beforeAll(async () => {
  ambienteAnterior = { ...process.env }
  Object.assign(process.env, CREDENCIAIS)

  await limpar()

  operadorId = (
    await prisma.usuario.create({
      data: {
        nome: 'Operador do teste de posição da assinatura',
        email: EMAIL_DO_OPERADOR,
        senhaHash: 'nao-usado',
        perfil: PerfilUsuario.OPERADOR,
      },
      select: { id: true },
    })
  ).id

  clienteId = (
    await prisma.cliente.create({
      data: {
        documento: DOCUMENTO_DO_CLIENTE,
        nome: 'Cliente da Posição da Assinatura',
        nomeBusca: 'cliente da posicao da assinatura',
        tipoPessoa: TipoPessoa.FISICA,
        email: 'cliente.posicao@exemplo.invalido',
        cidade: 'São Paulo',
        uf: 'SP',
      },
      select: { id: true },
    })
  ).id

  for (const chave of CHAVES_DO_PDF) {
    await enviarArquivo(
      chave,
      pdfMinimo([[{ texto: 'pagina um', x: 50, y: 50 }], [{ texto: 'pagina dois', x: 50, y: 50 }]]),
      'application/pdf',
    )
  }
})

afterAll(async () => {
  await limpar()
  for (const chave of CHAVES_DO_PDF) await removerArquivo(chave).catch(() => undefined)
  process.env = ambienteAnterior
  await prisma.$disconnect()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function novoAnexoNoCofre() {
  const anexo = await prisma.documento.create({
    data: {
      clienteId,
      tipo: TipoDocumento.ANEXO,
      nome: 'Termo de acordo.pdf',
      chaveArquivo: CHAVES_DO_PDF[proximaChave++] ?? '',
      tipoConteudo: 'application/pdf',
      tamanhoBytes: 10,
    },
    select: { id: true },
  })
  await prisma.envioParaAssinatura.create({
    data: {
      documentoId: anexo.id,
      uuidDocumento: `uuid-da-posicao-${anexo.id}`,
      cofre: 'cofre-de-mentira',
      situacao: SituacaoDoEnvio.NO_COFRE,
      signatarios: [],
      pedidoPorId: operadorId,
    },
  })
  return anexo.id
}

const AVULSOS = [
  {
    nome: 'Advogado Externo',
    email: 'advogado.posicao@exemplo.invalido',
    papel: PapelDaParte.ADVOGADO,
    posicao: { pagina: 1, lado: 'direita' as const, alturaEmPercentual: 50 },
  },
  {
    nome: 'Testemunha',
    email: 'testemunha.posicao@exemplo.invalido',
    papel: PapelDaParte.TESTEMUNHA,
  },
]

type Chamada = { url: string; corpo: unknown }

function dublarD4Sign(chamadas: Chamada[], opcoes: { addpinsFalha?: boolean } = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (entrada: string | URL, init?: RequestInit) => {
      const url = String(entrada)
      const corpo: unknown = init?.body === undefined ? undefined : JSON.parse(String(init.body))
      chamadas.push({ url, corpo })

      if (url.includes('/account/balance')) return respostaJson({ credit: '10', sent: '2' })
      if (url.includes('/createlist')) {
        const signers = (corpo as { signers: { email: string }[] }).signers
        return respostaJson({ message: signers.map((s) => ({ key_signer: 'k', email: s.email })) })
      }
      if (url.includes('/addpins')) {
        return opcoes.addpinsFalha === true
          ? respostaJson({ message: 'pin recusado' }, 400)
          : respostaJson({})
      }
      if (url.includes('/sendtosigner')) return respostaJson({ message: 'Success' })
      throw new Error(`chamada inesperada: ${url}`)
    }),
  )
}

const quais = (chamadas: Chamada[], trecho: string) =>
  chamadas.filter((chamada) => chamada.url.includes(trecho))

describe('envio com a posição das assinaturas ligada', () => {
  it('manda os pins depois dos signatários e antes de cobrar', async () => {
    const anexoId = await novoAnexoNoCofre()
    const chamadas: Chamada[] = []
    dublarD4Sign(chamadas)

    const resultado = await enviarParaAssinatura(sessaoDaEquipe(), anexoId, EMAIL_DO_OPERADOR, AVULSOS)
    expect(resultado.situacao).toBe('enviado')

    const ordem = chamadas
      .map((c) => c.url)
      .filter((u) => /createlist|addpins|sendtosigner/.test(u))
      .map((u) => /createlist|addpins|sendtosigner/.exec(u)?.[0])
    expect(ordem).toEqual(['createlist', 'addpins', 'sendtosigner'])

    const pins = (quais(chamadas, '/addpins')[0]?.corpo as { pins: Record<string, string>[] }).pins
    expect(pins).toHaveLength(2)

    // Quem foi ajustado na tela: página 1, direita, 50% da altura (297mm).
    expect(pins[0]).toMatchObject({
      document: expect.stringContaining('uuid-da-posicao-'),
      email: 'advogado.posicao@exemplo.invalido',
      page: '1',
      position_y: '148.5',
      type: '0',
    })
    // Quem não foi: última página (2), perto do pé.
    expect(pins[1]).toMatchObject({ email: 'testemunha.posicao@exemplo.invalido', page: '2' })

    const envio = await prisma.envioParaAssinatura.findFirst({ where: { documentoId: anexoId } })
    expect(envio?.posicoesDefinidasEm).not.toBeNull()
  })

  it('se o addpins falha, nada é cobrado — e o retry só repete o que faltou', async () => {
    const anexoId = await novoAnexoNoCofre()

    const primeira: Chamada[] = []
    dublarD4Sign(primeira, { addpinsFalha: true })
    const falhou = await enviarParaAssinatura(sessaoDaEquipe(), anexoId, EMAIL_DO_OPERADOR, AVULSOS)

    expect(falhou.situacao).toBe('parou_no_cofre')
    expect(quais(primeira, '/sendtosigner')).toHaveLength(0)
    expect(quais(primeira, '/createlist')).toHaveLength(1)

    vi.unstubAllGlobals()
    const segunda: Chamada[] = []
    dublarD4Sign(segunda)
    const funcionou = await enviarParaAssinatura(sessaoDaEquipe(), anexoId, EMAIL_DO_OPERADOR, AVULSOS)

    expect(funcionou.situacao).toBe('enviado')
    // createlist NÃO se repete (não é idempotente); addpins e sendtosigner, sim.
    expect(quais(segunda, '/createlist')).toHaveLength(0)
    expect(quais(segunda, '/addpins')).toHaveLength(1)
    expect(quais(segunda, '/sendtosigner')).toHaveLength(1)
  })
})
