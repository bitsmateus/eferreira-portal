/**
 * `criarClienteComRepresentante` — cadastrar uma pessoa jurídica sem
 * representante legal deixou de ser possível a partir de 17/09/2026. Contra o
 * Postgres de verdade porque a função decide, dentro de uma transação, entre
 * reaproveitar um cliente pessoa física já existente (regra 4) ou criar um
 * novo — e é exatamente esse desvio de caminho que este teste teria como
 * único jeito de provar.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PerfilUsuario, TipoPessoa } from '@prisma/client'

import { criarClienteComRepresentante, type DadosDoRepresentante } from '@/lib/clientes'
import { prisma } from '@/lib/prisma'

const DOCUMENTO_DA_EMPRESA = '11222333000181'
const DOCUMENTO_DA_EMPRESA_2 = '11444777000161'
const DOCUMENTO_DA_EMPRESA_3 = '11444777000242'
const DOCUMENTO_DA_EMPRESA_4 = '11444777000323'
const DOCUMENTO_DO_SOCIO_NOVO = '39053344705'
const DOCUMENTO_DO_SOCIO_NOVO_2 = '90493796095'
const DOCUMENTO_DO_SOCIO_EXISTENTE = '52998224725'
const DOCUMENTO_DE_OUTRA_EMPRESA = '11222333000100' // usado só como CNPJ "existente" na recusa
const EMAIL_DO_OPERADOR = 'operador.teste.representante@exemplo.invalido'

let operadorId: string

function sessaoDaEquipe() {
  return {
    usuarioId: operadorId,
    perfil: PerfilUsuario.OPERADOR,
    clienteId: null,
    contratoAssinado: false,
  }
}

function dadosDaEmpresa(documento: string, nome: string) {
  return {
    tipoPessoa: TipoPessoa.JURIDICA,
    documento,
    nome,
    rg: null,
    dataNascimento: null,
    estadoCivil: null,
    profissao: null,
    nacionalidade: null,
    nomeMae: null,
    email: 'contato@empresa-teste.invalido',
    telefone: '11988124470',
    cep: '01310100',
    endereco: 'Av. Paulista, 1000',
    cidade: 'São Paulo',
    uf: 'SP',
  }
}

function dadosDoRepresentante(
  troca: Partial<DadosDoRepresentante> = {},
): DadosDoRepresentante {
  return {
    documento: DOCUMENTO_DO_SOCIO_NOVO,
    nome: 'Sócio de Teste da Silva',
    rg: '12.345.678-9',
    estadoCivil: 'casado',
    profissao: 'empresário',
    nacionalidade: 'brasileiro',
    nomeMae: null,
    email: 'socio@empresa-teste.invalido',
    telefone: '11988124471',
    qualificacao: 'sócio administrador',
    ...troca,
  }
}

async function limpar(): Promise<void> {
  await prisma.cliente.deleteMany({
    where: {
      documento: {
        in: [
          DOCUMENTO_DA_EMPRESA,
          DOCUMENTO_DA_EMPRESA_2,
          DOCUMENTO_DA_EMPRESA_3,
          DOCUMENTO_DA_EMPRESA_4,
          DOCUMENTO_DO_SOCIO_NOVO,
          DOCUMENTO_DO_SOCIO_NOVO_2,
          DOCUMENTO_DO_SOCIO_EXISTENTE,
          DOCUMENTO_DE_OUTRA_EMPRESA,
        ],
      },
    },
  })
  await prisma.usuario.deleteMany({ where: { email: EMAIL_DO_OPERADOR } })
}

beforeAll(async () => {
  await limpar()

  const operador = await prisma.usuario.create({
    data: {
      nome: 'Operador do teste de representante legal',
      email: EMAIL_DO_OPERADOR,
      senhaHash: 'nao-usado',
      perfil: PerfilUsuario.OPERADOR,
    },
    select: { id: true },
  })
  operadorId = operador.id
})

afterAll(async () => {
  await limpar()
  await prisma.$disconnect()
})

describe('criarClienteComRepresentante', () => {
  it('cria a empresa e o sócio na mesma transação, e vincula os dois', async () => {
    const resultado = await criarClienteComRepresentante(
      sessaoDaEquipe(),
      dadosDaEmpresa(DOCUMENTO_DA_EMPRESA, 'Empresa de Teste Ltda'),
      dadosDoRepresentante(),
      EMAIL_DO_OPERADOR,
    )

    expect(resultado.situacao).toBe('criado')
    if (resultado.situacao !== 'criado') return

    const empresa = await prisma.cliente.findUniqueOrThrow({
      where: { id: resultado.clienteId },
      include: { representantes: { include: { pessoaFisica: true } } },
    })

    expect(empresa.tipoPessoa).toBe(TipoPessoa.JURIDICA)
    expect(empresa.representantes).toHaveLength(1)

    const vinculo = empresa.representantes[0]
    expect(vinculo?.qualificacao).toBe('sócio administrador')
    expect(vinculo?.pessoaFisica.documento).toBe(DOCUMENTO_DO_SOCIO_NOVO)
    expect(vinculo?.pessoaFisica.tipoPessoa).toBe(TipoPessoa.FISICA)
    expect(vinculo?.pessoaFisica.nome).toBe('Sócio de Teste da Silva')

    // Regra 6: as duas criações — empresa e vínculo — ficam auditadas.
    const auditoriaDaEmpresa = await prisma.auditoria.findFirst({
      where: { entidade: 'cliente', entidadeId: empresa.id, acao: 'CRIACAO' },
    })
    expect(auditoriaDaEmpresa).not.toBeNull()

    const auditoriaDoVinculo = await prisma.auditoria.findFirst({
      where: { entidade: 'representante_legal', entidadeId: empresa.id, acao: 'CRIACAO' },
    })
    expect(auditoriaDoVinculo).not.toBeNull()
    expect(JSON.stringify(auditoriaDoVinculo?.detalhes)).toContain('"reaproveitado":false')
  })

  it('reaproveita um cliente pessoa física já cadastrado, em vez de duplicar (regra 4)', async () => {
    const socio = await prisma.cliente.create({
      data: {
        tipoPessoa: TipoPessoa.FISICA,
        documento: DOCUMENTO_DO_SOCIO_EXISTENTE,
        nome: 'Sócio Já Cadastrado',
        nomeBusca: 'socio ja cadastrado',
      },
      select: { id: true },
    })

    const resultado = await criarClienteComRepresentante(
      sessaoDaEquipe(),
      dadosDaEmpresa(DOCUMENTO_DA_EMPRESA_2, 'Segunda Empresa de Teste Ltda'),
      dadosDoRepresentante({ documento: DOCUMENTO_DO_SOCIO_EXISTENTE }),
      EMAIL_DO_OPERADOR,
    )

    expect(resultado.situacao).toBe('criado')
    if (resultado.situacao !== 'criado') return

    const quantosComEsteDocumento = await prisma.cliente.count({
      where: { documento: DOCUMENTO_DO_SOCIO_EXISTENTE },
    })
    expect(quantosComEsteDocumento).toBe(1)

    const vinculo = await prisma.representanteLegal.findUnique({
      where: {
        pessoaJuridicaId_pessoaFisicaId: {
          pessoaJuridicaId: resultado.clienteId,
          pessoaFisicaId: socio.id,
        },
      },
    })
    expect(vinculo).not.toBeNull()

    const auditoriaDoVinculo = await prisma.auditoria.findFirst({
      where: { entidade: 'representante_legal', entidadeId: resultado.clienteId },
    })
    expect(JSON.stringify(auditoriaDoVinculo?.detalhes)).toContain('"reaproveitado":true')
  })

  it('recusa quando o documento do representante já é de outra pessoa jurídica', async () => {
    await prisma.cliente.create({
      data: {
        tipoPessoa: TipoPessoa.JURIDICA,
        documento: DOCUMENTO_DE_OUTRA_EMPRESA,
        nome: 'Empresa Que Não Pode Ser Sócia',
        nomeBusca: 'empresa que nao pode ser socia',
      },
    })

    const resultado = await criarClienteComRepresentante(
      sessaoDaEquipe(),
      dadosDaEmpresa(DOCUMENTO_DA_EMPRESA_3, 'Empresa Recusada Ltda'),
      dadosDoRepresentante({ documento: DOCUMENTO_DE_OUTRA_EMPRESA }),
      EMAIL_DO_OPERADOR,
    )

    expect(resultado).toEqual({
      situacao: 'representante_e_pessoa_juridica',
      nome: 'Empresa Que Não Pode Ser Sócia',
    })

    // Nada deve ter sido criado: nem a empresa, nem qualquer vínculo.
    const empresaCriada = await prisma.cliente.findUnique({
      where: { documento: DOCUMENTO_DA_EMPRESA_3 },
    })
    expect(empresaCriada).toBeNull()
  })

  it('devolve "ja_existe" quando o CNPJ já está cadastrado, sem tocar em nada', async () => {
    const jaExistente = await prisma.cliente.create({
      data: {
        tipoPessoa: TipoPessoa.JURIDICA,
        documento: DOCUMENTO_DA_EMPRESA_4,
        nome: 'Empresa Já Cadastrada Ltda',
        nomeBusca: 'empresa ja cadastrada ltda',
      },
      select: { id: true, nome: true },
    })

    const resultado = await criarClienteComRepresentante(
      sessaoDaEquipe(),
      dadosDaEmpresa(DOCUMENTO_DA_EMPRESA_4, 'Empresa Já Cadastrada Ltda'),
      dadosDoRepresentante({ documento: DOCUMENTO_DO_SOCIO_NOVO_2 }),
      EMAIL_DO_OPERADOR,
    )

    expect(resultado).toEqual({
      situacao: 'ja_existe',
      clienteId: jaExistente.id,
      nome: jaExistente.nome,
    })

    const socioCriadoPorEngano = await prisma.cliente.findUnique({
      where: { documento: DOCUMENTO_DO_SOCIO_NOVO_2 },
    })
    expect(socioCriadoPorEngano).toBeNull()
  })
})
