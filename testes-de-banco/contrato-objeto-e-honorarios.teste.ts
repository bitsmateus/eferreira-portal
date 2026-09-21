/**
 * O contrato por partes (21/09/2026): tipo de objeto e modalidades de
 * honorários vêm do CASO, e é `montarPrevia` — que consulta o caso de verdade
 * — quem decide o que entra e o que falta. Contra o banco porque é ele quem
 * guarda os campos novos e porque a decisão de "onde preencher" depende da
 * linha do caso, não só do texto.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  NaturezaDoHonorarioPersonalizado,
  PerfilUsuario,
  TipoDeObjeto,
  TipoDocumento,
  TipoPessoa,
  type Prisma,
} from '@prisma/client'

import { montarPrevia } from '@/lib/geracao'
import { prisma } from '@/lib/prisma'

const DOCUMENTO_DO_CLIENTE = '05058050060'
const EMAIL_DO_OPERADOR = 'operador.teste.contrato.por.partes@exemplo.invalido'

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

const UMA_PARCELA = {
  create: [
    {
      numero: 1,
      valorEmCentavos: 175000,
      vencimento: new Date('2026-10-09T12:00:00Z'),
    },
  ],
}

async function criarCaso(dados: Partial<Prisma.CasoUncheckedCreateInput>) {
  return prisma.caso.create({
    data: {
      clienteId,
      assunto: 'Caso do teste do contrato por partes',
      tipoDeObjeto: TipoDeObjeto.CIVEL,
      descricaoDoObjeto: 'Ação de cobrança contra Construtora Exemplo Ltda.',
      ...dados,
    },
    select: { id: true },
  })
}

async function previa(casoId: string) {
  return montarPrevia(sessaoDaEquipe(), clienteId, TipoDocumento.CONTRATO, casoId)
}

async function limpar(): Promise<void> {
  await prisma.cliente.deleteMany({ where: { documento: DOCUMENTO_DO_CLIENTE } })
  await prisma.usuario.deleteMany({ where: { email: EMAIL_DO_OPERADOR } })
}

beforeAll(async () => {
  await limpar()

  const operador = await prisma.usuario.create({
    data: {
      nome: 'Operador do teste do contrato por partes',
      email: EMAIL_DO_OPERADOR,
      senhaHash: 'nao-usado',
      perfil: PerfilUsuario.OPERADOR,
    },
    select: { id: true },
  })
  operadorId = operador.id

  // Cadastro cheio de propósito: prova que o que falta é do CASO, não de
  // qualificação do cliente — se faltasse algo, o motivo devolvido seria outro.
  const cliente = await prisma.cliente.create({
    data: {
      documento: DOCUMENTO_DO_CLIENTE,
      nome: 'Cliente do teste do contrato por partes',
      nomeBusca: 'cliente do teste do contrato por partes',
      tipoPessoa: TipoPessoa.FISICA,
      nacionalidade: 'brasileira',
      estadoCivil: 'solteira',
      nomeMae: 'Mãe de Teste',
      rg: '12.345.678-9',
      email: 'cliente.contrato.por.partes@exemplo.invalido',
      endereco: 'Rua de Teste, 100',
      cidade: 'São Paulo',
      uf: 'SP',
      cep: '01310100',
    },
    select: { id: true },
  })
  clienteId = cliente.id
})

afterAll(async () => {
  await limpar()
  await prisma.$disconnect()
})

describe('montarPrevia — CONTRATO gerado a partir do caso', () => {
  it('só honorários fixos, com uma parcela: gera e escreve objeto e honorários', async () => {
    const caso = await criarCaso({ honorariosEmCentavos: 175000, parcelas: UMA_PARCELA })

    const resultado = await previa(caso.id)

    expect(resultado.situacao).toBe('pronto')
    if (resultado.situacao !== 'pronto') return
    expect(resultado.html).toContain('na área cível')
    expect(resultado.html).toContain('Ação de cobrança contra Construtora Exemplo Ltda.')
    expect(resultado.html).toContain('R$ 1.750,00')
    expect(resultado.html).toContain('parcela única')
    expect(resultado.html).toContain('em 09/10/2026')
  })

  it('êxito e proveito econômico agora geram contrato, com todos os campos', async () => {
    const caso = await criarCaso({
      tipoDeObjeto: TipoDeObjeto.TRABALHISTA,
      percentualExito: 20,
      percentualProveitoEconomico: 15,
      referenciaDaEconomia: 'a dívida X, valor discutido R$ 10,00, data-base 01/09/2026',
      prazoDePagamentoDaEconomia: 30,
    })

    const resultado = await previa(caso.id)

    expect(resultado.situacao).toBe('pronto')
    if (resultado.situacao !== 'pronto') return
    const texto = resultado.html.replace(/\s+/g, ' ')
    expect(texto).toContain('na área trabalhista')
    expect(texto).toContain('honorários de 20% sobre os valores brutos')
    expect(texto).toContain('honorários de 15% sobre a economia')
    expect(texto).toContain('vencerão em 30 dias')
  })

  it('as quatro modalidades juntas geram contrato', async () => {
    const caso = await criarCaso({
      honorariosEmCentavos: 175000,
      parcelas: UMA_PARCELA,
      percentualExito: 20,
      percentualProveitoEconomico: 15,
      referenciaDaEconomia: 'a dívida X',
      prazoDePagamentoDaEconomia: 30,
      honorariosPersonalizados: true,
      personalizadoServicos: 'a elaboração de parecer',
      personalizadoValorOuPercentual: 'R$ 3.000,00',
      personalizadoBaseDeCalculo: 'não se aplica',
      personalizadoCondicaoDeExigibilidade: 'a entrega do parecer',
      personalizadoPagamento: 'à vista',
      personalizadoNatureza: NaturezaDoHonorarioPersonalizado.CUMULATIVA,
      personalizadoRelacaoComAsDemais: 'as demais modalidades',
      personalizadoCondicoesEspecificas: 'sem abatimentos',
    })

    const resultado = await previa(caso.id)

    expect(resultado.situacao).toBe('pronto')
  })

  it('sem tipo de objeto, recusa e leva para editar o caso', async () => {
    const caso = await criarCaso({
      tipoDeObjeto: null,
      honorariosEmCentavos: 175000,
      parcelas: UMA_PARCELA,
    })

    const resultado = await previa(caso.id)

    expect(resultado.situacao).toBe('faltam_dados')
    if (resultado.situacao !== 'faltam_dados') return
    expect(resultado.faltando).toEqual(['tipo de objeto do contrato'])
    expect(resultado.ondePreencher).toBe(`/painel/casos/${caso.id}/editar`)
  })

  it('sem nenhuma modalidade de honorários, recusa e leva para editar o caso', async () => {
    const caso = await criarCaso({})

    const resultado = await previa(caso.id)

    expect(resultado.situacao).toBe('faltam_dados')
    if (resultado.situacao !== 'faltam_dados') return
    expect(resultado.faltando[0]).toMatch(/ao menos uma modalidade de honorários/)
    expect(resultado.ondePreencher).toBe(`/painel/casos/${caso.id}/editar`)
  })

  it('honorários fixos sem parcela não viram "à vista": pede o vencimento', async () => {
    const caso = await criarCaso({ honorariosEmCentavos: 175000 })

    const resultado = await previa(caso.id)

    expect(resultado.situacao).toBe('faltam_dados')
    if (resultado.situacao !== 'faltam_dados') return
    expect(resultado.faltando).toEqual([
      'ao menos uma parcela dos honorários fixos (com o vencimento)',
    ])
    expect(resultado.ondePreencher).toBe(`/painel/casos/${caso.id}/editar`)
  })

  it('sem a descrição do objeto, recusa e leva para editar o caso', async () => {
    const caso = await criarCaso({
      descricaoDoObjeto: null,
      honorariosEmCentavos: 175000,
      parcelas: UMA_PARCELA,
    })

    const resultado = await previa(caso.id)

    expect(resultado.situacao).toBe('faltam_dados')
    if (resultado.situacao !== 'faltam_dados') return
    expect(resultado.faltando).toEqual(['descrição do objeto do contrato'])
    expect(resultado.ondePreencher).toBe(`/painel/casos/${caso.id}/editar`)
  })

  it('proveito econômico sem referência nem prazo: lista os dois', async () => {
    const caso = await criarCaso({ percentualProveitoEconomico: 15 })

    const resultado = await previa(caso.id)

    expect(resultado.situacao).toBe('faltam_dados')
    if (resultado.situacao !== 'faltam_dados') return
    expect(resultado.faltando.sort()).toEqual([
      'prazo de pagamento da economia, em dias',
      'referência da economia (obrigação, valor discutido e data-base)',
    ])
  })

  // Procuração e declaração não citam objeto nem honorários.
  it('procuração e declaração não dependem do que o caso tem de contrato', async () => {
    await criarCaso({ tipoDeObjeto: null })

    const procuracao = await montarPrevia(
      sessaoDaEquipe(),
      clienteId,
      TipoDocumento.PROCURACAO,
      null,
    )
    expect(procuracao.situacao).toBe('pronto')

    const declaracao = await montarPrevia(
      sessaoDaEquipe(),
      clienteId,
      TipoDocumento.DECLARACAO,
      null,
    )
    expect(declaracao.situacao).toBe('pronto')
  })
})
