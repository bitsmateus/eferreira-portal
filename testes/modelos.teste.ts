import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  NaturezaDoHonorarioPersonalizado,
  TipoDeObjeto,
  TipoPessoa,
} from '@prisma/client'

import {
  MODELOS,
  aplicarPartes,
  arquivoDoObjeto,
  arquivosDosHonorarios,
  marcadoresDoModelo,
  preencherModelo,
  valoresDoDocumento,
  type CasoParaDocumento,
  type ClienteParaDocumento,
} from '@/lib/modelos'

function lerArquivo(nome: string): string {
  return readFileSync(join(process.cwd(), 'src', 'modelos', `${nome}.html`), 'utf8')
}

/**
 * Monta o modelo como `geracao.ts` monta: o arquivo principal mais as partes
 * que mudam com o tipo de pessoa. Se os dois caminhos divergirem, o teste
 * deixa de valer — por isso a lógica é a mesma, e não uma cópia simplificada.
 */
function lerModelo(
  nome: string,
  tipoPessoa: TipoPessoa = TipoPessoa.FISICA,
  casoDoContrato: CasoParaDocumento = caso,
): string {
  const modelo = lerArquivo(nome)

  if (nome === MODELOS.CONTRATO) {
    const arquivo = arquivoDoObjeto(casoDoContrato.tipoDeObjeto)
    return aplicarPartes(modelo, {
      objeto: arquivo === null ? '' : lerArquivo(arquivo),
      honorarios: arquivosDosHonorarios(casoDoContrato)
        .map((parte) => lerArquivo(parte))
        .join('\n'),
    })
  }

  if (nome !== MODELOS.PROCURACAO) return modelo

  const sufixo = tipoPessoa === TipoPessoa.FISICA ? 'pf' : 'pj'
  return aplicarPartes(modelo, {
    outorgante: lerArquivo(`procuracao-outorgante-${sufixo}`),
    assinatura: lerArquivo(`procuracao-assinatura-${sufixo}`),
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
}

const SEM_MODALIDADES: CasoParaDocumento = {
  parcelas: [],
  honorariosEmCentavos: null,
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
    expect(resultado.html).toContain('Beltrana de Tal')
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
  it('recusa gerar quando falta o nome da mãe, e diz o que falta', () => {
    const resultado = preencherModelo(
      lerModelo(MODELOS.PROCURACAO),
      valoresDoDocumento({ ...cliente, nomeMae: null }, null, null, emitidoEm),
    )

    expect(resultado.ok).toBe(false)
    if (resultado.ok) return

    expect(resultado.faltando).toContain('nome da mãe')
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
        { ...cliente, nomeMae: null, rg: null, nacionalidade: null },
        null,
        null,
        emitidoEm,
      ),
    )

    expect(resultado.ok).toBe(false)
    if (resultado.ok) return

    expect(resultado.faltando.sort()).toEqual(['RG', 'nacionalidade', 'nome da mãe'])
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
          lerModelo(MODELOS.CONTRATO, TipoPessoa.FISICA, {
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
      [
        'procuracao (jurídica)',
        lerModelo(MODELOS.PROCURACAO, TipoPessoa.JURIDICA),
      ] as const,
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
    for (const tipoPessoa of [TipoPessoa.FISICA, TipoPessoa.JURIDICA]) {
      expect(lerModelo(MODELOS.PROCURACAO, tipoPessoa)).not.toContain('{{>')
    }

    for (const tipo of Object.values(TipoDeObjeto)) {
      const contrato = lerModelo(MODELOS.CONTRATO, TipoPessoa.FISICA, {
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

