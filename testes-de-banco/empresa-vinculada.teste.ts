/**
 * Empresa vinculada ao caso (24/09/2026), contra o banco de verdade.
 *
 * O escritório atende clientes que uma empresa parceira envia (ex.: a GWA):
 * o caso continua sendo do cliente final — contrato e procuração em nome
 * dele —, mas fica LIGADO à empresa, que precisa (1) achar os casos dela por
 * filtro e (2) ver o andamento no portal, "o mesmo acesso do cliente normal,
 * só que vinculada a vários processos".
 *
 * Regra 3, o requisito número um: o que a empresa ganha é VISÃO DO CASO, e só.
 * Não ganha documento do cliente final, e o que não está ligado a ela
 * continua invisível.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PerfilUsuario, TipoPessoa } from '@prisma/client'

import { SemAutorizacao, filtroDeAndamentos, type SessaoServidor } from '@/lib/autorizacao'
import { meusCasos, meusDocumentos } from '@/lib/area-do-cliente'
import { criarCaso, esquemaDeCaso, listarCasos, lerFiltrosDeCaso, type DadosDeCaso } from '@/lib/casos'
import { prisma } from '@/lib/prisma'

const DOC_PESSOA = '52998224725'
const DOC_EMPRESA = '11222333000181'
const DOC_OUTRA_EMPRESA = '45723174000110'
const EMAIL_DO_OPERADOR = 'operador.teste.empresa.vinculada@exemplo.invalido'

let operadorId: string
let pessoaId: string
let empresaId: string
let outraEmpresaId: string
let casoLigadoId: string
let casoSoDaPessoaId: string

const sessaoDaEquipe = (): SessaoServidor => ({
  usuarioId: operadorId,
  perfil: PerfilUsuario.OPERADOR,
  clienteId: null,
  contratoAssinado: false,
})

const sessaoDeCliente = (clienteId: string, contratoAssinado = true): SessaoServidor => ({
  usuarioId: 'nao-importa',
  perfil: PerfilUsuario.CLIENTE,
  clienteId,
  contratoAssinado,
})

function dadosDoCaso(extra: Partial<DadosDeCaso> = {}): DadosDeCaso {
  const conferido = esquemaDeCaso.parse({
    honorarios: '',
    canalDePagamentoFixo: '',
    percentualExito: '',
    percentualProveitoEconomico: '',
    referenciaDaEconomia: '',
    prazoDePagamentoDaEconomia: '',
    tipoDeObjeto: '',
    descricaoDoObjeto: '',
    honorariosPersonalizados: '',
    personalizadoServicos: '',
    personalizadoValorOuPercentual: '',
    personalizadoBaseDeCalculo: '',
    personalizadoCondicaoDeExigibilidade: '',
    personalizadoPagamento: '',
    personalizadoNatureza: '',
    personalizadoRelacaoComAsDemais: '',
    personalizadoCondicoesEspecificas: '',
    numeroProcesso: '',
    assunto: 'Caso do teste da empresa vinculada',
    vara: '',
    parteContraria: '',
    situacao: '',
    responsavelId: '',
    empresaVinculadaId: '',
  })
  return { ...conferido, ...extra }
}

async function limpar(): Promise<void> {
  await prisma.cliente.deleteMany({
    where: { documento: { in: [DOC_PESSOA, DOC_EMPRESA, DOC_OUTRA_EMPRESA] } },
  })
  await prisma.usuario.deleteMany({ where: { email: EMAIL_DO_OPERADOR } })
}

async function novoCliente(documento: string, nome: string, tipoPessoa: TipoPessoa) {
  return (
    await prisma.cliente.create({
      data: {
        documento,
        nome,
        nomeBusca: nome.toLowerCase(),
        tipoPessoa,
        contratoAssinadoEm: new Date(),
      },
      select: { id: true },
    })
  ).id
}

beforeAll(async () => {
  await limpar()

  operadorId = (
    await prisma.usuario.create({
      data: {
        nome: 'Operador do teste da empresa vinculada',
        email: EMAIL_DO_OPERADOR,
        senhaHash: 'nao-usado',
        perfil: PerfilUsuario.OPERADOR,
      },
      select: { id: true },
    })
  ).id

  pessoaId = await novoCliente(DOC_PESSOA, 'Pessoa do teste da empresa', TipoPessoa.FISICA)
  empresaId = await novoCliente(DOC_EMPRESA, 'GWA do teste', TipoPessoa.JURIDICA)
  outraEmpresaId = await novoCliente(DOC_OUTRA_EMPRESA, 'Outra empresa do teste', TipoPessoa.JURIDICA)

  const ligado = await criarCaso(
    sessaoDaEquipe(),
    pessoaId,
    dadosDoCaso({ assunto: 'Caso ligado à empresa', empresaVinculadaId: empresaId }),
    [],
    null,
  )
  if (ligado.situacao !== 'criado') throw new Error('falha ao preparar o caso ligado')
  casoLigadoId = ligado.casoId

  const soDaPessoa = await criarCaso(
    sessaoDaEquipe(),
    pessoaId,
    dadosDoCaso({ assunto: 'Caso só da pessoa' }),
    [],
    null,
  )
  if (soDaPessoa.situacao !== 'criado') throw new Error('falha ao preparar o outro caso')
  casoSoDaPessoaId = soDaPessoa.casoId

  await prisma.documento.create({
    data: {
      clienteId: pessoaId,
      casoId: casoLigadoId,
      tipo: 'CONTRATO',
      nome: 'contrato-da-pessoa.pdf',
      chaveArquivo: 'teste/empresa-vinculada/contrato-da-pessoa',
      tipoConteudo: 'application/pdf',
      tamanhoBytes: 10,
    },
  })
})

afterAll(async () => {
  await limpar()
  await prisma.$disconnect()
})

describe('o que a empresa enxerga no portal', () => {
  it('vê o caso ligado a ela — e só ele', async () => {
    const casos = await meusCasos(sessaoDeCliente(empresaId))
    expect(casos.map((caso) => caso.id)).toEqual([casoLigadoId])
  })

  it('a pessoa continua vendo os DOIS casos dela, como sempre', async () => {
    const casos = await meusCasos(sessaoDeCliente(pessoaId))
    expect(casos.map((caso) => caso.id).sort()).toEqual([casoLigadoId, casoSoDaPessoaId].sort())
  })

  it('outra empresa não vê nada', async () => {
    expect(await meusCasos(sessaoDeCliente(outraEmpresaId))).toEqual([])
  })

  it('a empresa NÃO ganha os documentos do cliente final', async () => {
    expect(await meusDocumentos(sessaoDeCliente(empresaId))).toEqual([])
    // A pessoa, dona do contrato, continua vendo o dela.
    expect(await meusDocumentos(sessaoDeCliente(pessoaId))).toHaveLength(1)
  })

  it('o andamento do caso ligado é da empresa; o do outro caso, não', async () => {
    const andamento = async (casoId: string) => {
      const status = await prisma.statusAndamento.findFirstOrThrow({ select: { id: true } })
      return prisma.andamento.create({
        data: {
          casoId,
          statusId: status.id,
          data: new Date('2026-09-01T12:00:00Z'),
          descricao: 'andamento de teste',
          autorId: operadorId,
        },
        select: { id: true },
      })
    }
    const doLigado = await andamento(casoLigadoId)
    const doOutro = await andamento(casoSoDaPessoaId)

    const visiveis = await prisma.andamento.findMany({
      where: filtroDeAndamentos(sessaoDeCliente(empresaId)),
      select: { id: true },
    })
    expect(visiveis.map((a) => a.id)).toEqual([doLigado.id])
    expect(visiveis.map((a) => a.id)).not.toContain(doOutro.id)
  })

  it('sem contrato assinado a empresa também não entra (Anexo I, 1.d)', () => {
    expect(() => filtroDeAndamentos(sessaoDeCliente(empresaId, false))).toThrow(SemAutorizacao)
  })
})

describe('ligar o caso a uma empresa', () => {
  it('recusa uma pessoa física no lugar da empresa', async () => {
    const resultado = await criarCaso(
      sessaoDaEquipe(),
      pessoaId,
      dadosDoCaso({ empresaVinculadaId: pessoaId }),
      [],
      null,
    )
    expect(resultado.situacao).toBe('empresa_invalida')
  })

  it('recusa um id que não existe', async () => {
    const resultado = await criarCaso(
      sessaoDaEquipe(),
      pessoaId,
      dadosDoCaso({ empresaVinculadaId: 'nao-existe' }),
      [],
      null,
    )
    expect(resultado.situacao).toBe('empresa_invalida')
  })
})

describe('achar os casos de uma empresa', () => {
  it('filtra pela empresa', async () => {
    const lista = await listarCasos(
      sessaoDaEquipe(),
      '',
      lerFiltrosDeCaso({ empresa: empresaId }),
    )
    expect(lista.linhas.map((linha) => linha.id)).toEqual([casoLigadoId])
    expect(lista.linhas[0]?.empresaVinculada?.nome).toBe('GWA do teste')
  })

  it('a busca também acha pelo CNPJ ou pelo nome da empresa', async () => {
    const pelosDigitos = await listarCasos(sessaoDaEquipe(), '11.222.333/0001-81')
    expect(pelosDigitos.linhas.map((linha) => linha.id)).toContain(casoLigadoId)

    const peloNome = await listarCasos(sessaoDaEquipe(), 'gwa do teste')
    expect(peloNome.linhas.map((linha) => linha.id)).toEqual([casoLigadoId])
  })

  it('filtro por uma empresa sem caso devolve lista vazia', async () => {
    const lista = await listarCasos(
      sessaoDaEquipe(),
      '',
      lerFiltrosDeCaso({ empresa: outraEmpresaId }),
    )
    expect(lista.linhas).toEqual([])
  })
})
