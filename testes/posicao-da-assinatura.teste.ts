/**
 * Onde cada um assina (24/09/2026): a leitura das marcas no PDF e a conta dos
 * pins. A parte que ainda falta conferir — o que a D4Sign faz com esses
 * números — está dita em `src/lib/posicao-da-assinatura.ts`.
 */

import { describe, expect, it } from 'vitest'
import { TipoDocumento } from '@prisma/client'

import { pinsDoEnvio, type ParteQueAssina } from '@/lib/assinaturas'
import {
  ajusteDoAmbiente,
  lerPaginasDoPdf,
  pinsDosAvulsos,
  pinsPelasMarcas,
  posicaoPadrao,
  posicionamentoLigado,
} from '@/lib/posicao-da-assinatura'
import { pdfMinimo } from './ajudas/pdf-minimo'

const SEM_AJUSTE = { xMm: 0, yMm: 0 }
const PONTO_EM_MM = 25.4 / 72

describe('lerPaginasDoPdf', () => {
  it('acha a marca, com o y medido do topo, em milímetros', async () => {
    // A4: 841.89pt de altura. Texto a 200pt do pé = 641.89pt do topo.
    const pdf = pdfMinimo([[{ texto: '[[assina:parte]]', x: 250, y: 200 }]])
    const paginas = await lerPaginasDoPdf(pdf)

    expect(paginas).toHaveLength(1)
    expect(paginas[0]?.larguraMm).toBeCloseTo(210, 0)
    expect(paginas[0]?.alturaMm).toBeCloseTo(297, 0)

    const marca = paginas[0]?.marcas[0]
    expect(marca?.chave).toBe('parte')
    expect(marca?.yMm).toBeCloseTo((841.89 - 200) * PONTO_EM_MM, 0)
    // Centro do texto: começa em x=250pt e tem alguma largura.
    expect(marca?.xMm ?? 0).toBeGreaterThan(250 * PONTO_EM_MM)
  })

  it('devolve página sem marca quando o documento não tem nenhuma', async () => {
    const paginas = await lerPaginasDoPdf(pdfMinimo([[{ texto: 'texto qualquer', x: 50, y: 50 }]]))
    expect(paginas[0]?.marcas).toEqual([])
  })

  it('lê a página certa em documento de várias páginas', async () => {
    const paginas = await lerPaginasDoPdf(
      pdfMinimo([
        [{ texto: 'nada aqui', x: 50, y: 50 }],
        [
          { texto: '[[assina:parte]]', x: 250, y: 400 },
          { texto: '[[assina:escritorio]]', x: 250, y: 200 },
        ],
      ]),
    )

    expect(paginas).toHaveLength(2)
    expect(paginas[0]?.marcas).toEqual([])
    expect(paginas[1]?.marcas.map((m) => m.chave).sort()).toEqual(['escritorio', 'parte'])
  })
})

describe('pinsPelasMarcas', () => {
  it('usa a última marca de cada chave e o tamanho da página em mm', async () => {
    const paginas = await lerPaginasDoPdf(
      pdfMinimo([
        [{ texto: '[[assina:parte]]', x: 100, y: 700 }],
        [{ texto: '[[assina:parte]]', x: 250, y: 400 }],
      ]),
    )
    const pins = pinsPelasMarcas(paginas, [{ email: 'a@exemplo.invalido', chave: 'parte' }], SEM_AJUSTE)

    expect(pins).toHaveLength(1)
    expect(pins[0]).toMatchObject({
      email: 'a@exemplo.invalido',
      page: '2',
      page_width: '210',
      type: '0',
    })
  })

  it('aplica o ajuste e não sai da página', () => {
    const pagina = { numero: 1, larguraMm: 210, alturaMm: 297, marcas: [{ chave: 'parte', xMm: 10, yMm: 5 }] }
    const [pin] = pinsPelasMarcas([pagina], [{ email: 'a@exemplo.invalido', chave: 'parte' }], {
      xMm: -20,
      yMm: -14,
    })
    // Negativo vira 0: o carimbo nunca sai da folha.
    expect(pin?.position_x).toBe('0')
    expect(pin?.position_y).toBe('0')
  })

  it('quem não tem marca no PDF fica sem pin (a D4Sign escolhe, como sempre)', () => {
    const pagina = { numero: 1, larguraMm: 210, alturaMm: 297, marcas: [] }
    expect(
      pinsPelasMarcas([pagina], [{ email: 'a@exemplo.invalido', chave: 'parte' }], SEM_AJUSTE),
    ).toEqual([])
  })
})

describe('pinsDosAvulsos', () => {
  const paginas = [
    { numero: 1, larguraMm: 210, alturaMm: 297, marcas: [] },
    { numero: 2, larguraMm: 210, alturaMm: 297, marcas: [] },
  ]

  it('sem escolha: última página, um ao lado do outro', () => {
    const pins = pinsDosAvulsos(
      paginas,
      [{ email: 'a@exemplo.invalido' }, { email: 'b@exemplo.invalido' }],
      SEM_AJUSTE,
    )

    expect(pins.map((p) => p.page)).toEqual(['2', '2'])
    expect(pins[0]?.position_x).not.toBe(pins[1]?.position_x)
    expect(posicaoPadrao(0).alturaEmPercentual).toBe(85)
  })

  it('respeita a página, o lado e a altura escolhidos', () => {
    const [pin] = pinsDosAvulsos(
      paginas,
      [{ email: 'a@exemplo.invalido', posicao: { pagina: 1, lado: 'direita', alturaEmPercentual: 50 } }],
      SEM_AJUSTE,
    )
    expect(pin).toMatchObject({ page: '1', position_x: '153.3', position_y: '148.5' })
  })

  it('página que não existe cai na última', () => {
    const [pin] = pinsDosAvulsos(
      paginas,
      [{ email: 'a@exemplo.invalido', posicao: { pagina: 9, lado: 'centro', alturaEmPercentual: 80 } }],
      SEM_AJUSTE,
    )
    expect(pin?.page).toBe('2')
  })
})

describe('pinsDoEnvio', () => {
  const paginas = [
    {
      numero: 1,
      larguraMm: 210,
      alturaMm: 297,
      marcas: [
        { chave: 'parte', xMm: 105, yMm: 150 },
        { chave: 'escritorio', xMm: 105, yMm: 200 },
      ],
    },
  ]
  const partes: ParteQueAssina[] = [
    { papel: 'cliente', nome: 'Cliente', email: 'cliente@exemplo.invalido' },
    { papel: 'escritorio', nome: 'Escritório', email: 'escritorio@exemplo.invalido' },
    { papel: 'TESTEMUNHA', nome: 'Testemunha', email: 'testemunha@exemplo.invalido' },
  ]

  it('contrato: cliente e escritório pela marca; testemunha sem pin', () => {
    const pins = pinsDoEnvio(TipoDocumento.CONTRATO, partes, [], paginas, SEM_AJUSTE)
    expect(pins.map((p) => p.email)).toEqual(['cliente@exemplo.invalido', 'escritorio@exemplo.invalido'])
    expect(pins[1]?.position_y).toBe('200')
  })

  it('representante (empresa) assina no lugar da parte', () => {
    const pins = pinsDoEnvio(
      TipoDocumento.PROCURACAO,
      [{ papel: 'representante', nome: 'Sócio', email: 'socio@exemplo.invalido' }],
      [],
      paginas,
      SEM_AJUSTE,
    )
    expect(pins).toHaveLength(1)
    expect(pins[0]?.position_y).toBe('150')
  })

  it('anexo: usa a posição que o operador escolheu para cada e-mail', () => {
    const pins = pinsDoEnvio(
      TipoDocumento.ANEXO,
      [{ papel: 'TESTEMUNHA', nome: 'T', email: 'testemunha@exemplo.invalido' }],
      [
        {
          nome: 'T',
          email: 'testemunha@exemplo.invalido',
          papel: 'TESTEMUNHA',
          posicao: { pagina: 1, lado: 'esquerda', alturaEmPercentual: 10 },
        },
      ],
      paginas,
      SEM_AJUSTE,
    )
    expect(pins[0]).toMatchObject({ page: '1', position_y: '29.7' })
  })
})

describe('ambiente', () => {
  it('o posicionamento é desligado por padrão', () => {
    expect(posicionamentoLigado({})).toBe(false)
    expect(posicionamentoLigado({ D4SIGN_POSICIONAR_ASSINATURA: '1' })).toBe(true)
    expect(posicionamentoLigado({ D4SIGN_POSICIONAR_ASSINATURA: 'sim' })).toBe(false)
  })

  it('os ajustes têm padrão e aceitam vírgula decimal', () => {
    expect(ajusteDoAmbiente({})).toEqual({ xMm: -20, yMm: -14 })
    expect(
      ajusteDoAmbiente({ D4SIGN_PIN_AJUSTE_X_MM: '-5,5', D4SIGN_PIN_AJUSTE_Y_MM: 'lixo' }),
    ).toEqual({ xMm: -5.5, yMm: -14 })
  })
})
