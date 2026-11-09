/**
 * Esteira de acompanhamento — publicações do DJEN e fila de conferência
 * (09/11/2026), contra o Postgres de verdade. O DJEN é dublado: nenhum teste
 * consulta o diário de verdade.
 *
 * O que importa conferir aqui: importar duas vezes a mesma janela não
 * duplica; a publicação liga sozinha ao caso pelo número do processo;
 * nenhuma sessão de perfil CLIENTE alcança a fila; e conferir cria a tarefa e
 * o andamento uma vez só, mesmo com clique duplo.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { PerfilUsuario, SituacaoDaPublicacao, TipoPessoa } from '@prisma/client'

import { SemAutorizacao } from '@/lib/autorizacao'
import {
  conferirPublicacao,
  descartarPublicacao,
  executarConsulta,
  ligarPublicacaoAoCaso,
  listarPublicacoes,
  reabrirPublicacao,
} from '@/lib/publicacoes'
import { prisma } from '@/lib/prisma'

const DOCUMENTO_DO_CLIENTE = '38491027696'
const EMAIL_DO_OPERADOR = 'operador.teste.publicacoes@exemplo.invalido'
const PROCESSO_COM_CASO = '99999990020268260000'
const PROCESSO_SEM_CASO = '99999991120268260000'
const ID_COM_CASO = 'teste-djen-1'
const ID_SEM_CASO = 'teste-djen-2'

let operadorId: string
let clienteId: string
let casoId: string
let statusId: string

function sessaoDaEquipe() {
  return { usuarioId: operadorId, perfil: PerfilUsuario.OPERADOR, clienteId: null, contratoAssinado: false }
}

function sessaoDoCliente() {
  return { usuarioId: 'qualquer', perfil: PerfilUsuario.CLIENTE, clienteId, contratoAssinado: true }
}

function item(id: string, processo: string) {
  return {
    id,
    data_disponibilizacao: '2026-11-05',
    siglaTribunal: 'TJSP',
    tipoComunicacao: 'Intimação',
    nomeOrgao: 'Vara de teste',
    texto: 'Texto inventado para o teste. Intime-se para réplica em 15 dias.',
    numero_processo: processo,
    link: null,
    tipoDocumento: 'Despacho',
    nomeClasse: 'Procedimento Comum Cível',
    ativo: true,
    hash: null,
  }
}

function dublarDjen() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      new Response(
        JSON.stringify({ count: 2, items: [item(ID_COM_CASO, PROCESSO_COM_CASO), item(ID_SEM_CASO, PROCESSO_SEM_CASO)] }),
        { status: 200 },
      ),
    ),
  )
}

async function limpar(): Promise<void> {
  await prisma.publicacao.deleteMany({ where: { idDjen: { in: [ID_COM_CASO, ID_SEM_CASO] } } })
  await prisma.cliente.deleteMany({ where: { documento: DOCUMENTO_DO_CLIENTE } })
  await prisma.usuario.deleteMany({ where: { email: EMAIL_DO_OPERADOR } })
}

async function publicacao(idDjen: string) {
  return prisma.publicacao.findUniqueOrThrow({ where: { idDjen } })
}

beforeAll(async () => {
  await limpar()
  vi.stubEnv('ANTHROPIC_API_KEY', '')
  vi.stubEnv('OPENAI_API_KEY', '')

  // A consulta usa as OABs dos advogados ativos; a semente traz pelo menos um.
  if ((await prisma.advogado.count({ where: { ativo: true } })) === 0) {
    throw new Error('Rode a semente: a consulta precisa de um advogado ativo.')
  }

  operadorId = (
    await prisma.usuario.create({
      data: {
        nome: 'Operador do teste de publicações',
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
        nome: 'Cliente do teste de publicações',
        nomeBusca: 'cliente do teste de publicacoes',
        tipoPessoa: TipoPessoa.FISICA,
        cidade: 'São Paulo',
        uf: 'SP',
      },
      select: { id: true },
    })
  ).id
  casoId = (
    await prisma.caso.create({
      data: { clienteId, assunto: 'Caso do teste de publicações', numeroProcesso: PROCESSO_COM_CASO },
      select: { id: true },
    })
  ).id
  const status = await prisma.statusAndamento.findFirstOrThrow({ where: { ativo: true }, select: { id: true } })
  statusId = status.id
})

afterAll(async () => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  await limpar()
  await prisma.$disconnect()
})

describe('consulta ao DJEN', () => {
  it('grava as novas e liga ao caso pelo número do processo', async () => {
    dublarDjen()
    const resumo = await executarConsulta({ hoje: '2026-11-06' })
    expect(resumo.erros).toEqual([])

    expect((await publicacao(ID_COM_CASO)).casoId).toBe(casoId)
    expect((await publicacao(ID_SEM_CASO)).casoId).toBeNull()
    expect((await publicacao(ID_COM_CASO)).situacao).toBe(SituacaoDaPublicacao.PENDENTE)
  })

  it('a mesma janela de novo não duplica nada', async () => {
    dublarDjen()
    const resumo = await executarConsulta({ hoje: '2026-11-06' })
    expect(resumo.novas).toBe(0)
    expect(await prisma.publicacao.count({ where: { idDjen: { in: [ID_COM_CASO, ID_SEM_CASO] } } })).toBe(2)
  })

  it('a falha do DJEN fica registrada e não lança', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })))
    const resumo = await executarConsulta({ hoje: '2026-11-06' })
    expect(resumo.erros.length).toBeGreaterThan(0)
    const rodada = await prisma.consultaDePublicacoes.findUniqueOrThrow({ where: { id: resumo.consultaId } })
    expect(rodada.erro).toContain('HTTP 503')
  })
})

describe('fila de conferência', () => {
  it('nenhuma sessão de cliente alcança a fila', async () => {
    await expect(listarPublicacoes(sessaoDoCliente(), 'pendentes')).rejects.toThrow(SemAutorizacao)
    const { id } = await publicacao(ID_COM_CASO)
    await expect(
      conferirPublicacao(sessaoDoCliente(), id, { evento: null, andamento: null }, null),
    ).rejects.toThrow(SemAutorizacao)
  })

  it('separa "para conferir" de "sem caso"', async () => {
    const pendentes = await listarPublicacoes(sessaoDaEquipe(), 'pendentes')
    const semCaso = await listarPublicacoes(sessaoDaEquipe(), 'sem_caso')
    expect(pendentes.some((p) => p.idDjen === ID_COM_CASO)).toBe(true)
    expect(pendentes.some((p) => p.idDjen === ID_SEM_CASO)).toBe(false)
    expect(semCaso.some((p) => p.idDjen === ID_SEM_CASO)).toBe(true)
  })

  it('não cria tarefa em publicação sem caso', async () => {
    const { id } = await publicacao(ID_SEM_CASO)
    const resultado = await conferirPublicacao(
      sessaoDaEquipe(),
      id,
      {
        evento: { responsavelId: operadorId, assunto: 'Réplica', prazoDeEntrega: new Date('2026-11-30T12:00:00Z'), horario: null },
        andamento: null,
      },
      null,
    )
    expect(resultado.situacao).toBe('sem_caso')
  })

  it('conferir cria a tarefa e o andamento uma vez só', async () => {
    const { id } = await publicacao(ID_COM_CASO)
    const pedido = {
      evento: { responsavelId: operadorId, assunto: 'Conferir e protocolar: réplica', prazoDeEntrega: new Date('2026-11-30T12:00:00Z'), horario: null },
      andamento: {
        data: new Date('2026-11-05T12:00:00Z'),
        statusId,
        statusPersonalizado: '',
        descricao: 'O juiz pediu nossa resposta à defesa da outra parte.',
        encerraOCaso: false,
      },
    }

    const [primeiro, segundo] = await Promise.all([
      conferirPublicacao(sessaoDaEquipe(), id, pedido, EMAIL_DO_OPERADOR),
      conferirPublicacao(sessaoDaEquipe(), id, pedido, EMAIL_DO_OPERADOR),
    ])
    expect([primeiro.situacao, segundo.situacao].sort()).toEqual(['ja_conferida', 'ok'])

    const conferida = await publicacao(ID_COM_CASO)
    expect(conferida.situacao).toBe(SituacaoDaPublicacao.CONFERIDA)
    expect(conferida.conferidaPorId).toBe(operadorId)
    expect(await prisma.evento.count({ where: { casoId } })).toBe(1)
    expect(await prisma.andamento.count({ where: { casoId } })).toBe(1)
    expect(conferida.eventoId).not.toBeNull()
    expect(conferida.andamentoId).not.toBeNull()

    const auditoria = await prisma.auditoria.findMany({ where: { entidade: 'publicacao', entidadeId: id } })
    expect(auditoria.some((a) => (a.detalhes as { motivo?: string } | null)?.motivo === 'conferida')).toBe(true)
  })

  it('responsável inativo devolve a publicação para a fila', async () => {
    const { id } = await publicacao(ID_SEM_CASO)
    expect((await ligarPublicacaoAoCaso(sessaoDaEquipe(), id, casoId, null)).situacao).toBe('ok')

    const resultado = await conferirPublicacao(
      sessaoDaEquipe(),
      id,
      {
        evento: { responsavelId: 'nao-existe', assunto: 'Qualquer', prazoDeEntrega: new Date('2026-11-30T12:00:00Z'), horario: null },
        andamento: null,
      },
      null,
    )
    expect(resultado.situacao).toBe('responsavel_invalido')
    expect((await publicacao(ID_SEM_CASO)).situacao).toBe(SituacaoDaPublicacao.PENDENTE)
  })

  it('descartar e devolver à fila', async () => {
    const { id } = await publicacao(ID_SEM_CASO)
    expect((await descartarPublicacao(sessaoDaEquipe(), id, null)).situacao).toBe('ok')
    expect((await publicacao(ID_SEM_CASO)).situacao).toBe(SituacaoDaPublicacao.DESCARTADA)
    expect((await descartarPublicacao(sessaoDaEquipe(), id, null)).situacao).toBe('ja_conferida')
    expect((await reabrirPublicacao(sessaoDaEquipe(), id, null)).situacao).toBe('ok')
    expect((await publicacao(ID_SEM_CASO)).situacao).toBe(SituacaoDaPublicacao.PENDENTE)
  })
})
