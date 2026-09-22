import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CanalDePagamentoDosHonorariosFixos,
  NaturezaDoHonorarioPersonalizado,
  TipoDeObjeto,
  TipoPessoa,
} from '@prisma/client'

import {
  MODELOS,
  ROTULOS_DO_CASO,
  aplicarPartes,
  arquivoDoObjeto,
  arquivosDosHonorarios,
  formaDePagamentoDosFixos,
  lacunasDoContrato,
  preencherModelo,
  valoresDoDocumento,
  vencimentosDosFixos,
  type CasoParaDocumento,
  type ClienteParaDocumento,
} from '@/lib/modelos'

/**
 * O contrato, desde 21/09/2026, é montado por partes: cinco variações de objeto
 * e quatro blocos de honorários combináveis mais um comum. Estes testes montam
 * o contrato como `geracao.ts` monta — as mesmas funções escolhem os arquivos —
 * e conferem o que sai.
 */

function lerArquivo(nome: string): string {
  return readFileSync(join(process.cwd(), 'src', 'modelos', `${nome}.html`), 'utf8')
}

function montarContrato(caso: CasoParaDocumento): string {
  const arquivo = arquivoDoObjeto(caso.tipoDeObjeto)
  return aplicarPartes(lerArquivo(MODELOS.CONTRATO), {
    objeto: arquivo === null ? '' : lerArquivo(arquivo),
    honorarios: arquivosDosHonorarios(caso)
      .map((parte) => lerArquivo(parte))
      .join('\n'),
  })
}

const cliente: ClienteParaDocumento = {
  nome: 'Fulano de Tal da Silva',
  tipoPessoa: TipoPessoa.FISICA,
  documento: '52998224725',
  nacionalidade: 'brasileiro',
  estadoCivil: 'casado',
  nomeMae: 'Beltrana de Tal',
  rg: '12.345.678 SSP-SP',
  email: 'fulano@exemplo.com.br',
  endereco: 'Rua das Flores, 100, Centro',
  cidade: 'Mogi das Cruzes',
  uf: 'SP',
  cep: '08780040',
}

const emitidoEm = new Date('2026-09-21T12:00:00Z')

const PARCELAS = [
  { numero: 1, valorEmCentavos: 50000, vencimento: new Date('2026-10-09T12:00:00Z') },
  { numero: 2, valorEmCentavos: 50000, vencimento: new Date('2026-11-09T12:00:00Z') },
  { numero: 3, valorEmCentavos: 75000, vencimento: new Date('2026-12-09T12:00:00Z') },
]

const SEM_MODALIDADES: CasoParaDocumento = {
  parcelas: [],
  honorariosEmCentavos: null,
  canalDePagamentoFixo: null,
  percentualExito: null,
  percentualProveitoEconomico: null,
  referenciaDaEconomia: null,
  prazoDePagamentoDaEconomia: null,
  tipoDeObjeto: TipoDeObjeto.CIVEL,
  descricaoDoObjeto:
    'Ação de cobrança contra Construtora Exemplo Ltda, processo 0000000-00.2026.8.26.0000.',
  honorariosPersonalizados: false,
  personalizadoServicos: null,
  personalizadoValorOuPercentual: null,
  personalizadoBaseDeCalculo: null,
  personalizadoCondicaoDeExigibilidade: null,
  personalizadoPagamento: null,
  personalizadoNatureza: null,
  personalizadoRelacaoComAsDemais: null,
  personalizadoCondicoesEspecificas: null,
}

const SO_FIXOS: CasoParaDocumento = {
  ...SEM_MODALIDADES,
  honorariosEmCentavos: 175000,
  parcelas: PARCELAS,
}

const COMPLETO: CasoParaDocumento = {
  ...SO_FIXOS,
  percentualExito: 20,
  percentualProveitoEconomico: 15,
  referenciaDaEconomia: 'a dívida X, valor discutido R$ 80.000,00, data-base 01/09/2026',
  prazoDePagamentoDaEconomia: 30,
  honorariosPersonalizados: true,
  personalizadoServicos: 'a elaboração de parecer',
  personalizadoValorOuPercentual: 'R$ 3.000,00',
  personalizadoBaseDeCalculo: 'não se aplica',
  personalizadoCondicaoDeExigibilidade: 'a entrega do parecer',
  personalizadoPagamento: 'à vista, em 10/10/2026',
  personalizadoNatureza: NaturezaDoHonorarioPersonalizado.CUMULATIVA,
  personalizadoRelacaoComAsDemais: 'os honorários fixos e de êxito',
  personalizadoCondicoesEspecificas: 'sem abatimentos',
}

function preencher(caso: CasoParaDocumento) {
  return preencherModelo(montarContrato(caso), valoresDoDocumento(cliente, null, caso, emitidoEm))
}

/** O HTML do escritório quebra linha no meio da frase; o que se confere é o texto corrido. */
function contratoPreenchido(caso: CasoParaDocumento): string {
  const resultado = preencher(caso)
  expect(resultado.ok, JSON.stringify(resultado)).toBe(true)
  return resultado.ok ? resultado.html.replace(/\s+/g, ' ') : ''
}

describe('cláusula de objeto — as cinco variações', () => {
  const porTipo: [TipoDeObjeto, string][] = [
    [TipoDeObjeto.CONSUMIDOR_PLANO_DE_SAUDE, 'demanda contra operadora de plano de saúde'],
    [TipoDeObjeto.TRABALHISTA, 'na área trabalhista'],
    [TipoDeObjeto.CIVEL, 'na área cível'],
    [TipoDeObjeto.REVISIONAL, 'revisão ou discussão de'],
    [TipoDeObjeto.PERSONALIZADO, 'exclusivamente nos limites dos serviços'],
  ]

  it.each(porTipo)('%s entra com o texto próprio e a descrição do caso', (tipo, trecho) => {
    const html = contratoPreenchido({ ...SO_FIXOS, tipoDeObjeto: tipo })

    expect(html).toContain(trecho)
    expect(html).toContain('Ação de cobrança contra Construtora Exemplo Ltda')
    expect(html).toContain('1.1. O presente contrato tem por objeto')
    expect(html).toContain('1.2.')
    expect(html).toContain('Cláusula Primeira – Do Objeto')
  })

  it('uma variação não vaza o texto de outra', () => {
    const html = contratoPreenchido({ ...SO_FIXOS, tipoDeObjeto: TipoDeObjeto.TRABALHISTA })

    expect(html).not.toContain('operadora de plano de saúde')
    expect(html).not.toContain('na área cível')
    expect(html).toContain('Tribunal Superior do Trabalho')
  })

  it('sem tipo escolhido, o contrato não existe — a lacuna é dita', () => {
    expect(lacunasDoContrato({ ...SO_FIXOS, tipoDeObjeto: null })).toContain(
      'tipo de objeto do contrato',
    )
    expect(arquivoDoObjeto(null)).toBeNull()
  })

  it('sem descrição, recusa e diz o que falta', () => {
    const resultado = preencher({ ...SO_FIXOS, descricaoDoObjeto: null })

    expect(resultado.ok).toBe(false)
    if (resultado.ok) return
    expect(resultado.faltando).toEqual(['descrição do objeto do contrato'])
  })

  it('escapa HTML que o operador digitou na descrição', () => {
    const html = contratoPreenchido({
      ...SO_FIXOS,
      descricaoDoObjeto: 'Caso <b>especial</b> & outros',
    })

    expect(html).not.toContain('<b>especial</b>')
    expect(html).toContain('&lt;b&gt;especial&lt;/b&gt; &amp; outros')
  })
})

describe('cláusula de honorários — blocos combináveis', () => {
  it('escolhe os arquivos na ordem do escritório, com o bloco comum no fim', () => {
    expect(arquivosDosHonorarios(SO_FIXOS)).toEqual([
      'contrato-honorarios-fixos',
      'contrato-honorarios-comuns',
    ])

    expect(arquivosDosHonorarios(COMPLETO)).toEqual([
      'contrato-honorarios-fixos',
      'contrato-honorarios-exito',
      'contrato-honorarios-economia',
      'contrato-honorarios-personalizados',
      'contrato-honorarios-comuns',
    ])
  })

  it('sem nenhuma modalidade, não há cláusula — a lacuna é dita', () => {
    expect(arquivosDosHonorarios(SEM_MODALIDADES)).toEqual([])
    expect(lacunasDoContrato(SEM_MODALIDADES)).toEqual([
      'ao menos uma modalidade de honorários (fixos, êxito, proveito econômico ou personalizados)',
    ])
  })

  it('só fixos: bloco 1 e bloco comum, sem os outros', () => {
    const html = contratoPreenchido(SO_FIXOS)

    expect(html).toContain('Cláusula Terceira — Dos Honorários Contratuais')
    expect(html).toContain('3.1. Pelos serviços descritos neste contrato')
    expect(html).toContain('honorários fixos no valor de R$ 1.750,00')
    expect(html).toContain('mil setecentos e cinquenta reais')
    expect(html).toContain('mediante 3(três) parcelas')
    expect(html).toContain('3.5. As modalidades expressamente previstas')
    expect(html).toContain('3.9. O atraso superior a 10 (dez) dias')
    expect(html).not.toContain('sobre os valores brutos efetivamente recebidos')
    expect(html).not.toContain('sobre a economia efetivamente obtida')
    expect(html).not.toContain('Pela prestação de')
  })

  it('só êxito: começa em 3.2, como no arquivo do escritório', () => {
    const html = contratoPreenchido({ ...SEM_MODALIDADES, percentualExito: 25 })

    expect(html).toContain('3.2. O CONTRATANTE pagará ao CONTRATADO honorários de 25%')
    expect(html).not.toContain('honorários fixos no valor')
    expect(html).toContain('3.5.')
  })

  it('só proveito econômico traz a referência e o prazo', () => {
    const html = contratoPreenchido({
      ...SEM_MODALIDADES,
      percentualProveitoEconomico: 15,
      referenciaDaEconomia: 'a dívida X, valor discutido R$ 10,00, data-base 01/09/2026',
      prazoDePagamentoDaEconomia: 45,
    })

    expect(html).toContain('honorários de 15% sobre a economia efetivamente obtida')
    expect(html).toContain('a dívida X, valor discutido R$ 10,00, data-base 01/09/2026')
    expect(html).toContain('vencerão em 45 dias')
  })

  it('proveito econômico sem referência ou prazo recusa e diz o que falta', () => {
    const resultado = preencher({ ...SEM_MODALIDADES, percentualProveitoEconomico: 15 })

    expect(resultado.ok).toBe(false)
    if (resultado.ok) return
    expect(resultado.faltando.sort()).toEqual([
      'prazo de pagamento da economia, em dias',
      'referência da economia (obrigação, valor discutido e data-base)',
    ])
  })

  it('personalizados preenche os oito campos do modelo', () => {
    const html = contratoPreenchido({
      ...SEM_MODALIDADES,
      honorariosPersonalizados: true,
      personalizadoServicos: 'a elaboração de parecer',
      personalizadoValorOuPercentual: 'R$ 3.000,00',
      personalizadoBaseDeCalculo: 'não se aplica',
      personalizadoCondicaoDeExigibilidade: 'a entrega do parecer',
      personalizadoPagamento: 'à vista, em 10/10/2026',
      personalizadoNatureza: NaturezaDoHonorarioPersonalizado.COMPENSAVEL,
      personalizadoRelacaoComAsDemais: 'contratação isolada',
      personalizadoCondicoesEspecificas: 'sem abatimentos',
    })

    expect(html).toContain('3.4. Pela prestação de a elaboração de parecer')
    expect(html).toContain('calculados sobre não se aplica')
    expect(html).toContain('Esta remuneração será compensável em relação a contratação isolada')
    expect(html).toContain('condições específicas: sem abatimentos.')
  })

  it('personalizados incompleto lista cada campo que falta', () => {
    const resultado = preencher({
      ...SEM_MODALIDADES,
      honorariosPersonalizados: true,
      personalizadoServicos: 'a elaboração de parecer',
    })

    expect(resultado.ok).toBe(false)
    if (resultado.ok) return
    expect(resultado.faltando).toHaveLength(7)
    expect(resultado.faltando).toContain('personalizados: valor ou percentual')
  })

  it('as quatro modalidades juntas, na ordem do escritório', () => {
    const html = contratoPreenchido(COMPLETO)

    const posicoes = ['3.1.', '3.2.', '3.3.', '3.4.', '3.5.'].map((marco) =>
      html.indexOf(marco),
    )
    expect(posicoes.every((posicao) => posicao >= 0)).toBe(true)
    expect([...posicoes].sort((a, b) => a - b)).toEqual(posicoes)
  })

  it('nada da cláusula 2ª antiga sobra no contrato', () => {
    const html = contratoPreenchido(SO_FIXOS)

    expect(html).not.toContain('Chave Pix')
    expect(html).not.toContain('Caso não haja proveito econômico, não será devido')
    expect(html).not.toContain('Cláusula 1ª')
    expect(html).not.toContain('Cláusula 2ª')
  })

  it('todo rótulo de "falta" de caso leva para editar o caso', () => {
    expect(ROTULOS_DO_CASO.has('descrição do objeto do contrato')).toBe(true)
    expect(ROTULOS_DO_CASO.has('nome da mãe')).toBe(false)
  })
})

describe('parcelas dos honorários fixos', () => {
  it('descreve forma de pagamento e vencimentos de várias parcelas', () => {
    expect(formaDePagamentoDosFixos(PARCELAS)).toBe(
      '3(três) parcelas, sendo a primeira de R$ 500,00 (quinhentos reais), ' +
        'a segunda de R$ 500,00 (quinhentos reais), ' +
        'a terceira de R$ 750,00 (setecentos e cinquenta reais)',
    )
    expect(vencimentosDosFixos(PARCELAS)).toBe(
      'a primeira em 09/10/2026, a segunda em 09/11/2026, a terceira em 09/12/2026',
    )
  })

  it('trata parcela única', () => {
    const unica = [
      { numero: 1, valorEmCentavos: 50000, vencimento: new Date('2026-10-09T12:00:00Z') },
    ]

    expect(formaDePagamentoDosFixos(unica)).toBe('parcela única')
    expect(vencimentosDosFixos(unica)).toBe('em 09/10/2026')
  })

  it('sem parcela não há como escrever o vencimento — recusa em vez de inventar "à vista"', () => {
    expect(formaDePagamentoDosFixos([])).toBeNull()
    expect(vencimentosDosFixos([])).toBeNull()

    const resultado = preencher({ ...SO_FIXOS, parcelas: [] })

    expect(resultado.ok).toBe(false)
    if (resultado.ok) return
    expect(resultado.faltando).toEqual([
      'ao menos uma parcela dos honorários fixos (com o vencimento)',
    ])
  })

  it('ordena pelas parcelas, não pela ordem que chegaram', () => {
    const foraDeOrdem = vencimentosDosFixos([
      { numero: 2, valorEmCentavos: 50000, vencimento: new Date('2026-11-09T12:00:00Z') },
      { numero: 1, valorEmCentavos: 50000, vencimento: new Date('2026-10-09T12:00:00Z') },
    ])

    expect(foraDeOrdem).toBe('a primeira em 09/10/2026, a segunda em 09/11/2026')
  })
})

describe('canal de pagamento dos honorários fixos (22/09/2026)', () => {
  it('sem canal (À vista na tela), o texto não muda', () => {
    expect(formaDePagamentoDosFixos(PARCELAS, null)).toBe(
      formaDePagamentoDosFixos(PARCELAS),
    )
  })

  it('com canal, entra como prefixo antes de "parcela única"/"N parcelas"', () => {
    const unica = [
      { numero: 1, valorEmCentavos: 50000, vencimento: new Date('2026-10-09T12:00:00Z') },
    ]

    expect(formaDePagamentoDosFixos(unica, CanalDePagamentoDosHonorariosFixos.PIX)).toBe(
      'Pix, em parcela única',
    )
    expect(
      formaDePagamentoDosFixos(unica, CanalDePagamentoDosHonorariosFixos.TRANSFERENCIA),
    ).toBe('transferência bancária/TED, em parcela única')
    expect(
      formaDePagamentoDosFixos(unica, CanalDePagamentoDosHonorariosFixos.BOLETO),
    ).toBe('boleto bancário, em parcela única')
  })

  it('sem parcela, continua recusando mesmo com canal escolhido', () => {
    expect(formaDePagamentoDosFixos([], CanalDePagamentoDosHonorariosFixos.PIX)).toBeNull()
  })

  it('o canal aparece no contrato de verdade', () => {
    const html = contratoPreenchido({
      ...SO_FIXOS,
      canalDePagamentoFixo: CanalDePagamentoDosHonorariosFixos.PIX,
    })

    expect(html).toContain('honorários fixos no valor de R$ 1.750,00')
    expect(html).toContain('mediante Pix, em 3(três) parcelas')
  })
})

describe('formatação de dado no documento', () => {
  // A lista do formulário oferece "Casada", "Solteiro"...; no meio da frase do
  // documento ("brasileira, casada, nome da mãe") vai em minúscula.
  it('estado civil vai em minúscula no meio da frase', () => {
    const valores = valoresDoDocumento(
      { ...cliente, estadoCivil: 'Casada' },
      null,
      null,
      emitidoEm,
    )

    expect(valores['cliente.estadoCivil']).toBe('casada')
  })

  it('estado civil de duas palavras também', () => {
    const valores = valoresDoDocumento(
      { ...cliente, estadoCivil: 'Separado judicialmente' },
      null,
      null,
      emitidoEm,
    )

    expect(valores['cliente.estadoCivil']).toBe('separado judicialmente')
  })

  it('estado civil em branco continua faltando, não vira texto vazio', () => {
    const valores = valoresDoDocumento(
      { ...cliente, estadoCivil: '  ' },
      null,
      null,
      emitidoEm,
    )

    expect(valores['cliente.estadoCivil']).toBeNull()
  })
})
