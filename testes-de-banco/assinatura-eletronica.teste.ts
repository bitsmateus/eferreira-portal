/**
 * As travas do envio para assinatura, contra o Postgres de verdade.
 *
 * Aqui não se testa a D4Sign: testa-se tudo o que acontece **antes** de falar
 * com ela. É o que importa, porque do outro lado não há ensaio — passado o
 * último `if`, um crédito do escritório foi gasto e um e-mail de assinatura
 * chegou à caixa de alguém. Nenhum destes casos chega a tocar a rede: eles
 * param na conferência que vem antes.
 *
 * As credenciais da D4Sign são substituídas por valores de mentira. Sem isso,
 * `prepararEnvio` pararia em "sem_integracao" na máquina de quem não tem o
 * token e este arquivo passaria sem provar nada.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  PapelDaParte,
  PerfilUsuario,
  SituacaoDoEnvio,
  TipoDocumento,
  TipoPessoa,
} from '@prisma/client'

import { envioDoDocumento, enviosDoCliente, prepararEnvio } from '@/lib/assinaturas'
import { SemAutorizacao } from '@/lib/autorizacao'
import { prisma } from '@/lib/prisma'

const DOCUMENTO_A = '52998224725'
const DOCUMENTO_B = '11222333000181'
const DOCUMENTO_SEM_EMAIL = '11144477735'
const DOCUMENTOS = [DOCUMENTO_A, DOCUMENTO_B, DOCUMENTO_SEM_EMAIL]
const EMAIL_DO_OPERADOR = 'operador.teste.assinatura@exemplo.invalido'

type Montado = {
  clienteId: string
  contratoId: string
  usuarioDoClienteId: string
}

let a: Montado
let b: Montado
let semEmail: Montado
let operadorId: string

const CREDENCIAIS_DE_MENTIRA = {
  D4SIGN_TOKEN_API: 'token-de-mentira',
  D4SIGN_CRYPT_KEY: 'crypt-de-mentira',
  D4SIGN_COFRE: 'cofre-de-mentira',
  // Endereço morto, de propósito. Com a URL de verdade, o `saldo()` de
  // `prepararEnvio` sairia pela internet até a D4Sign a cada execução — e um
  // teste que depende da rede de alguém falha por motivo que não é o dele.
  // A porta 9 recusa a conexão na hora.
  D4SIGN_URL: 'http://127.0.0.1:9/api/v1',
}

let ambienteAnterior: NodeJS.ProcessEnv

function sessaoDaEquipe() {
  return {
    usuarioId: operadorId,
    perfil: PerfilUsuario.OPERADOR,
    clienteId: null,
    contratoAssinado: false,
  }
}

function sessaoDoCliente(montado: Montado) {
  return {
    usuarioId: montado.usuarioDoClienteId,
    perfil: PerfilUsuario.CLIENTE,
    clienteId: montado.clienteId,
    contratoAssinado: true,
  }
}

async function limpar(): Promise<void> {
  await prisma.cliente.deleteMany({ where: { documento: { in: DOCUMENTOS } } })
  await prisma.usuario.deleteMany({ where: { email: EMAIL_DO_OPERADOR } })
}

async function montar(
  documento: string,
  nome: string,
  email: string | null,
  tipoPessoa: TipoPessoa,
): Promise<Montado> {
  const cliente = await prisma.cliente.create({
    data: {
      documento,
      nome,
      nomeBusca: nome.toLowerCase(),
      tipoPessoa,
      email,
      cidade: 'São Paulo',
      uf: 'SP',
      contratoAssinadoEm: new Date(),
    },
    select: { id: true },
  })

  const contrato = await prisma.documento.create({
    data: {
      clienteId: cliente.id,
      tipo: TipoDocumento.CONTRATO,
      nome: `Contrato - ${documento}.pdf`,
      chaveArquivo: `documentos/teste-assinatura-${documento}`,
      tipoConteudo: 'application/pdf',
      tamanhoBytes: 1024,
    },
    select: { id: true },
  })

  const usuario = await prisma.usuario.create({
    data: {
      nome,
      perfil: PerfilUsuario.CLIENTE,
      clienteId: cliente.id,
    },
    select: { id: true },
  })

  return {
    clienteId: cliente.id,
    contratoId: contrato.id,
    usuarioDoClienteId: usuario.id,
  }
}

beforeAll(async () => {
  ambienteAnterior = { ...process.env }
  Object.assign(process.env, CREDENCIAIS_DE_MENTIRA)

  await limpar()

  const operador = await prisma.usuario.create({
    data: {
      nome: 'Operador do teste de assinatura',
      email: EMAIL_DO_OPERADOR,
      senhaHash: 'nao-usado',
      perfil: PerfilUsuario.OPERADOR,
    },
    select: { id: true },
  })
  operadorId = operador.id

  a = await montar(DOCUMENTO_A, 'Cliente A', 'a@exemplo.invalido', TipoPessoa.FISICA)
  b = await montar(
    DOCUMENTO_B,
    'Empresa B',
    'b@exemplo.invalido',
    TipoPessoa.JURIDICA,
  )
  semEmail = await montar(
    DOCUMENTO_SEM_EMAIL,
    'Cliente sem e-mail',
    null,
    TipoPessoa.FISICA,
  )
})

afterAll(async () => {
  await limpar()
  process.env = ambienteAnterior
  await prisma.$disconnect()
})

describe('quem pode chegar perto do envio', () => {
  // Regra 2: o cliente não manda documento para assinatura. Ele nem sabe que
  // esta parte do sistema existe.
  it('a sessão do cliente não consulta envios', async () => {
    await expect(
      envioDoDocumento(sessaoDoCliente(a), a.contratoId),
    ).rejects.toBeInstanceOf(SemAutorizacao)

    await expect(
      enviosDoCliente(sessaoDoCliente(a), a.clienteId),
    ).rejects.toBeInstanceOf(SemAutorizacao)
  })

  it('a sessão do cliente não prepara envio nem do próprio contrato', async () => {
    await expect(
      prepararEnvio(sessaoDoCliente(a), a.contratoId),
    ).rejects.toBeInstanceOf(SemAutorizacao)
  })
})

describe('os envios de um cliente não se misturam com os de outro', () => {
  let envioDeA: string

  beforeAll(async () => {
    const criado = await prisma.envioParaAssinatura.create({
      data: {
        documentoId: a.contratoId,
        uuidDocumento: 'uuid-do-a',
        cofre: 'cofre-de-mentira',
        situacao: SituacaoDoEnvio.AGUARDANDO,
        signatarios: [{ papel: 'cliente', nome: 'Cliente A', email: 'a@exemplo.invalido' }],
        enviadoEm: new Date(),
        pedidoPorId: operadorId,
      },
      select: { id: true },
    })
    envioDeA = criado.id

    await prisma.envioParaAssinatura.create({
      data: {
        documentoId: b.contratoId,
        uuidDocumento: 'uuid-do-b',
        cofre: 'cofre-de-mentira',
        situacao: SituacaoDoEnvio.AGUARDANDO,
        signatarios: [],
        enviadoEm: new Date(),
        pedidoPorId: operadorId,
      },
    })
  })

  it('a lista do cliente A traz só o documento do cliente A', async () => {
    const envios = await enviosDoCliente(sessaoDaEquipe(), a.clienteId)

    expect(envios.size).toBe(1)
    expect(envios.get(a.contratoId)?.id).toBe(envioDeA)
    expect(envios.get(b.contratoId)).toBeUndefined()
  })

  it('guarda para quem o e-mail foi', async () => {
    const envio = await envioDoDocumento(sessaoDaEquipe(), a.contratoId)

    expect(envio?.partes[0]?.email).toBe('a@exemplo.invalido')
  })

  // Enviar duas vezes gastaria dois créditos e deixaria duas cópias do mesmo
  // contrato no cofre do escritório, cada uma com um link de assinatura.
  it('um documento já enviado não é enviado de novo', async () => {
    const preparo = await prepararEnvio(sessaoDaEquipe(), a.contratoId)

    expect(preparo.situacao).toBe('ja_enviado')
  })
})

describe('o que o preparo recusa antes de gastar crédito', () => {
  // Desde 17/09/2026, anexo VAI para assinatura — só que ninguém assina
  // "automaticamente" como no contrato: sem escolha na tela, não há para quem
  // mandar. Ver `partes.ts` e `SignatarioAvulso`.
  it('anexo sem signatário escolhido não tem para quem mandar', async () => {
    const anexo = await prisma.documento.create({
      data: {
        clienteId: a.clienteId,
        tipo: TipoDocumento.ANEXO,
        nome: 'Termo de acordo.pdf',
        chaveArquivo: 'documentos/teste-assinatura-anexo',
        tipoConteudo: 'application/pdf',
        tamanhoBytes: 10,
      },
      select: { id: true },
    })

    const preparo = await prepararEnvio(sessaoDaEquipe(), anexo.id)
    expect(preparo.situacao).toBe('sem_signatarios')
  })

  it('anexo com signatário avulso escolhido segue adiante', async () => {
    const anexo = await prisma.documento.create({
      data: {
        clienteId: a.clienteId,
        tipo: TipoDocumento.ANEXO,
        nome: 'Termo de acordo com testemunha.pdf',
        chaveArquivo: 'documentos/teste-assinatura-anexo-com-avulso',
        tipoConteudo: 'application/pdf',
        tamanhoBytes: 10,
      },
      select: { id: true },
    })

    const preparo = await prepararEnvio(sessaoDaEquipe(), anexo.id, [
      { nome: 'Testemunha de Teste', email: 'testemunha@exemplo.invalido', papel: PapelDaParte.TESTEMUNHA },
    ])

    // Não trava em `sem_signatarios` nem `sem_email` — a única coisa que
    // impede 'pronto' aqui é a consulta de saldo não achar a D4Sign, que
    // este arquivo trata como esperado (ver o comentário de `D4SIGN_URL`).
    expect(preparo.situacao).not.toBe('sem_signatarios')
    expect(preparo.situacao).not.toBe('sem_email')
    if (preparo.situacao === 'pronto') {
      expect(preparo.partes).toEqual([
        { papel: PapelDaParte.TESTEMUNHA, nome: 'Testemunha de Teste', email: 'testemunha@exemplo.invalido' },
      ])
    }
  })

  it('documento já assinado não vai para assinatura', async () => {
    const assinado = await prisma.documento.create({
      data: {
        clienteId: a.clienteId,
        tipo: TipoDocumento.PROCURACAO,
        nome: 'Procuracao.pdf',
        chaveArquivo: 'documentos/teste-assinatura-ja-assinado',
        tipoConteudo: 'application/pdf',
        tamanhoBytes: 10,
        assinadoEm: new Date(),
      },
      select: { id: true },
    })

    const preparo = await prepararEnvio(sessaoDaEquipe(), assinado.id)
    expect(preparo.situacao).toBe('ja_assinado')
  })

  // Sem endereço, a D4Sign aceitaria a lista e o documento ficaria parado para
  // sempre — com o crédito já gasto e sem ninguém para assinar.
  it('cliente sem e-mail não tem para onde mandar', async () => {
    const preparo = await prepararEnvio(sessaoDaEquipe(), semEmail.contratoId)

    expect(preparo.situacao).toBe('sem_email')
    if (preparo.situacao === 'sem_email') {
      expect(preparo.faltando).toContain('Cliente')
    }
  })

  it('documento de id inventado não encontra nada', async () => {
    const preparo = await prepararEnvio(sessaoDaEquipe(), 'id-que-nao-existe')
    expect(preparo.situacao).toBe('nao_encontrado')
  })

  // Uma tentativa anterior que subiu ao cofre e não saiu pode ser retomada, e
  // retomar reaproveita o documento que já está lá em vez de subir outra cópia.
  it('um envio parado no cofre fica retomável, não bloqueia', async () => {
    const documento = await prisma.documento.create({
      data: {
        clienteId: a.clienteId,
        tipo: TipoDocumento.DECLARACAO,
        nome: 'Declaracao.pdf',
        chaveArquivo: 'documentos/teste-assinatura-no-cofre',
        tipoConteudo: 'application/pdf',
        tamanhoBytes: 10,
      },
      select: { id: true },
    })

    await prisma.envioParaAssinatura.create({
      data: {
        documentoId: documento.id,
        uuidDocumento: 'uuid-parado-no-cofre',
        cofre: 'cofre-de-mentira',
        situacao: SituacaoDoEnvio.NO_COFRE,
        signatarios: [],
        pedidoPorId: operadorId,
      },
    })

    const envio = await envioDoDocumento(sessaoDaEquipe(), documento.id)
    expect(envio?.situacao).toBe(SituacaoDoEnvio.NO_COFRE)

    // O preparo segue adiante: só não conclui aqui porque a consulta de saldo
    // é a primeira coisa que fala com a D4Sign, e ela não existe neste teste.
    const preparo = await prepararEnvio(sessaoDaEquipe(), documento.id)
    expect(preparo.situacao).not.toBe('ja_enviado')
  })
})
