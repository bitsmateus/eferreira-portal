import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { TipoPessoa } from '@prisma/client'

import {
  MODELOS,
  aplicarPartes,
  condicoesDePagamento,
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
): string {
  const modelo = lerArquivo(nome)
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

const caso: CasoParaDocumento = {
  assunto: 'Ação de cobrança',
  parteContraria: 'Construtora Exemplo Ltda',
  honorariosEmCentavos: 175000,
  parcelas: [
    { numero: 1, valorEmCentavos: 50000, vencimento: new Date('2026-10-09T12:00:00Z') },
    { numero: 2, valorEmCentavos: 50000, vencimento: new Date('2026-11-09T12:00:00Z') },
    { numero: 3, valorEmCentavos: 75000, vencimento: new Date('2026-12-09T12:00:00Z') },
  ],
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
    expect(resultado.html).toContain('contra Construtora Exemplo Ltda')
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
    const valores = valoresDoDocumento(empresa, socio, caso, emitidoEm)

    const montados = [
      ...Object.values(MODELOS).map((modelo) => [modelo, lerModelo(modelo)] as const),
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

describe('condicoesDePagamento', () => {
  it('escreve a cláusula como no modelo do escritório', () => {
    expect(condicoesDePagamento(caso)).toBe(
      '3(três) parcelas com a primeira de R$ 500,00 (quinhentos reais) para o dia 09/10/2026, ' +
        'a segunda de R$ 500,00 (quinhentos reais) para o dia 09/11/2026, ' +
        'a terceira de R$ 750,00 (setecentos e cinquenta reais) para o dia 09/12/2026.',
    )
  })

  it('trata parcela única', () => {
    expect(
      condicoesDePagamento({
        honorariosEmCentavos: 50000,
        parcelas: [
          {
            numero: 1,
            valorEmCentavos: 50000,
            vencimento: new Date('2026-10-09T12:00:00Z'),
          },
        ],
      }),
    ).toBe('parcela única de R$ 500,00 (quinhentos reais) para o dia 09/10/2026.')
  })

  it('sem parcela cadastrada, diz à vista', () => {
    expect(
      condicoesDePagamento({ honorariosEmCentavos: 50000, parcelas: [] }),
    ).toBe('à vista.')
  })

  it('ordena pelas parcelas, não pela ordem que chegaram', () => {
    const foraDeOrdem = condicoesDePagamento({
      honorariosEmCentavos: 100000,
      parcelas: [
        { numero: 2, valorEmCentavos: 50000, vencimento: new Date('2026-11-09T12:00:00Z') },
        { numero: 1, valorEmCentavos: 50000, vencimento: new Date('2026-10-09T12:00:00Z') },
      ],
    })

    expect(foraDeOrdem).toContain('a primeira de R$ 500,00 (quinhentos reais) para o dia 09/10/2026')
  })
})

describe('caso sem parte contrária', () => {
  it('fecha a frase do objeto sem deixar "contra" solto', () => {
    const resultado = preencherModelo(
      lerModelo(MODELOS.CONTRATO),
      valoresDoDocumento(cliente, null, { ...caso, parteContraria: null }, emitidoEm),
    )

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(resultado.html).not.toMatch(/contra\s*,/)
    expect(resultado.html).not.toContain('contra </span>')
  })
})
