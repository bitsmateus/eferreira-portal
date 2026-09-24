import { describe, expect, it } from 'vitest'
import { SituacaoCaso } from '@prisma/client'

import { lerParcelas, somaDasParcelasConfere, validarCaso } from '@/lib/casos'
import {
  formatarCep,
  formatarNumeroDeProcesso,
  formatarTelefone,
  normalizarNumeroDeProcesso,
} from '@/lib/formatos'

function campos(troca: Partial<Record<string, string>> = {}) {
  return {
    numeroProcesso: '0012845-63.2026.8.26.0100',
    assunto: 'Ação de cobrança',
    vara: '',
    parteContraria: '',
    situacao: SituacaoCaso.EM_ANDAMENTO,
    responsavelId: '',
    empresaVinculadaId: '',
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
    ...troca,
  } as Parameters<typeof validarCaso>[0]
}

describe('objeto e honorários do contrato (21/09/2026)', () => {
  it('tipo e descrição do objeto são opcionais — o contrato é que os exige', () => {
    const resultado = validarCaso(campos())

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    expect(resultado.dados.tipoDeObjeto).toBeNull()
    expect(resultado.dados.descricaoDoObjeto).toBeNull()
  })

  it('aceita cada um dos cinco tipos de objeto e recusa valor fora da lista', () => {
    for (const tipo of [
      'CONSUMIDOR_PLANO_DE_SAUDE',
      'TRABALHISTA',
      'CIVEL',
      'REVISIONAL',
      'PERSONALIZADO',
    ]) {
      const resultado = validarCaso(campos({ tipoDeObjeto: tipo }))
      expect(resultado.ok, tipo).toBe(true)
    }

    const invalido = validarCaso(campos({ tipoDeObjeto: 'PENAL' }))
    expect(invalido.ok).toBe(false)
    if (invalido.ok) return
    expect(invalido.erros['tipoDeObjeto']).toBe('Tipo de objeto inválido.')
  })

  it('guarda a descrição do objeto sem os espaços das pontas', () => {
    const resultado = validarCaso(campos({ descricaoDoObjeto: '  Plano cancelado.  ' }))

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    expect(resultado.dados.descricaoDoObjeto).toBe('Plano cancelado.')
  })

  it('o prazo da economia é um inteiro de 1 a 365 dias', () => {
    expect(validarCaso(campos({ prazoDePagamentoDaEconomia: '30' })).ok).toBe(true)

    for (const ruim of ['0', '366', '2,5', 'trinta']) {
      const resultado = validarCaso(campos({ prazoDePagamentoDaEconomia: ruim }))
      expect(resultado.ok, ruim).toBe(false)
    }
  })

  it('a caixinha de personalizados só liga com "on"', () => {
    const ligada = validarCaso(
      campos({ honorariosPersonalizados: 'on', personalizadoServicos: 'parecer' }),
    )
    expect(ligada.ok).toBe(true)
    if (!ligada.ok) return
    expect(ligada.dados.honorariosPersonalizados).toBe(true)
    expect(ligada.dados.personalizadoServicos).toBe('parecer')

    const desligada = validarCaso(campos())
    expect(desligada.ok).toBe(true)
    if (!desligada.ok) return
    expect(desligada.dados.honorariosPersonalizados).toBe(false)
  })

  // Quem desmarca uma modalidade não quer o texto antigo guardado: religar
  // traria de volta, num contrato, dado de outra conversa.
  it('desmarcar personalizados não deixa os campos guardados', () => {
    const resultado = validarCaso(
      campos({
        personalizadoServicos: 'parecer',
        personalizadoValorOuPercentual: 'R$ 1,00',
        personalizadoNatureza: 'CUMULATIVA',
      }),
    )

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    expect(resultado.dados.personalizadoServicos).toBeNull()
    expect(resultado.dados.personalizadoValorOuPercentual).toBeNull()
    expect(resultado.dados.personalizadoNatureza).toBeNull()
  })

  it('apagar o percentual do proveito econômico apaga referência e prazo', () => {
    const resultado = validarCaso(
      campos({
        percentualProveitoEconomico: '',
        referenciaDaEconomia: 'a dívida X',
        prazoDePagamentoDaEconomia: '30',
      }),
    )

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    expect(resultado.dados.referenciaDaEconomia).toBeNull()
    expect(resultado.dados.prazoDePagamentoDaEconomia).toBeNull()
  })

  it('com o percentual do proveito econômico, referência e prazo ficam', () => {
    const resultado = validarCaso(
      campos({
        percentualProveitoEconomico: '15',
        referenciaDaEconomia: 'a dívida X',
        prazoDePagamentoDaEconomia: '30',
      }),
    )

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    expect(resultado.dados.referenciaDaEconomia).toBe('a dívida X')
    expect(resultado.dados.prazoDePagamentoDaEconomia).toBe(30)
  })

  // Pedido do escritório em 22/09/2026: forma de pagamento dos honorários
  // fixos, selecionável na tela. Em branco ("À vista") não cita canal
  // nenhum no contrato — ver `formaDePagamentoDosFixos`, em modelos.ts.
  it('canal de pagamento é opcional e aceita os três valores', () => {
    const semCanal = validarCaso(campos({ honorarios: '1.750,00' }))
    expect(semCanal.ok).toBe(true)
    if (!semCanal.ok) return
    expect(semCanal.dados.canalDePagamentoFixo).toBeNull()

    for (const canal of ['PIX', 'TRANSFERENCIA', 'BOLETO']) {
      const resultado = validarCaso(
        campos({ honorarios: '1.750,00', canalDePagamentoFixo: canal }),
      )
      expect(resultado.ok, canal).toBe(true)
      if (!resultado.ok) return
      expect(resultado.dados.canalDePagamentoFixo).toBe(canal)
    }
  })

  it('recusa canal de pagamento fora da lista', () => {
    const resultado = validarCaso(
      campos({ honorarios: '1.750,00', canalDePagamentoFixo: 'DINHEIRO' }),
    )
    expect(resultado.ok).toBe(false)
    if (resultado.ok) return
    expect(resultado.erros['canalDePagamentoFixo']).toBe('Canal de pagamento inválido.')
  })

  // Sem honorários fixos não há "mediante [canal]" nenhum no contrato: um
  // canal escolhido antes e depois desmarcado não pode sobrar guardado.
  it('apagar os honorários fixos apaga o canal de pagamento', () => {
    const resultado = validarCaso(
      campos({ honorarios: '', canalDePagamentoFixo: 'PIX' }),
    )

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    expect(resultado.dados.canalDePagamentoFixo).toBeNull()
  })
})

describe('validarCaso', () => {
  it('guarda o número do processo normalizado, só com dígitos', () => {
    const resultado = validarCaso(campos())

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(resultado.dados.numeroProcesso).toBe('00128456320268260100')
  })

  // O índice único do caso é sobre esta coluna: se a máscara entrasse no
  // banco, o mesmo processo entraria duas vezes com grafias diferentes.
  it('reduz a mesma numeração com e sem máscara ao mesmo valor', () => {
    const comMascara = validarCaso(campos())
    const semMascara = validarCaso(campos({ numeroProcesso: '00128456320268260100' }))

    expect(comMascara.ok && semMascara.ok).toBe(true)
    if (!comMascara.ok || !semMascara.ok) return

    expect(comMascara.dados.numeroProcesso).toBe(semMascara.dados.numeroProcesso)
  })

  it('aceita caso sem número — fase pré-processual', () => {
    const resultado = validarCaso(campos({ numeroProcesso: '' }))

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(resultado.dados.numeroProcesso).toBeNull()
  })

  it('mantém numeração que não é CNJ como foi digitada', () => {
    const resultado = validarCaso(campos({ numeroProcesso: ' 2026/000123-PA ' }))

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(resultado.dados.numeroProcesso).toBe('2026/000123-PA')
  })

  it('recusa numeração sem nenhum dígito', () => {
    const resultado = validarCaso(campos({ numeroProcesso: 'a definir' }))

    expect(resultado.ok).toBe(false)
    if (resultado.ok) return

    expect(resultado.erros['numeroProcesso']).toMatch(/dígitos/i)
  })

  it('exige assunto — é a identificação própria do caso', () => {
    const resultado = validarCaso(campos({ assunto: '  ' }))

    expect(resultado.ok).toBe(false)
    if (resultado.ok) return

    expect(resultado.erros['assunto']).toMatch(/assunto/i)
  })

  it('recusa situação que não existe no domínio', () => {
    expect(validarCaso(campos({ situacao: 'GANHO' })).ok).toBe(false)
  })

  it('trata responsável em branco como sem responsável', () => {
    const resultado = validarCaso(campos({ responsavelId: '' }))

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(resultado.dados.responsavelId).toBeNull()
  })
})

describe('formatos', () => {
  it('formata o número do processo no padrão CNJ', () => {
    expect(formatarNumeroDeProcesso('00128456320268260100')).toBe(
      '0012845-63.2026.8.26.0100',
    )
  })

  it('devolve intacta a numeração que não é CNJ', () => {
    expect(formatarNumeroDeProcesso('2026/000123-PA')).toBe('2026/000123-PA')
    expect(normalizarNumeroDeProcesso('  2026/000123-PA  ')).toBe('2026/000123-PA')
  })

  it('formata telefone fixo e celular', () => {
    expect(formatarTelefone('11988124470')).toBe('(11) 98812-4470')
    expect(formatarTelefone('1132551090')).toBe('(11) 3255-1090')
  })

  it('devolve o telefone como veio quando não reconhece o formato', () => {
    expect(formatarTelefone('ramal 22')).toBe('ramal 22')
  })

  it('formata CEP', () => {
    expect(formatarCep('01310100')).toBe('01310-100')
    expect(formatarCep('0131010')).toBe('0131010')
  })
})

describe('validarCaso — situação (correções da revisão)', () => {
  it('trata situação em branco como "em andamento"', () => {
    const resultado = validarCaso(campos({ situacao: '' }))

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(resultado.dados.situacao).toBe(SituacaoCaso.EM_ANDAMENTO)
  })

  // Regra 1: mensagem de erro também é português. O `nativeEnum` do Zod, sem
  // errorMap, devolveria "Invalid enum value..." direto na tela.
  it('recusa situação inexistente com mensagem em português', () => {
    const resultado = validarCaso(campos({ situacao: 'GANHO' }))

    expect(resultado.ok).toBe(false)
    if (resultado.ok) return

    expect(resultado.erros['situacao']).toBe('Situação de caso inválida.')
  })

  it('aceita arquivado', () => {
    const resultado = validarCaso(campos({ situacao: SituacaoCaso.ARQUIVADO }))

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(resultado.dados.situacao).toBe(SituacaoCaso.ARQUIVADO)
  })
})

describe('honorários e parcelas (regra 12: sem controle de pagamento)', () => {
  it('lê o valor em centavos, sem erro de arredondamento', () => {
    const resultado = validarCaso(campos({ honorarios: '1.750,00' }))

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(resultado.dados.honorarios).toBe(175000)
  })

  it('aceita caso sem honorários — preenche depois', () => {
    const resultado = validarCaso(campos({ honorarios: '' }))

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(resultado.dados.honorarios).toBeNull()
  })

  it('recusa valor em formato americano, que daria 100x errado no contrato', () => {
    expect(validarCaso(campos({ honorarios: '1,750.00' })).ok).toBe(false)
  })

  it('recusa honorários zerados ou negativos', () => {
    expect(validarCaso(campos({ honorarios: '0,00' })).ok).toBe(false)
  })

  it('ignora linha de parcela em branco', () => {
    const resultado = lerParcelas([
      { valor: '', vencimento: '' },
      { valor: '500,00', vencimento: '2026-10-09' },
      { valor: '', vencimento: '' },
    ])

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(resultado.dados).toHaveLength(1)
    expect(resultado.dados[0]?.valorEmCentavos).toBe(50000)
  })

  it('cobra o vencimento quando o valor foi informado', () => {
    const resultado = lerParcelas([{ valor: '500,00', vencimento: '' }])

    expect(resultado.ok).toBe(false)
    if (resultado.ok) return

    expect(resultado.erros['parcelas.0.vencimento']).toMatch(/vencimento/i)
  })

  it('cobra o valor quando o vencimento foi informado', () => {
    const resultado = lerParcelas([{ valor: '', vencimento: '2026-10-09' }])

    expect(resultado.ok).toBe(false)
    if (resultado.ok) return

    expect(resultado.erros['parcelas.0.valor']).toMatch(/inválido/i)
  })

  // Contrato assinado dizendo dois valores diferentes para a mesma coisa é
  // problema jurídico, não de interface.
  it('exige que a soma das parcelas bata com o total', () => {
    const parcelas = [
      { valorEmCentavos: 50000, vencimento: new Date('2026-10-09T12:00:00Z') },
      { valorEmCentavos: 50000, vencimento: new Date('2026-11-09T12:00:00Z') },
    ]

    expect(somaDasParcelasConfere(100000, parcelas)).toBe(true)
    expect(somaDasParcelasConfere(175000, parcelas)).toBe(false)
  })

  it('não cobra a soma quando não há parcelas nem total', () => {
    expect(somaDasParcelasConfere(null, [])).toBe(true)
    expect(somaDasParcelasConfere(175000, [])).toBe(true)
  })
})

// Reunião de 17/09/2026: o caso pode combinar fixo, êxito e percentual sobre
// o proveito econômico — cada um opcional e independente dos outros.
describe('percentualExito e percentualProveitoEconomico', () => {
  it('aceita em branco — nenhuma das duas modalidades usada', () => {
    const resultado = validarCaso(campos())

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(resultado.dados.percentualExito).toBeNull()
    expect(resultado.dados.percentualProveitoEconomico).toBeNull()
  })

  it('aceita um número inteiro entre 10 e 30 para cada modalidade', () => {
    const resultado = validarCaso(
      campos({ percentualExito: '20', percentualProveitoEconomico: '15' }),
    )

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(resultado.dados.percentualExito).toBe(20)
    expect(resultado.dados.percentualProveitoEconomico).toBe(15)
  })

  it.each(['percentualExito', 'percentualProveitoEconomico'] as const)(
    'recusa %s fora da faixa de 10 a 30',
    (campo) => {
      expect(validarCaso(campos({ [campo]: '9' })).ok).toBe(false)
      expect(validarCaso(campos({ [campo]: '31' })).ok).toBe(false)
      expect(validarCaso(campos({ [campo]: '0' })).ok).toBe(false)
    },
  )

  it.each(['percentualExito', 'percentualProveitoEconomico'] as const)(
    'recusa %s com casa decimal — o escritório descreveu como número inteiro',
    (campo) => {
      const resultado = validarCaso(campos({ [campo]: '20,5' }))

      expect(resultado.ok).toBe(false)
      if (resultado.ok) return
      expect(resultado.erros[campo]).toMatch(/inteiro/i)
    },
  )

  it('as duas modalidades são independentes uma da outra', () => {
    const resultado = validarCaso(campos({ percentualExito: '20' }))

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(resultado.dados.percentualExito).toBe(20)
    expect(resultado.dados.percentualProveitoEconomico).toBeNull()
  })

  it('pode combinar com honorários fixos no mesmo caso', () => {
    const resultado = validarCaso(
      campos({ honorarios: '1.750,00', percentualExito: '20' }),
    )

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(resultado.dados.honorarios).toBe(175000)
    expect(resultado.dados.percentualExito).toBe(20)
  })
})
