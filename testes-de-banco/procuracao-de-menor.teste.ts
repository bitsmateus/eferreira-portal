/**
 * Procuração de menor representado (modelo do escritório, 24/09/2026) contra
 * o banco de verdade: pessoa física COM responsável vinculado gera a variante
 * de menor; sem responsável, a de sempre; e o vínculo recusa auto-referência.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PerfilUsuario, TipoDocumento, TipoPessoa } from '@prisma/client'

import { vincularRepresentante } from '@/lib/clientes'
import { montarPrevia } from '@/lib/geracao'
import { prisma } from '@/lib/prisma'

const DOC_MENOR = '54384339844'
const DOC_MAE = '36568755885'
const EMAIL_DO_OPERADOR = 'operador.teste.procuracao.menor@exemplo.invalido'

let operadorId: string
let menorId: string

function sessaoDaEquipe() {
  return {
    usuarioId: operadorId,
    perfil: PerfilUsuario.OPERADOR,
    clienteId: null,
    contratoAssinado: false,
  }
}

async function limpar(): Promise<void> {
  await prisma.cliente.deleteMany({ where: { documento: { in: [DOC_MENOR, DOC_MAE] } } })
  await prisma.usuario.deleteMany({ where: { email: EMAIL_DO_OPERADOR } })
}

const ENDERECO = {
  endereco: 'Avenida Major Mello, nº 280, Vila Nova Aparecida',
  cidade: 'Mogi das Cruzes',
  uf: 'SP',
  cep: '05425070',
}

beforeAll(async () => {
  await limpar()

  operadorId = (
    await prisma.usuario.create({
      data: {
        nome: 'Operador do teste da procuração de menor',
        email: EMAIL_DO_OPERADOR,
        senhaHash: 'nao-usado',
        perfil: PerfilUsuario.OPERADOR,
      },
      select: { id: true },
    })
  ).id

  menorId = (
    await prisma.cliente.create({
      data: {
        documento: DOC_MENOR,
        nome: 'Miguel Barreto da Silva',
        nomeBusca: 'miguel barreto da silva',
        tipoPessoa: TipoPessoa.FISICA,
        nacionalidade: 'brasileiro',
        estadoCivil: 'Solteiro',
        profissao: 'estudante',
        nomeMae: 'Cintia Cristina da Silva Soares',
        rg: '69.945.690-3',
        email: 'menor.teste@exemplo.invalido',
        ...ENDERECO,
      },
      select: { id: true },
    })
  ).id

  await prisma.cliente.create({
    data: {
      documento: DOC_MAE,
      nome: 'Cíntia Cristina da Silva Soares',
      nomeBusca: 'cintia cristina da silva soares',
      tipoPessoa: TipoPessoa.FISICA,
      nacionalidade: 'brasileira',
      estadoCivil: 'Casada',
      profissao: 'auxiliar de embalagem',
      nomeMae: 'Maria Inez da Silva',
      rg: '45.311.733-8 SSP/SP',
      email: 'mae.teste@exemplo.invalido',
      ...ENDERECO,
    },
  })
})

afterAll(async () => {
  await limpar()
  await prisma.$disconnect()
})

async function procuracao() {
  return montarPrevia(sessaoDaEquipe(), menorId, TipoDocumento.PROCURACAO, null)
}

describe('procuração de pessoa física', () => {
  it('sem responsável vinculado, sai a de pessoa física de sempre', async () => {
    const resultado = await procuracao()
    expect(resultado.situacao).toBe('pronto')
    if (resultado.situacao !== 'pronto') return
    expect(resultado.html).toContain('nome da mãe: Cintia')
    expect(resultado.html).not.toContain('representado(a) por')
  })

  it('ninguém é responsável por si mesmo', async () => {
    const resultado = await vincularRepresentante(
      sessaoDaEquipe(),
      menorId,
      DOC_MENOR,
      'genitor',
      null,
    )
    expect(resultado.situacao).toBe('mesmo_cliente')
  })

  it('com responsável vinculado, sai a de menor, com a qualificação dele', async () => {
    const vinculo = await vincularRepresentante(
      sessaoDaEquipe(),
      menorId,
      DOC_MAE,
      'genitora',
      null,
    )
    expect(vinculo.situacao).toBe('vinculado')

    const resultado = await procuracao()
    expect(resultado.situacao).toBe('pronto')
    if (resultado.situacao !== 'pronto') return

    const texto = resultado.html.replace(/\s+/g, ' ')
    expect(texto).toContain('representado(a) por seu(sua) genitora:')
    expect(texto).toContain('brasileira, casada, auxiliar de embalagem')
    expect(texto).toContain('filho(a) de Maria Inez da Silva')
  })

  it('a declaração do mesmo cliente segue em nome dele, sem o responsável', async () => {
    const resultado = await montarPrevia(
      sessaoDaEquipe(),
      menorId,
      TipoDocumento.DECLARACAO,
      null,
    )
    expect(resultado.situacao).toBe('pronto')
    if (resultado.situacao !== 'pronto') return
    expect(resultado.html).not.toContain('representado(a) por')
  })

  it('responsável com cadastro incompleto: diz o que falta e leva ao cadastro DELE', async () => {
    await prisma.cliente.update({ where: { documento: DOC_MAE }, data: { profissao: null } })

    const resultado = await procuracao()
    expect(resultado.situacao).toBe('faltam_dados')
    if (resultado.situacao !== 'faltam_dados') return
    expect(resultado.faltando).toEqual(['profissão do representante legal'])
    const mae = await prisma.cliente.findUniqueOrThrow({ where: { documento: DOC_MAE } })
    expect(resultado.ondePreencher).toBe(`/painel/clientes/${mae.id}/editar`)
  })
})
