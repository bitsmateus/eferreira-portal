/**
 * As duas modalidades novas de honorários (17/09/2026) — êxito e percentual
 * sobre o proveito econômico — já entram no cadastro do caso, mas o modelo
 * do contrato (cláusula 2ª) só descreve valor fixo. Regra 10 proíbe inventar
 * o texto da cláusula nova, então `montarPrevia` recusa gerar CONTRATO para
 * um caso que tenha qualquer uma das duas preenchida, até o escritório
 * mandar o modelo. Contra o banco porque é `montarPrevia` — que consulta o
 * caso de verdade — quem decide isso, não a validação do formulário.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PerfilUsuario, TipoDocumento, TipoPessoa } from '@prisma/client'

import { montarPrevia } from '@/lib/geracao'
import { prisma } from '@/lib/prisma'

const DOCUMENTO_DO_CLIENTE = '05058050060'
const EMAIL_DO_OPERADOR = 'operador.teste.honorarios.novos@exemplo.invalido'

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

async function criarCaso(dados: {
  honorariosEmCentavos?: number
  percentualExito?: number
  percentualProveitoEconomico?: number
}) {
  return prisma.caso.create({
    data: {
      clienteId,
      assunto: 'Caso do teste de honorários novos',
      ...dados,
    },
    select: { id: true },
  })
}

async function limpar(): Promise<void> {
  await prisma.cliente.deleteMany({ where: { documento: DOCUMENTO_DO_CLIENTE } })
  await prisma.usuario.deleteMany({ where: { email: EMAIL_DO_OPERADOR } })
}

beforeAll(async () => {
  await limpar()

  const operador = await prisma.usuario.create({
    data: {
      nome: 'Operador do teste de honorários novos',
      email: EMAIL_DO_OPERADOR,
      senhaHash: 'nao-usado',
      perfil: PerfilUsuario.OPERADOR,
    },
    select: { id: true },
  })
  operadorId = operador.id

  // Cadastro cheio de propósito: prova que o bloqueio é da cláusula, não de
  // qualificação faltando — se faltasse algo, o motivo devolvido seria outro.
  const cliente = await prisma.cliente.create({
    data: {
      documento: DOCUMENTO_DO_CLIENTE,
      nome: 'Cliente do teste de honorários novos',
      nomeBusca: 'cliente do teste de honorarios novos',
      tipoPessoa: TipoPessoa.FISICA,
      nacionalidade: 'brasileira',
      estadoCivil: 'solteira',
      nomeMae: 'Mãe de Teste',
      rg: '12.345.678-9',
      email: 'cliente.honorarios.novos@exemplo.invalido',
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

describe('montarPrevia — CONTRATO com honorários de êxito ou de proveito econômico', () => {
  it('recusa quando o caso tem honorários de êxito', async () => {
    const caso = await criarCaso({ percentualExito: 20 })

    const resultado = await montarPrevia(
      sessaoDaEquipe(),
      clienteId,
      TipoDocumento.CONTRATO,
      caso.id,
    )

    expect(resultado.situacao).toBe('faltam_dados')
    if (resultado.situacao !== 'faltam_dados') return
    expect(resultado.faltando[0]).toMatch(/cláusula de honorários/i)
    expect(resultado.ondePreencher).toBe(`/painel/casos/${caso.id}`)
  })

  it('recusa quando o caso tem percentual sobre proveito econômico', async () => {
    const caso = await criarCaso({ percentualProveitoEconomico: 15 })

    const resultado = await montarPrevia(
      sessaoDaEquipe(),
      clienteId,
      TipoDocumento.CONTRATO,
      caso.id,
    )

    expect(resultado.situacao).toBe('faltam_dados')
  })

  it('recusa quando o caso combina fixo com uma das duas modalidades novas', async () => {
    const caso = await criarCaso({
      honorariosEmCentavos: 175000,
      percentualExito: 30,
    })

    const resultado = await montarPrevia(
      sessaoDaEquipe(),
      clienteId,
      TipoDocumento.CONTRATO,
      caso.id,
    )

    expect(resultado.situacao).toBe('faltam_dados')
  })

  it('gera normalmente quando só há honorários fixos', async () => {
    const caso = await criarCaso({ honorariosEmCentavos: 175000 })

    const resultado = await montarPrevia(
      sessaoDaEquipe(),
      clienteId,
      TipoDocumento.CONTRATO,
      caso.id,
    )

    expect(resultado.situacao).toBe('pronto')
  })

  // Procuração e declaração não citam honorários — a trava é só do contrato.
  it('não bloqueia procuração nem declaração, mesmo com percentual no caso', async () => {
    await criarCaso({ percentualExito: 20 })

    const procuracao = await montarPrevia(
      sessaoDaEquipe(),
      clienteId,
      TipoDocumento.PROCURACAO,
      null,
    )
    expect(procuracao.situacao).not.toBe('faltam_dados')

    const declaracao = await montarPrevia(
      sessaoDaEquipe(),
      clienteId,
      TipoDocumento.DECLARACAO,
      null,
    )
    expect(declaracao.situacao).not.toBe('faltam_dados')
  })
})
