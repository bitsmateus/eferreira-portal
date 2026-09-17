/**
 * O bug de produção de 17/09/2026: um documento que passou por mais de uma
 * tentativa de envio ficou com signatários duplicados na D4Sign — createlist
 * não é idempotente lá, cada chamada ACRESCENTA gente à lista em vez de
 * substituir. O signatário do escritório (com conta na D4Sign) absorveu as
 * cópias sem problema; o do cliente (sem conta, `foreign`) ganhou vagas "a
 * assinar" extras que nunca seriam completadas, e o documento nunca fechou
 * 100% mesmo com as duas partes de verdade já tendo assinado.
 *
 * Este teste prova a correção: reaproveitar um envio parado no cofre
 * (`signatariosDefinidosEm` já preenchido) NÃO chama createlist de novo — só
 * repete o passo que realmente falhou (`sendtosigner`).
 *
 * Contra o banco de verdade porque `enviarParaAssinatura` grava e lê o envio
 * inteiro; a D4Sign em si é substituída por um `fetch` dublado — chamar a de
 * verdade gastaria crédito e mandaria e-mail.
 */

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { PerfilUsuario, SituacaoDoEnvio, TipoDocumento, TipoPessoa } from '@prisma/client'

import { enviarParaAssinatura } from '@/lib/assinaturas'
import { prisma } from '@/lib/prisma'

const DOCUMENTO = '52998224725'
const EMAIL_DO_OPERADOR = 'operador.teste.reenvio@exemplo.invalido'

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
  await prisma.cliente.deleteMany({ where: { documento: DOCUMENTO } })
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
      nome: 'Operador do teste de reenvio',
      email: EMAIL_DO_OPERADOR,
      senhaHash: 'nao-usado',
      perfil: PerfilUsuario.OPERADOR,
    },
    select: { id: true },
  })
  operadorId = operador.id

  const cliente = await prisma.cliente.create({
    data: {
      documento: DOCUMENTO,
      nome: 'Cliente do Reenvio',
      nomeBusca: 'cliente do reenvio',
      tipoPessoa: TipoPessoa.FISICA,
      email: 'cliente.reenvio@exemplo.invalido',
      cidade: 'São Paulo',
      uf: 'SP',
      contratoAssinadoEm: new Date(),
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

describe('reenviar um documento parado no cofre', () => {
  it('não chama createlist de novo quando os signatários já foram definidos', async () => {
    const documento = await prisma.documento.create({
      data: {
        clienteId,
        tipo: TipoDocumento.CONTRATO,
        nome: `Contrato - ${DOCUMENTO}.pdf`,
        chaveArquivo: `documentos/teste-reenvio-${DOCUMENTO}`,
        tipoConteudo: 'application/pdf',
        tamanhoBytes: 10,
      },
      select: { id: true },
    })

    await prisma.envioParaAssinatura.create({
      data: {
        documentoId: documento.id,
        uuidDocumento: 'uuid-ja-com-signatarios',
        cofre: 'cofre-de-mentira',
        situacao: SituacaoDoEnvio.NO_COFRE,
        signatarios: [{ papel: 'cliente', nome: 'Cliente do Reenvio', email: 'cliente.reenvio@exemplo.invalido' }],
        // O passo que importa para este teste: createlist já tinha funcionado
        // numa tentativa anterior.
        signatariosDefinidosEm: new Date(Date.now() - 60_000),
        pedidoPorId: operadorId,
      },
    })

    const caminhosChamados: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (entrada: string | URL) => {
        const url = String(entrada)
        caminhosChamados.push(url)

        if (url.includes('/account/balance')) {
          return respostaJson({ credit: '10', sent: '2' })
        }
        if (url.includes('/createlist')) {
          // Não deveria ser chamado — se for, o teste falha aqui mesmo,
          // simulando a D4Sign de verdade aceitando e duplicando a lista.
          return respostaJson({ message: [{ key_signer: 'novo-duplicado' }] })
        }
        if (url.includes('/sendtosigner')) {
          return respostaJson({ message: 'Success' })
        }
        throw new Error(`chamada inesperada: ${url}`)
      }),
    )

    const resultado = await enviarParaAssinatura(
      sessaoDaEquipe(),
      documento.id,
      EMAIL_DO_OPERADOR,
    )

    expect(resultado.situacao).toBe('enviado')
    expect(caminhosChamados.some((url) => url.includes('/createlist'))).toBe(false)
    expect(caminhosChamados.some((url) => url.includes('/sendtosigner'))).toBe(true)

    const envio = await prisma.envioParaAssinatura.findFirst({
      where: { documentoId: documento.id },
    })
    expect(envio?.situacao).toBe(SituacaoDoEnvio.AGUARDANDO)
    expect(envio?.enviadoEm).not.toBeNull()
  })

  it('chama createlist quando os signatários ainda não tinham sido definidos', async () => {
    const documento = await prisma.documento.create({
      data: {
        clienteId,
        tipo: TipoDocumento.DECLARACAO,
        nome: 'Declaracao.pdf',
        chaveArquivo: `documentos/teste-reenvio-sem-signatarios-${DOCUMENTO}`,
        tipoConteudo: 'application/pdf',
        tamanhoBytes: 10,
      },
      select: { id: true },
    })

    await prisma.envioParaAssinatura.create({
      data: {
        documentoId: documento.id,
        uuidDocumento: 'uuid-sem-signatarios-ainda',
        cofre: 'cofre-de-mentira',
        situacao: SituacaoDoEnvio.NO_COFRE,
        signatarios: [],
        // signatariosDefinidosEm continua nulo: createlist nunca funcionou
        // numa tentativa anterior (foi exatamente o caso do "foresign").
        pedidoPorId: operadorId,
      },
    })

    const caminhosChamados: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (entrada: string | URL) => {
        const url = String(entrada)
        caminhosChamados.push(url)

        if (url.includes('/account/balance')) return respostaJson({ credit: '10', sent: '2' })
        if (url.includes('/createlist')) {
          return respostaJson({ message: [{ key_signer: 'novo-de-verdade' }] })
        }
        if (url.includes('/sendtosigner')) return respostaJson({ message: 'Success' })
        throw new Error(`chamada inesperada: ${url}`)
      }),
    )

    const resultado = await enviarParaAssinatura(
      sessaoDaEquipe(),
      documento.id,
      EMAIL_DO_OPERADOR,
    )

    expect(resultado.situacao).toBe('enviado')
    expect(caminhosChamados.some((url) => url.includes('/createlist'))).toBe(true)

    const envio = await prisma.envioParaAssinatura.findFirst({
      where: { documentoId: documento.id },
    })
    expect(envio?.signatariosDefinidosEm).not.toBeNull()
  })
})
