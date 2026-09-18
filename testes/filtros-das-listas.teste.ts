/**
 * Os filtros das listas de clientes e de casos.
 *
 * Eles nascem da query string, que é do navegador — então aqui se prova duas
 * coisas: que cada filtro vira a condição certa, e que **valor desconhecido
 * vira "sem filtro" em vez de erro**. Link antigo, filtro renomeado ou query
 * editada à mão devolvem a lista inteira, que é o lado inofensivo de errar.
 *
 * Quem garante que o filtro não amplia o que a sessão enxerga não é este
 * arquivo: é `filtroDeClientes`/`filtroDeCasos`, que embrulham tudo isto
 * (regra 2). Ver `testes-de-banco/isolamento-do-cliente.teste.ts`.
 */

import { describe, expect, it } from 'vitest'
import { SituacaoCaso, TipoPessoa } from '@prisma/client'

import {
  FILTROS_DE_CLIENTE_VAZIOS,
  algumFiltroDeClienteAtivo,
  condicaoDosFiltrosDeCliente,
  lerFiltrosDeCliente,
} from '@/lib/clientes'
import {
  FILTROS_DE_CASO_VAZIOS,
  algumFiltroDeCasoAtivo,
  condicaoDosFiltrosDeCaso,
  lerFiltrosDeCaso,
} from '@/lib/casos'

describe('filtros de cliente — leitura da query string', () => {
  it('lê os quatro filtros', () => {
    expect(
      lerFiltrosDeCliente({
        tipo: 'JURIDICA',
        acesso: 'liberado',
        casos: 'sem',
        situacao: 'inativo',
      }),
    ).toEqual({ tipo: 'JURIDICA', acesso: 'liberado', casos: 'sem', situacao: 'inativo' })
  })

  it('query vazia não filtra nada', () => {
    expect(lerFiltrosDeCliente({})).toEqual(FILTROS_DE_CLIENTE_VAZIOS)
    expect(algumFiltroDeClienteAtivo(lerFiltrosDeCliente({}))).toBe(false)
  })

  // O valor vem da URL: qualquer um pode escrever qualquer coisa ali.
  it('valor inventado é ignorado, não vira erro', () => {
    expect(
      lerFiltrosDeCliente({
        tipo: 'MARCIANA',
        acesso: 'tudo',
        casos: 'talvez',
        situacao: 'aposentado',
      }),
    ).toEqual(FILTROS_DE_CLIENTE_VAZIOS)
  })
})

describe('filtros de cliente — condição', () => {
  it('sem filtro, condição vazia', () => {
    expect(condicaoDosFiltrosDeCliente(FILTROS_DE_CLIENTE_VAZIOS)).toEqual({})
  })

  it('tipo de pessoa', () => {
    expect(
      condicaoDosFiltrosDeCliente({ ...FILTROS_DE_CLIENTE_VAZIOS, tipo: 'FISICA' }),
    ).toEqual({ AND: [{ tipoPessoa: TipoPessoa.FISICA }] })
  })

  it('acesso liberado é contrato assinado; aguardando é o contrário', () => {
    expect(
      condicaoDosFiltrosDeCliente({
        ...FILTROS_DE_CLIENTE_VAZIOS,
        acesso: 'liberado',
      }),
    ).toEqual({ AND: [{ contratoAssinadoEm: { not: null } }] })

    expect(
      condicaoDosFiltrosDeCliente({
        ...FILTROS_DE_CLIENTE_VAZIOS,
        acesso: 'aguardando',
      }),
    ).toEqual({ AND: [{ contratoAssinadoEm: null }] })
  })

  // Cadastro com e-mail em branco é tão sem acesso quanto o sem e-mail
  // nenhum: os dois precisam aparecer nesta lista.
  it('sem e-mail pega nulo e vazio', () => {
    expect(
      condicaoDosFiltrosDeCliente({
        ...FILTROS_DE_CLIENTE_VAZIOS,
        acesso: 'sem_email',
      }),
    ).toEqual({ AND: [{ OR: [{ email: null }, { email: '' }] }] })
  })

  it('com e sem casos', () => {
    expect(
      condicaoDosFiltrosDeCliente({ ...FILTROS_DE_CLIENTE_VAZIOS, casos: 'com' }),
    ).toEqual({ AND: [{ casos: { some: {} } }] })

    expect(
      condicaoDosFiltrosDeCliente({ ...FILTROS_DE_CLIENTE_VAZIOS, casos: 'sem' }),
    ).toEqual({ AND: [{ casos: { none: {} } }] })
  })

  // Item 4 da lista de melhorias: desativar cliente por engano.
  it('situação ativo e inativo', () => {
    expect(
      condicaoDosFiltrosDeCliente({ ...FILTROS_DE_CLIENTE_VAZIOS, situacao: 'ativo' }),
    ).toEqual({ AND: [{ situacao: 'ATIVO' }] })

    expect(
      condicaoDosFiltrosDeCliente({ ...FILTROS_DE_CLIENTE_VAZIOS, situacao: 'inativo' }),
    ).toEqual({ AND: [{ situacao: 'INATIVO' }] })
  })

  // Vários filtros ao mesmo tempo somam, nunca se substituem.
  it('filtros combinam com AND', () => {
    const condicao = condicaoDosFiltrosDeCliente({
      tipo: 'JURIDICA',
      acesso: 'liberado',
      casos: 'com',
      situacao: 'ativo',
    })

    expect(condicao.AND).toHaveLength(4)
  })
})

describe('filtros de caso — leitura da query string', () => {
  it('lê os três filtros', () => {
    expect(
      lerFiltrosDeCaso({
        situacao: SituacaoCaso.ARQUIVADO,
        responsavel: 'abc123',
        numero: 'sem',
      }),
    ).toEqual({
      situacao: SituacaoCaso.ARQUIVADO,
      responsavel: 'abc123',
      numero: 'sem',
    })
  })

  it('situação inventada é ignorada', () => {
    expect(lerFiltrosDeCaso({ situacao: 'PERDIDO' }).situacao).toBe('')
  })

  it('número só aceita com e sem', () => {
    expect(lerFiltrosDeCaso({ numero: 'quase' }).numero).toBe('')
  })

  it('query vazia não filtra nada', () => {
    expect(lerFiltrosDeCaso({})).toEqual(FILTROS_DE_CASO_VAZIOS)
    expect(algumFiltroDeCasoAtivo(lerFiltrosDeCaso({}))).toBe(false)
  })
})

describe('filtros de caso — condição', () => {
  it('sem filtro, condição vazia', () => {
    expect(condicaoDosFiltrosDeCaso(FILTROS_DE_CASO_VAZIOS)).toEqual({})
  })

  it('situação', () => {
    expect(
      condicaoDosFiltrosDeCaso({
        ...FILTROS_DE_CASO_VAZIOS,
        situacao: SituacaoCaso.EM_ANDAMENTO,
      }),
    ).toEqual({ AND: [{ situacao: SituacaoCaso.EM_ANDAMENTO }] })
  })

  // "sem" é palavra reservada do filtro; qualquer outra coisa é um id.
  it('responsável: "sem" vira nulo, o resto vira id', () => {
    expect(
      condicaoDosFiltrosDeCaso({ ...FILTROS_DE_CASO_VAZIOS, responsavel: 'sem' }),
    ).toEqual({ AND: [{ responsavelId: null }] })

    expect(
      condicaoDosFiltrosDeCaso({ ...FILTROS_DE_CASO_VAZIOS, responsavel: 'abc123' }),
    ).toEqual({ AND: [{ responsavelId: 'abc123' }] })
  })

  // O caso ainda em fase pré-processual não tem número, e saber quais são é a
  // diferença entre lembrar e esquecer de protocolar.
  it('com e sem número de processo', () => {
    expect(
      condicaoDosFiltrosDeCaso({ ...FILTROS_DE_CASO_VAZIOS, numero: 'com' }),
    ).toEqual({ AND: [{ numeroProcesso: { not: null } }] })

    expect(
      condicaoDosFiltrosDeCaso({ ...FILTROS_DE_CASO_VAZIOS, numero: 'sem' }),
    ).toEqual({ AND: [{ numeroProcesso: null }] })
  })
})
