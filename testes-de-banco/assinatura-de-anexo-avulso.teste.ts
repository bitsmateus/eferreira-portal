/**
 * Envio de um documento AVULSO (ANEXO) para signatários que não são clientes
 * do escritório — parte contrária, testemunha, advogado externo. Pedido do
 * escritório em 17/09/2026, revertendo a decisão de 14/09/2026 que mantinha
 * testemunha fora da assinatura eletrônica (ver o comentário grande em
 * `src/lib/assinaturas.ts`, acima de `ACAO_ASSINAR`).
 *
 * Contra o banco de verdade porque `enviarParaAssinatura` grava e lê o envio
 * inteiro; a D4Sign em si é substituída por um `fetch` dublado, mesmo padrão
 * de `reenvio-nao-duplica-signatarios.teste.ts`.
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
import { prisma } from '@/lib/prisma'

const DOCUMENTO_DO_CLIENTE = '52998224725'
const EMAIL_DO_OPERADOR = 'operador.teste.anexo.avulso@exemplo.invalido'

const CREDENCIAIS = {
  D4SIGN_TOKEN_API: 'token-de-mentira',
  D4SIGN_CRYPT_KEY: 'crypt-de-mentira',
  D4SIGN_COFRE: 'cofre-de-mentira',
  D4SIGN_URL: 'https://d4sign.invalido/api/v1',
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

async function limpar(): Promise<void> {
  await prisma.cliente.deleteMany({ where: { documento: DOCUMENTO_DO_CLIENTE } })
  await prisma.usuario.deleteMany({ where: { email: EMAIL_DO_OPERADOR } })
}

function respostaJson(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

beforeAll(async () => {
  ambienteAnterior = { ...process.env }
  Object.assign(process.env, CREDENCIAIS)

  await limpar()

  const operador = await prisma.usuario.create({
    data: {
      nome: 'Operador do teste de anexo avulso',
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
      nome: 'Cliente do Anexo Avulso',
      nomeBusca: 'cliente do anexo avulso',
      tipoPessoa: TipoPessoa.FISICA,
      email: 'cliente.anexo.avulso@exemplo.invalido',
      cidade: 'São Paulo',
      uf: 'SP',
    },
    select: { id: true },
  })
  clienteId = cliente.id
})

afterAll(async () => {
  await limpar()
  process.env = ambienteAnterior
  await prisma.$disconnect()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('enviarParaAssinatura — documento avulso com signatários escolhidos na hora', () => {
  it('manda para os avulsos escolhidos, não para o cliente', async () => {
    const anexo = await prisma.documento.create({
      data: {
        clienteId,
        tipo: TipoDocumento.ANEXO,
        nome: 'Termo de acordo.pdf',
        chaveArquivo: `documentos/teste-anexo-avulso-${DOCUMENTO_DO_CLIENTE}`,
        tipoConteudo: 'application/pdf',
        tamanhoBytes: 10,
      },
      select: { id: true },
    })

    // Mesmo atalho de `reenvio-nao-duplica-signatarios.teste.ts`: um envio já
    // parado no cofre pula `subirDocumento`/`lerArquivo` (armazenamento real),
    // indo direto para o que este teste quer provar — quem a D4Sign recebe.
    await prisma.envioParaAssinatura.create({
      data: {
        documentoId: anexo.id,
        uuidDocumento: 'uuid-do-anexo-avulso',
        cofre: 'cofre-de-mentira',
        situacao: SituacaoDoEnvio.NO_COFRE,
        signatarios: [],
        pedidoPorId: operadorId,
      },
    })

    const emailsNoCreatelist: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (entrada: string | URL, init?: RequestInit) => {
        const url = String(entrada)

        if (url.includes('/account/balance')) return respostaJson({ credit: '10', sent: '2' })
        if (url.includes('/createlist')) {
          const corpo = JSON.parse(String(init?.body ?? '{}')) as {
            signers?: { email: string }[]
          }
          for (const signatario of corpo.signers ?? []) {
            emailsNoCreatelist.push(signatario.email)
          }
          return respostaJson({
            message: (corpo.signers ?? []).map((s) => ({ key_signer: 'k', email: s.email })),
          })
        }
        if (url.includes('/sendtosigner')) return respostaJson({ message: 'Success' })
        throw new Error(`chamada inesperada: ${url}`)
      }),
    )

    const resultado = await enviarParaAssinatura(
      sessaoDaEquipe(),
      anexo.id,
      EMAIL_DO_OPERADOR,
      [
        {
          nome: 'Advogado Externo',
          email: 'advogado.externo@exemplo.invalido',
          papel: PapelDaParte.ADVOGADO,
        },
        {
          nome: 'Testemunha do Acordo',
          email: 'testemunha.acordo@exemplo.invalido',
          papel: PapelDaParte.TESTEMUNHA,
        },
      ],
    )

    expect(resultado.situacao).toBe('enviado')
    expect(emailsNoCreatelist.sort()).toEqual(
      ['advogado.externo@exemplo.invalido', 'testemunha.acordo@exemplo.invalido'].sort(),
    )
    // O e-mail do cliente NÃO foi um dos signatários — quem manda a lista é a
    // escolha da tela, não `partesQueAssinam`.
    expect(emailsNoCreatelist).not.toContain('cliente.anexo.avulso@exemplo.invalido')

    const envio = await prisma.envioParaAssinatura.findFirst({
      where: { documentoId: anexo.id },
    })
    expect(envio?.situacao).toBe(SituacaoDoEnvio.AGUARDANDO)
    expect(JSON.stringify(envio?.signatarios)).toContain('TESTEMUNHA')
  })

  it('recusa enviar um anexo sem nenhum signatário escolhido', async () => {
    const anexo = await prisma.documento.create({
      data: {
        clienteId,
        tipo: TipoDocumento.ANEXO,
        nome: 'Termo de acordo sem signatário.pdf',
        chaveArquivo: `documentos/teste-anexo-sem-signatario-${DOCUMENTO_DO_CLIENTE}`,
        tipoConteudo: 'application/pdf',
        tamanhoBytes: 10,
      },
      select: { id: true },
    })

    const resultado = await enviarParaAssinatura(
      sessaoDaEquipe(),
      anexo.id,
      EMAIL_DO_OPERADOR,
      [],
    )

    expect(resultado.situacao).toBe('sem_signatarios')

    const envio = await prisma.envioParaAssinatura.findFirst({
      where: { documentoId: anexo.id },
    })
    expect(envio).toBeNull()
  })
})
