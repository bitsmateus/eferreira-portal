/**
 * Cadastro de advogados contra o banco de verdade (25/09/2026). Os dois
 * advogados de sempre chegam pela migração; estes testes só mexem nos que
 * criam, e devolvem o padrão para onde estava.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PerfilUsuario, TipoDocumento, TipoPessoa } from '@prisma/client'

import {
  alterarSituacaoDoAdvogado,
  atualizarAdvogado,
  criarAdvogado,
  listarAdvogadosAtivos,
  obterAdvogadoParaDocumento,
  tornarAdvogadoPadrao,
  validarAdvogado,
  type DadosDeAdvogado,
} from '@/lib/advogados'
import { montarPrevia } from '@/lib/geracao'
import { prisma } from '@/lib/prisma'

const EMAIL_DO_OPERADOR = 'operador.teste.advogados@exemplo.invalido'
const DOC_DO_CLIENTE = '52998224725'
const OAB_DE_TESTE = '999.001'

let operadorId: string
let clienteId: string
let padraoOriginalId: string | null

const sessaoDaEquipe = () => ({
  usuarioId: operadorId,
  perfil: PerfilUsuario.OPERADOR,
  clienteId: null,
  contratoAssinado: false,
})

function dados(extra: Partial<DadosDeAdvogado> = {}): DadosDeAdvogado {
  const conferido = validarAdvogado({
    nome: 'Dr. Advogado do Teste',
    genero: 'M',
    nacionalidade: 'brasileiro',
    estadoCivil: 'Casado',
    oab: OAB_DE_TESTE,
    oabUf: 'SP',
  })
  if (!conferido.ok) throw new Error('dados de teste inválidos')
  return { ...conferido.dados, ...extra }
}

async function limpar(): Promise<void> {
  await prisma.advogado.deleteMany({ where: { oab: { startsWith: '999.' } } })
  await prisma.cliente.deleteMany({ where: { documento: DOC_DO_CLIENTE } })
  await prisma.usuario.deleteMany({ where: { email: EMAIL_DO_OPERADOR } })
}

beforeAll(async () => {
  await limpar()

  padraoOriginalId = (await prisma.advogado.findFirst({ where: { padrao: true } }))?.id ?? null

  operadorId = (
    await prisma.usuario.create({
      data: {
        nome: 'Operador do teste de advogados',
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
        documento: DOC_DO_CLIENTE,
        nome: 'Cliente do teste de advogados',
        nomeBusca: 'cliente do teste de advogados',
        tipoPessoa: TipoPessoa.FISICA,
        nacionalidade: 'brasileiro',
        estadoCivil: 'casado',
        profissao: 'engenheiro',
        rg: '12.345.678-9',
        email: 'cliente.advogados@exemplo.invalido',
        telefone: '11987654321',
        endereco: 'Rua de Teste, 100',
        cidade: 'São Paulo',
        uf: 'SP',
        cep: '01310100',
      },
      select: { id: true },
    })
  ).id
})

afterAll(async () => {
  await limpar()
  if (padraoOriginalId !== null) {
    await prisma.advogado.updateMany({ data: { padrao: false } })
    await prisma.advogado.update({ where: { id: padraoOriginalId }, data: { padrao: true } })
  }
  await prisma.$disconnect()
})

describe('os advogados que já estavam no código', () => {
  it('chegam pela migração, e o Dr. Sergio é o padrão', async () => {
    const ativos = await listarAdvogadosAtivos(sessaoDaEquipe())
    const nomes = ativos.map((a) => a.nome)

    expect(nomes).toContain('Dr. Sergio Evangelista Ferreira')
    expect(nomes).toContain('Dra. Cristina Moura Santos Lopes')
    expect(ativos.find((a) => a.id === 'sergio')?.padrao).toBe(true)
  })

  it('sem escolha, vale o padrão; com id, vale aquele', async () => {
    expect((await obterAdvogadoParaDocumento(null))?.nome).toBe('Dr. Sergio Evangelista Ferreira')

    const cristina = await obterAdvogadoParaDocumento('cristina')
    expect(cristina?.qualificacao).toBe('brasileira, divorciada, advogada')
    expect(cristina?.feminino).toBe(true)
    expect(cristina?.oabUf).toBe('SP')
  })
})

describe('incluir um advogado', () => {
  it('cria, aparece no seletor e sai na procuração com os dados dele', async () => {
    const resultado = await criarAdvogado(sessaoDaEquipe(), dados(), null)
    expect(resultado.situacao).toBe('ok')
    if (resultado.situacao !== 'ok') return

    const ativos = await listarAdvogadosAtivos(sessaoDaEquipe())
    expect(ativos.map((a) => a.id)).toContain(resultado.id)

    const previa = await montarPrevia(
      sessaoDaEquipe(),
      clienteId,
      TipoDocumento.PROCURACAO,
      null,
      resultado.id,
    )
    expect(previa.situacao).toBe('pronto')
    if (previa.situacao !== 'pronto') return

    const texto = previa.html.replace(/\s+/g, ' ')
    expect(texto).toContain('Dr. Advogado do Teste')
    expect(texto).toContain('brasileiro, casado, advogado, inscrito na OAB/SP sob o nº 999.001')
    // O contato citado continua sendo o do escritório.
    expect(texto).toContain('e-mail: contato@eferreira.adv.br')
  })

  it('a mesma OAB duas vezes é recusada; editar o próprio cadastro passa', async () => {
    expect((await criarAdvogado(sessaoDaEquipe(), dados({ nome: 'Dr. Outro Nome' }), null)).situacao).toBe(
      'repetido',
    )

    const existente = await prisma.advogado.findFirstOrThrow({ where: { oab: OAB_DE_TESTE } })
    const editado = await atualizarAdvogado(
      sessaoDaEquipe(),
      existente.id,
      dados({ nome: 'Dr. Advogado Renomeado' }),
      null,
    )
    expect(editado.situacao).toBe('ok')
    expect((await prisma.advogado.findUniqueOrThrow({ where: { id: existente.id } })).nome).toBe(
      'Dr. Advogado Renomeado',
    )
  })
})

describe('desativar e padrão', () => {
  it('advogado desativado some do seletor e não vale para gerar', async () => {
    const existente = await prisma.advogado.findFirstOrThrow({ where: { oab: OAB_DE_TESTE } })

    expect((await alterarSituacaoDoAdvogado(sessaoDaEquipe(), existente.id, false, null)).situacao).toBe('ok')

    expect((await listarAdvogadosAtivos(sessaoDaEquipe())).map((a) => a.id)).not.toContain(existente.id)
    expect(await obterAdvogadoParaDocumento(existente.id)).toBeUndefined()

    const previa = await montarPrevia(
      sessaoDaEquipe(),
      clienteId,
      TipoDocumento.PROCURACAO,
      null,
      existente.id,
    )
    expect(previa.situacao).toBe('nao_encontrado')

    expect((await alterarSituacaoDoAdvogado(sessaoDaEquipe(), existente.id, true, null)).situacao).toBe('ok')
  })

  it('tornar padrão troca o padrão; só existe um', async () => {
    const existente = await prisma.advogado.findFirstOrThrow({ where: { oab: OAB_DE_TESTE } })

    expect((await tornarAdvogadoPadrao(sessaoDaEquipe(), existente.id, null)).situacao).toBe('ok')

    expect(await prisma.advogado.count({ where: { padrao: true } })).toBe(1)
    expect((await obterAdvogadoParaDocumento(null))?.id).toBe(existente.id)
  })

  it('desativar o padrão passa o padrão para outro ativo', async () => {
    const existente = await prisma.advogado.findFirstOrThrow({ where: { oab: OAB_DE_TESTE } })

    expect((await alterarSituacaoDoAdvogado(sessaoDaEquipe(), existente.id, false, null)).situacao).toBe('ok')

    expect(await prisma.advogado.count({ where: { padrao: true, ativo: true } })).toBe(1)
    expect((await obterAdvogadoParaDocumento(null))?.id).not.toBe(existente.id)
  })
})
