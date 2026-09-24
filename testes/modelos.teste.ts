import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { advogadoPorId } from '@/lib/escritorio'
import {
  NaturezaDoHonorarioPersonalizado,
  TipoDeObjeto,
  TipoDocumento,
  TipoPessoa,
} from '@prisma/client'

import {
  MODELOS,
  marcadoresDoModelo,
  montarModeloComArquivos,
  preencherModelo,
  valoresDoDocumento,
  type CasoParaDocumento,
  type VarianteDoDocumento,
  type ClienteParaDocumento,
} from '@/lib/modelos'

function lerArquivo(nome: string): string {
  return readFileSync(join(process.cwd(), 'src', 'modelos', `${nome}.html`), 'utf8')
}

const TIPO_DO_MODELO: Record<string, TipoDocumento> = {
  [MODELOS.PROCURACAO]: TipoDocumento.PROCURACAO,
  [MODELOS.DECLARACAO]: TipoDocumento.DECLARACAO,
  [MODELOS.CONTRATO]: TipoDocumento.CONTRATO,
}

/**
 * Monta o modelo com a MESMA função que a geração usa
 * (`montarModeloComArquivos`) — não há cópia simplificada que possa divergir.
 */
function lerModelo(
  nome: string,
  variante: VarianteDoDocumento = 'pf',
  casoDoContrato: CasoParaDocumento = caso,
): string {
  return montarModeloComArquivos(
    lerArquivo,
    TIPO_DO_MODELO[nome] ?? TipoDocumento.ANEXO,
    variante,
    casoDoContrato,
  )
}

const cliente: ClienteParaDocumento = {
  nome: 'Fulano de Tal da Silva',
  tipoPessoa: TipoPessoa.FISICA,
  documento: '52998224725',
  nacionalidade: 'brasileiro',
  estadoCivil: 'casado',
  profissao: 'engenheiro',
  nomeMae: 'Beltrana de Tal',
  rg: '12.345.678 SSP-SP',
  email: 'fulano@exemplo.com.br',
  telefone: '11987654321',
  endereco: 'Rua das Flores, 100, Centro',
  cidade: 'Mogi das Cruzes',
  uf: 'SP',
  cep: '08780040',
}

/** Uma empresa e o sócio que assina por ela, para a variante de pessoa jurídica. */
const empresa: ClienteParaDocumento = {
  ...cliente,
  nome: 'Exemplo Consultoria Ltda',
  tipoPessoa: TipoPessoa.JURIDICA,
  documento: '11222333000181',
  // A empresa não tem nome da mãe nem estado civil — quem tem é o sócio.
  nomeMae: null,
  estadoCivil: null,
  nacionalidade: null,
  rg: null,
}

const socio = {
  nome: 'Sicrano de Tal',
  documento: '39053344705',
  nacionalidade: 'brasileiro',
  rg: '22.588.089-1 SSP-SP',
  qualificacao: 'sócio',
  estadoCivil: 'Casado',
  profissao: 'empresário',
  email: 'sicrano@exemplo.com.br',
  telefone: '11912345678',
  endereco: 'Rua dos Sócios, 50',
  cidade: 'São Paulo',
  uf: 'SP',
  cep: '01310100',
}

const SEM_MODALIDADES: CasoParaDocumento = {
  parcelas: [],
  honorariosEmCentavos: null,
  canalDePagamentoFixo: null,
  percentualExito: null,
  percentualProveitoEconomico: null,
  referenciaDaEconomia: null,
  prazoDePagamentoDaEconomia: null,
  tipoDeObjeto: TipoDeObjeto.CIVEL,
  descricaoDoObjeto: 'Ação de cobrança contra Construtora Exemplo Ltda, processo 0000000-00.2026.8.26.0000.',
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

/** Só honorários fixos, em três parcelas — o caso comum. */
const caso: CasoParaDocumento = {
  ...SEM_MODALIDADES,
  honorariosEmCentavos: 175000,
  parcelas: [
    { numero: 1, valorEmCentavos: 50000, vencimento: new Date('2026-10-09T12:00:00Z') },
    { numero: 2, valorEmCentavos: 50000, vencimento: new Date('2026-11-09T12:00:00Z') },
    { numero: 3, valorEmCentavos: 75000, vencimento: new Date('2026-12-09T12:00:00Z') },
  ],
}

/** As quatro modalidades juntas, tudo preenchido. */
const casoCompleto: CasoParaDocumento = {
  ...caso,
  percentualExito: 20,
  percentualProveitoEconomico: 15,
  referenciaDaEconomia: 'a dívida de R$ 80.000,00 cobrada pelo Banco Exemplo, na data-base de 01/09/2026',
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

const emitidoEm = new Date('2026-09-14T12:00:00Z')

describe('preencherModelo', () => {
  it('preenche a procuração inteira, sem sobrar marcador', () => {
    const resultado = preencherModelo(
      lerModelo(MODELOS.PROCURACAO),
      valoresDoDocumento(cliente, null, null, emitidoEm),
    )

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(resultado.html).not.toMatch(/\{\{/)
    expect(resultado.html).toContain('Fulano de Tal da Silva')
    expect(resultado.html).toContain('engenheiro')
    expect(resultado.html).toContain('(11) 98765-4321')
    expect(resultado.html).toContain('fulano@exemplo.com.br')
    expect(resultado.html).toContain('529.982.247-25')
    expect(resultado.html).toContain('08780-040')
    expect(resultado.html).toContain('14 de setembro de 2026')
  })

  it('preenche a declaração inteira', () => {
    const resultado = preencherModelo(
      lerModelo(MODELOS.DECLARACAO),
      valoresDoDocumento(cliente, null, null, emitidoEm),
    )

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    expect(resultado.html).not.toMatch(/\{\{/)
  })

  it('preenche o contrato inteiro, com honorários e parcelas', () => {
    const resultado = preencherModelo(
      lerModelo(MODELOS.CONTRATO),
      valoresDoDocumento(cliente, null, caso, emitidoEm),
    )

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(resultado.html).not.toMatch(/\{\{/)
    expect(resultado.html).toContain('R$ 1.750,00')
    expect(resultado.html).toContain('mil setecentos e cinquenta reais')
    expect(resultado.html).toContain('Ação de cobrança contra Construtora Exemplo Ltda')
    expect(resultado.html).toContain('mediante 3(três) parcelas')
  })

  // O ponto do exercício: documento incompleto NÃO é gerado em branco.
  it('recusa gerar quando falta a profissão, e diz o que falta', () => {
    const resultado = preencherModelo(
      lerModelo(MODELOS.PROCURACAO),
      valoresDoDocumento({ ...cliente, profissao: null }, null, null, emitidoEm),
    )

    expect(resultado.ok).toBe(false)
    if (resultado.ok) return

    expect(resultado.faltando).toContain('profissão')
  })

  it('o nome da mãe não é mais pedido por nenhum documento (modelos de 24/09/2026)', () => {
    for (const modelo of Object.values(MODELOS)) {
      const resultado = preencherModelo(
        lerModelo(modelo),
        valoresDoDocumento({ ...cliente, nomeMae: null }, null, caso, emitidoEm),
      )
      expect(resultado.ok, modelo).toBe(true)
    }
  })

  it('trata campo só de espaços como ausente', () => {
    const resultado = preencherModelo(
      lerModelo(MODELOS.PROCURACAO),
      valoresDoDocumento({ ...cliente, rg: '   ' }, null, null, emitidoEm),
    )

    expect(resultado.ok).toBe(false)
    if (resultado.ok) return
    expect(resultado.faltando).toContain('RG')
  })

  it('lista tudo que falta de uma vez, sem repetir', () => {
    const resultado = preencherModelo(
      lerModelo(MODELOS.PROCURACAO),
      valoresDoDocumento(
        { ...cliente, rg: null, nacionalidade: null },
        null,
        null,
        emitidoEm,
      ),
    )

    expect(resultado.ok).toBe(false)
    if (resultado.ok) return

    expect(resultado.faltando.sort()).toEqual(['RG', 'nacionalidade'])
  })

  // O nome vem de quem digitou no formulário e vai para dentro de HTML.
  it('escapa HTML vindo do cadastro', () => {
    const resultado = preencherModelo(
      lerModelo(MODELOS.DECLARACAO),
      valoresDoDocumento(
        { ...cliente, nome: 'Fulano <script>alert(1)</script>' },
        null,
        null,
        emitidoEm,
      ),
    )

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(resultado.html).not.toContain('<script>')
    expect(resultado.html).toContain('&lt;script&gt;')
  })
})

describe('os modelos e o dicionário estão em dia', () => {
  // Marcador novo no HTML sem valor correspondente quebraria a geração só na
  // hora do uso. Este teste falha antes.
  it('todo marcador dos modelos tem valor, nas duas variantes', () => {
    const valores = valoresDoDocumento(empresa, socio, casoCompleto, emitidoEm)

    // O contrato é conferido com as quatro modalidades juntas e com cada uma
    // das cinco variações de objeto: marcador sem valor em qualquer delas só
    // apareceria na hora de gerar aquele contrato.
    const contratos = Object.values(TipoDeObjeto).map(
      (tipo) =>
        [
          `contrato (objeto ${tipo})`,
          lerModelo(MODELOS.CONTRATO, 'pf', {
            ...casoCompleto,
            tipoDeObjeto: tipo,
          }),
        ] as const,
    )

    const montados = [
      ...Object.values(MODELOS)
        .filter((modelo) => modelo !== MODELOS.CONTRATO)
        .map((modelo) => [modelo, lerModelo(modelo)] as const),
      ...contratos,
      ...(['pj', 'assistida'] as const).flatMap((variante) => [
        [`procuracao (${variante})`, lerModelo(MODELOS.PROCURACAO, variante)] as const,
        [`contrato (${variante})`, lerModelo(MODELOS.CONTRATO, variante, casoCompleto)] as const,
      ]),
      ['declaracao (assistida)', lerModelo(MODELOS.DECLARACAO, 'assistida')] as const,
    ]

    for (const [nome, modelo] of montados) {
      for (const marcador of marcadoresDoModelo(modelo)) {
        expect(
          Object.prototype.hasOwnProperty.call(valores, marcador),
          `${nome}: marcador {{${marcador}}} não tem valor`,
        ).toBe(true)
      }
    }
  })

  // Parte não encaixada sairia impressa no documento assinado.
  it('nenhum modelo montado deixa parte por encaixar', () => {
    for (const variante of ['pf', 'pj', 'assistida'] as const) {
      expect(lerModelo(MODELOS.PROCURACAO, variante)).not.toContain('{{>')
      expect(lerModelo(MODELOS.CONTRATO, variante)).not.toContain('{{>')
      // Não há declaração de hipossuficiência para empresa.
      if (variante !== 'pj') {
        expect(lerModelo(MODELOS.DECLARACAO, variante)).not.toContain('{{>')
      }
    }

    for (const tipo of Object.values(TipoDeObjeto)) {
      const contrato = lerModelo(MODELOS.CONTRATO, 'pf', {
        ...casoCompleto,
        tipoDeObjeto: tipo,
      })
      expect(contrato, `contrato ${tipo}`).not.toContain('{{>')
    }
  })

  it('nenhum modelo carrega dado do exemplo que o escritório mandou', () => {
    const proibidos = [
      'JESSICA',
      'ARGEU',
      'TOGNASCA',
      'DORTA',
      '361.431.528-29',
      '310.719.348-80',
      'Cândida',
      'Solange',
      'argeuft',
    ]

    for (const modelo of Object.values(MODELOS)) {
      const conteudo = lerModelo(modelo)
      for (const proibido of proibidos) {
        expect(conteudo, `${modelo} contém "${proibido}"`).not.toContain(proibido)
      }
    }
  })
})


describe('outorgado da procuração (24/09/2026)', () => {
  function procuracaoCom(id: string | null): string {
    const advogado = advogadoPorId(id)
    if (advogado === undefined) throw new Error('advogado inexistente')
    const resultado = preencherModelo(
      lerModelo(MODELOS.PROCURACAO),
      valoresDoDocumento(cliente, null, null, emitidoEm, advogado),
    )
    if (!resultado.ok) throw new Error(`faltou: ${resultado.faltando.join(', ')}`)
    return resultado.html.replace(/\s+/g, ' ')
  }

  it('sem escolha, sai o advogado de sempre, com o texto masculino de sempre', () => {
    const html = procuracaoCom(null)
    expect(html).toContain('Dr. Sergio Evangelista Ferreira')
    expect(html).toContain('brasileiro, solteiro, advogado, inscrito na OAB/SP sob o nº 378.532')
    expect(html).toContain('e-mail: contato@eferreira.adv.br, telefone: (11) 4580-3696.')
    expect(html).toContain('constitui o OUTORGADO seu bastante procurador e advogado, conferindo-lhe')
    expect(html).toContain('O OUTORGADO poderá')
  })

  it('outra advogada troca dados e concordância; o endereço do escritório é o mesmo', () => {
    const html = procuracaoCom('cristina')
    expect(html).toContain('Dra. Cristina Moura Santos Lopes')
    expect(html).toContain('brasileira, divorciada, advogada, inscrita na OAB/SP sob o nº 453.976')
    expect(html).toContain('Rua Olegário Paiva, nº 180, 4º andar, Sala 411, Centro')
    // O contato citado é o do ESCRITÓRIO, para qualquer advogado.
    expect(html).toContain('e-mail: contato@eferreira.adv.br, telefone: (11) 4580-3696.')
    expect(html).not.toContain('cristina.msl.adv@gmail.com')
    expect(html).toContain('constitui a OUTORGADA sua bastante procuradora e advogada, conferindo-lhe')
    expect(html).toContain('A OUTORGADA poderá')
    expect(html).not.toContain('Sergio')
  })

  it('id desconhecido não vira advogado nenhum', () => {
    expect(advogadoPorId('fulano')).toBeUndefined()
  })
})

describe('variantes representada/assistida e pessoa jurídica (24/09/2026)', () => {
  const menor: ClienteParaDocumento = {
    ...cliente,
    nome: 'Miguel Barreto da Silva',
    documento: '54384339844',
    rg: '69.945.690-3',
  }
  const mae = {
    nome: 'Cíntia Cristina da Silva Soares',
    documento: '36568755885',
    nacionalidade: 'brasileira',
    rg: '45.311.733-8 SSP/SP',
    qualificacao: null,
    estadoCivil: 'Casada',
    profissao: 'auxiliar de embalagem',
    email: 'mae@exemplo.com.br',
    telefone: '11955554444',
    endereco: 'Avenida Major Mello, nº 280, Vila Nova Aparecida',
    cidade: 'Mogi das Cruzes',
    uf: 'SP',
    cep: '05425070',
  }

  function texto(nome: string, variante: VarianteDoDocumento, quem: ClienteParaDocumento, rep: typeof mae | typeof socio | null): string {
    const resultado = preencherModelo(
      lerModelo(nome, variante),
      valoresDoDocumento(quem, rep, caso, emitidoEm),
    )
    if (!resultado.ok) throw new Error(`faltou: ${resultado.faltando.join(', ')}`)
    return resultado.html.replace(/\s+/g, ' ')
  }

  it('procuração assistida: o outorgante só com nome, RG e CPF; o assistente completo', () => {
    const html = texto(MODELOS.PROCURACAO, 'assistida', menor, mae)
    expect(html).toContain('Miguel Barreto da Silva</span>, brasileiro, portador(a) do RG nº 69.945.690-3')
    expect(html).toContain('inscrito(a) no CPF sob o nº 543.843.398-44, neste ato assistido(a) por:')
    expect(html).toContain('Cíntia Cristina da Silva Soares</span>, brasileira, casada, auxiliar de embalagem')
    expect(html).toContain('e-mail: mae@exemplo.com.br, telefone: (11) 95555-4444')
    expect(html).toContain('residente e domiciliado(a) Avenida Major Mello')
    expect(html).toContain('CEP: 05425-070')
    // O menor não entra com profissão, estado civil nem endereço.
    expect(html).not.toContain('engenheiro')
    expect(html).not.toContain('Rua das Flores')
  })

  it('assinatura assistida: nome e CPF de quem outorga, "Representada por" o assistente', () => {
    const html = texto(MODELOS.PROCURACAO, 'assistida', menor, mae)
    const assinatura = html.slice(html.indexOf('class="assinatura"'))
    expect(assinatura).toContain('Miguel Barreto da Silva')
    expect(assinatura).toContain('CPF nº 543.843.398-44')
    expect(assinatura).toContain('Representada por: Cíntia Cristina da Silva Soares')
  })

  it('declaração assistida usa o mesmo desenho', () => {
    const html = texto(MODELOS.DECLARACAO, 'assistida', menor, mae)
    expect(html).toContain('Eu, <span class="maiusculas">Miguel Barreto da Silva</span>')
    expect(html).toContain('neste ato assistido(a) por:')
    expect(html).toContain('declaro, sob as penas da lei')
    expect(html).toContain('arts. 98 e 99 do Código de Processo Civil')
  })

  it('procuração de pessoa jurídica: empresa e representante legal lado a lado', () => {
    const html = texto(MODELOS.PROCURACAO, 'pj', empresa, socio)
    expect(html).toContain('pessoa jurídica de direito privado, inscrita no CNPJ sob o nº 11.222.333/0001-81')
    expect(html).toContain('neste ato representada por seu representante legal')
    expect(html).toContain('Sicrano de Tal</span>, brasileiro, casado')
    expect(html).toContain('conforme atos constitutivos da sociedade')
    const assinatura = html.slice(html.indexOf('class="assinatura"'))
    expect(assinatura).toContain('CNPJ nº 11.222.333/0001-81')
    expect(assinatura).toContain('Representada por: Sicrano de Tal')
  })

  it('o contrato traz o contratante da variante e a assinatura do escritório', () => {
    const pj = texto(MODELOS.CONTRATO, 'pj', empresa, socio)
    expect(pj).toContain('neste ato representada por seu representante legal')
    expect(pj).toContain('doravante denominada CONTRATANTE')

    const pf = texto(MODELOS.CONTRATO, 'pf', cliente, null)
    expect(pf).toContain('doravante denominado(a) CONTRATANTE')
    expect(pf).toContain('inscrita no CNPJ sob o nº 67.706.981/0001-68')
    expect(pf).toContain('foro da Comarca de Mogi das Cruzes/SP')
    expect(pf).toContain('Representada por Sérgio E. Ferreira')
  })
})
