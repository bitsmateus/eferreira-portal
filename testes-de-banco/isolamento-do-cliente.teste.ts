/**
 * O teste que não pode falhar.
 *
 * Critério de pronto da Sprint 4: "dois clientes diferentes entram e nenhum
 * enxerga nada do outro, comprovado por teste automatizado".
 *
 * Ele roda contra o Postgres de verdade, com os filtros de autorização e o
 * Prisma de verdade, porque é exatamente a tradução do filtro em SQL que pode
 * falhar — um `AND` que vira `OR`, um `include` sem recorte, um `findUnique`
 * que escapou do filtro. Um teste com banco falso provaria apenas que o
 * dublê concorda com quem o escreveu.
 *
 * Regra 3: um cliente ver o caso de outro não é bug de interface, é incidente
 * de LGPD com dado de processo de terceiro. Este arquivo nunca é flexibilizado.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { PerfilUsuario, SituacaoUsuario, TipoDocumento, TipoPessoa } from '@prisma/client'

// O envio de e-mail é o único ponto substituído: é por ele que o teste lê o
// código que o cliente receberia. Tudo o mais — banco, hash, filtros de
// autorização — é real.
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

import { listarAndamentosDoCaso } from '@/lib/andamentos'
import {
  conferirCodigo,
  garantirUsuarioDoCliente,
  pedirCodigo,
} from '@/lib/acesso-do-cliente'
import { meusCasos, meusDocumentos } from '@/lib/area-do-cliente'
import { registrarAssinatura, revogarAcesso } from '@/lib/assinatura'
import { SemAutorizacao } from '@/lib/autorizacao'
import { obterCaso } from '@/lib/casos'
import { obterCliente } from '@/lib/clientes'
import { urlDeLeituraAutorizada } from '@/lib/documentos'
import { prisma } from '@/lib/prisma'

// ---------------------------------------------------------------------------
// Os dois clientes
//
// Documentos sintéticos que passam no dígito verificador, os mesmos já usados
// na suíte unitária. Os CPFs do protótipo NÃO servem: todos reprovam.
// ---------------------------------------------------------------------------

const DOCUMENTO_A = '52998224725'
const DOCUMENTO_B = '11222333000181'
/** Válido no dígito verificador, mas sem cadastro nenhum. */
const DOCUMENTO_DE_NINGUEM = '39053344705'
/** Usado no cliente que fica sem e-mail de propósito. */
const DOCUMENTO_SEM_EMAIL = '11144477735'
const DOCUMENTOS = [DOCUMENTO_A, DOCUMENTO_B, DOCUMENTO_SEM_EMAIL]
const EMAIL_DO_OPERADOR = 'operador.teste.isolamento@exemplo.invalido'

type Montado = {
  clienteId: string
  casoId: string
  andamentoId: string
  documentoId: string
  usuarioId: string
}

let a: Montado
let b: Montado
let operadorId: string
let sessaoDaEquipe: Awaited<ReturnType<typeof montarSessaoDaEquipe>>

function montarSessaoDaEquipe(usuarioId: string) {
  return {
    usuarioId,
    perfil: PerfilUsuario.OPERADOR,
    clienteId: null,
    contratoAssinado: false,
  }
}

function sessaoDoCliente(montado: Montado) {
  return {
    usuarioId: montado.usuarioId,
    perfil: PerfilUsuario.CLIENTE,
    clienteId: montado.clienteId,
    contratoAssinado: true,
  }
}

async function limpar(): Promise<void> {
  await prisma.cliente.deleteMany({ where: { documento: { in: DOCUMENTOS } } })
  await prisma.usuario.deleteMany({ where: { email: EMAIL_DO_OPERADOR } })
}

async function montarCliente(
  documento: string,
  nome: string,
  tipoPessoa: TipoPessoa,
  assunto: string,
): Promise<Montado> {
  const cliente = await prisma.cliente.create({
    data: {
      documento,
      nome,
      nomeBusca: nome.toLowerCase(),
      tipoPessoa,
      email: `${documento}@exemplo.invalido`,
      contratoAssinadoEm: new Date('2026-02-12T12:00:00.000Z'),
    },
    select: { id: true },
  })

  const caso = await prisma.caso.create({
    data: { clienteId: cliente.id, assunto },
    select: { id: true },
  })

  const status = await prisma.statusAndamento.findFirst({
    where: { ativo: true },
    orderBy: { ordem: 'asc' },
    select: { id: true },
  })

  const andamento = await prisma.andamento.create({
    data: {
      casoId: caso.id,
      data: new Date('2026-03-01T12:00:00.000Z'),
      statusId: status?.id ?? null,
      descricao: `Andamento reservado ao caso de ${nome}.`,
      autorId: operadorId,
    },
    select: { id: true },
  })

  const documentoArquivo = await prisma.documento.create({
    data: {
      clienteId: cliente.id,
      casoId: caso.id,
      tipo: TipoDocumento.CONTRATO,
      nome: `contrato-${nome}.pdf`,
      chaveArquivo: `documentos/teste-isolamento-${documento}`,
      tipoConteudo: 'application/pdf',
      tamanhoBytes: 1024,
    },
    select: { id: true },
  })

  const usuarioId = await garantirUsuarioDoCliente(cliente.id, nome)

  return {
    clienteId: cliente.id,
    casoId: caso.id,
    andamentoId: andamento.id,
    documentoId: documentoArquivo.id,
    usuarioId,
  }
}

beforeAll(async () => {
  await limpar()

  const operador = await prisma.usuario.create({
    data: {
      nome: 'Operador do teste de isolamento',
      email: EMAIL_DO_OPERADOR,
      senhaHash: null,
      perfil: PerfilUsuario.OPERADOR,
    },
    select: { id: true },
  })
  operadorId = operador.id
  sessaoDaEquipe = montarSessaoDaEquipe(operadorId)

  a = await montarCliente(
    DOCUMENTO_A,
    'Cliente A do teste',
    TipoPessoa.FISICA,
    'Ação de cobrança do cliente A',
  )
  b = await montarCliente(
    DOCUMENTO_B,
    'Cliente B do teste',
    TipoPessoa.JURIDICA,
    'Rescisão contratual do cliente B',
  )
})

afterAll(async () => {
  await limpar()
  await prisma.$disconnect()
})

// ---------------------------------------------------------------------------

describe('dois clientes entram e nenhum enxerga nada do outro', () => {
  it('cada um vê só o próprio caso', async () => {
    const casosDeA = await meusCasos(sessaoDoCliente(a))
    const casosDeB = await meusCasos(sessaoDoCliente(b))

    expect(casosDeA.map((caso) => caso.id)).toEqual([a.casoId])
    expect(casosDeB.map((caso) => caso.id)).toEqual([b.casoId])
  })

  it('cada um vê só os próprios documentos', async () => {
    const documentosDeA = await meusDocumentos(sessaoDoCliente(a))
    const documentosDeB = await meusDocumentos(sessaoDoCliente(b))

    expect(documentosDeA.map((documento) => documento.id)).toEqual([a.documentoId])
    expect(documentosDeB.map((documento) => documento.id)).toEqual([b.documentoId])
  })

  it('o andamento do outro não aparece na lista de ninguém', async () => {
    const casosDeA = await meusCasos(sessaoDoCliente(a))
    const descricoes = casosDeA.flatMap((caso) =>
      caso.andamentos.map((andamento) => andamento.descricao),
    )

    expect(descricoes.join(' ')).toContain('Cliente A')
    expect(descricoes.join(' ')).not.toContain('Cliente B')
  })
})

describe('colar o id alheio na URL não abre nada', () => {
  it('caso do outro: não encontrado', async () => {
    expect(await obterCaso(sessaoDoCliente(a), b.casoId)).toBeNull()
    expect(await obterCaso(sessaoDoCliente(b), a.casoId)).toBeNull()
  })

  it('ficha do outro: não encontrada', async () => {
    expect(await obterCliente(sessaoDoCliente(a), b.clienteId)).toBeNull()
  })

  it('andamentos do caso do outro: lista vazia', async () => {
    expect(await listarAndamentosDoCaso(sessaoDoCliente(a), b.casoId)).toEqual([])
  })

  it('documento do outro: nenhuma URL assinada é emitida', async () => {
    const url = await urlDeLeituraAutorizada(
      sessaoDoCliente(a),
      b.documentoId,
      true,
      null,
    )
    expect(url).toBeNull()
  })

  it('o próprio documento, esse sim, sai por URL assinada', async () => {
    const url = await urlDeLeituraAutorizada(
      sessaoDoCliente(a),
      a.documentoId,
      false,
      null,
    )
    expect(url).not.toBeNull()
    expect(url ?? '').toContain('X-Amz-Signature')
  })
})

describe('o contrato assinado é o gatilho (Anexo I, 1.d)', () => {
  it('sem contrato assinado, a sessão não consulta nada', async () => {
    const semContrato = { ...sessaoDoCliente(a), contratoAssinado: false }
    await expect(meusCasos(semContrato)).rejects.toBeInstanceOf(SemAutorizacao)
  })

  it('sessão de cliente sem vínculo também não', async () => {
    const semCliente = { ...sessaoDoCliente(a), clienteId: null }
    await expect(meusCasos(semCliente)).rejects.toBeInstanceOf(SemAutorizacao)
  })
})

// ---------------------------------------------------------------------------
// A entrada por CPF/CNPJ + código
// ---------------------------------------------------------------------------

function codigoDoUltimoEmail(): string {
  const ultimo = enviados[enviados.length - 1]
  const achado = /\b(\d{6})\b/.exec(ultimo?.texto ?? '')
  return achado?.[1] ?? ''
}

/**
 * Pede um código e devolve o que chegou no e-mail.
 *
 * A janela de pedidos é real: um por minuto, três a cada quinze. Testes rodam
 * em milissegundos, então sem limpar a janela o segundo pedido de cada cliente
 * seria recusado — e a recusa é silenciosa de propósito. O `toHaveLength(1)`
 * está aqui para que isso nunca passe despercebido: sem ele, um teste que
 * espera falha passaria por falta de código, e não por acerto.
 */
async function pedirCodigoComJanelaLimpa(
  documento: string,
  clienteId: string,
  enderecoIp: string,
): Promise<string> {
  await prisma.codigoDeAcesso.deleteMany({ where: { clienteId } })
  enviados.length = 0

  await pedirCodigo(documento, { enderecoIp })

  expect(enviados).toHaveLength(1)
  const codigo = codigoDoUltimoEmail()
  expect(codigo).toHaveLength(6)
  return codigo
}

describe('entrada por código enviado ao e-mail', () => {
  it('o código do cliente A entra como cliente A, e uma vez só', async () => {
    const codigo = await pedirCodigoComJanelaLimpa(
      DOCUMENTO_A,
      a.clienteId,
      '198.51.100.10',
    )

    expect(enviados[0]?.para).toBe(`${DOCUMENTO_A}@exemplo.invalido`)

    const primeira = await conferirCodigo(DOCUMENTO_A, codigo)
    expect(primeira.situacao).toBe('confere')
    if (primeira.situacao === 'confere') {
      expect(primeira.clienteId).toBe(a.clienteId)
    }

    // Serve uma vez: repetir o mesmo código não entra de novo.
    const segunda = await conferirCodigo(DOCUMENTO_A, codigo)
    expect(segunda.situacao).toBe('nao_confere')
  })

  it('o código de um cliente não serve para o outro', async () => {
    const codigoDeB = await pedirCodigoComJanelaLimpa(
      DOCUMENTO_B,
      b.clienteId,
      '198.51.100.11',
    )

    const tentativa = await conferirCodigo(DOCUMENTO_A, codigoDeB)
    expect(tentativa.situacao).toBe('nao_confere')

    // E continua valendo para o dono.
    const legitima = await conferirCodigo(DOCUMENTO_B, codigoDeB)
    expect(legitima.situacao).toBe('confere')
  })

  it('cliente sem contrato assinado não recebe código nenhum', async () => {
    await prisma.cliente.update({
      where: { id: a.clienteId },
      data: { contratoAssinadoEm: null },
    })

    enviados.length = 0
    await pedirCodigo(DOCUMENTO_A, { enderecoIp: '198.51.100.12' })
    expect(enviados).toHaveLength(0)

    await prisma.cliente.update({
      where: { id: a.clienteId },
      data: { contratoAssinadoEm: new Date('2026-02-12T12:00:00.000Z') },
    })
  })

  it('documento que não é de ninguém não gera envio e não distingue a resposta', async () => {
    enviados.length = 0
    const resultado = await pedirCodigo(DOCUMENTO_DE_NINGUEM, {
      enderecoIp: '198.51.100.13',
    })

    expect(resultado.situacao).toBe('pedido_registrado')
    expect(enviados).toHaveLength(0)
  })

  it('pedir de novo antes de um minuto não manda outro e-mail', async () => {
    await pedirCodigoComJanelaLimpa(DOCUMENTO_B, b.clienteId, '198.51.100.16')

    enviados.length = 0
    await pedirCodigo(DOCUMENTO_B, { enderecoIp: '198.51.100.16' })
    expect(enviados).toHaveLength(0)
  })

  it('o código morre na quinta tentativa errada', async () => {
    const certo = await pedirCodigoComJanelaLimpa(
      DOCUMENTO_B,
      b.clienteId,
      '198.51.100.14',
    )
    const errado = certo === '000000' ? '111111' : '000000'

    for (let tentativa = 0; tentativa < 5; tentativa += 1) {
      expect((await conferirCodigo(DOCUMENTO_B, errado)).situacao).toBe(
        'nao_confere',
      )
    }

    // Mesmo o código certo já não vale: ele foi invalidado.
    expect((await conferirCodigo(DOCUMENTO_B, certo)).situacao).toBe('nao_confere')
  })
})

// ---------------------------------------------------------------------------
// Registrar e revogar
// ---------------------------------------------------------------------------

describe('o operador registra e revoga a assinatura', () => {
  it('registrar libera; revogar corta na hora', async () => {
    await prisma.cliente.update({
      where: { id: a.clienteId },
      data: { contratoAssinadoEm: null },
    })

    const registro = await registrarAssinatura(
      sessaoDaEquipe,
      a.clienteId,
      { assinadoEm: new Date('2026-02-12T12:00:00.000Z') },
      EMAIL_DO_OPERADOR,
    )
    expect(registro.situacao).toBe('registrada')

    const liberado = await prisma.cliente.findUnique({
      where: { id: a.clienteId },
      select: { contratoAssinadoEm: true },
    })
    expect(liberado?.contratoAssinadoEm).not.toBeNull()

    const revogacao = await revogarAcesso(sessaoDaEquipe, a.clienteId, EMAIL_DO_OPERADOR)
    expect(revogacao.situacao).toBe('revogado')

    const depois = await prisma.cliente.findUnique({
      where: { id: a.clienteId },
      select: { contratoAssinadoEm: true },
    })
    expect(depois?.contratoAssinadoEm).toBeNull()

    // O usuário do cliente deixa de estar ativo, então a sessão dele morre na
    // próxima requisição (exigirSessaoDeCliente relê isto do banco).
    const usuario = await prisma.usuario.findUnique({
      where: { id: a.usuarioId },
      select: { situacao: true },
    })
    expect(usuario?.situacao).toBe(SituacaoUsuario.INATIVO)

    // E não há mais como pedir código.
    enviados.length = 0
    await pedirCodigo(DOCUMENTO_A, { enderecoIp: '198.51.100.15' })
    expect(enviados).toHaveLength(0)
  })

  it('cadastro sem e-mail não vira acesso liberado', async () => {
    const semEmail = await prisma.cliente.create({
      data: {
        documento: DOCUMENTO_SEM_EMAIL,
        nome: 'Cliente sem e-mail',
        nomeBusca: 'cliente sem e-mail',
        tipoPessoa: TipoPessoa.FISICA,
      },
      select: { id: true },
    })

    const resultado = await registrarAssinatura(
      sessaoDaEquipe,
      semEmail.id,
      { assinadoEm: new Date('2026-02-12T12:00:00.000Z') },
      EMAIL_DO_OPERADOR,
    )

    expect(resultado.situacao).toBe('sem_email')

    const conferido = await prisma.cliente.findUnique({
      where: { id: semEmail.id },
      select: { contratoAssinadoEm: true },
    })
    expect(conferido?.contratoAssinadoEm).toBeNull()

    await prisma.cliente.delete({ where: { id: semEmail.id } })
  })
})
