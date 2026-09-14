import { describe, expect, it } from 'vitest'

import {
  DIGITOS_DO_CODIGO,
  MINUTOS_DE_VALIDADE,
  SEGUNDOS_ENTRE_PEDIDOS,
  TENTATIVAS_POR_CODIGO,
} from '@/lib/acesso'
import {
  gerarCodigo,
  validarConferencia,
  validarPedido,
} from '@/lib/acesso-do-cliente'
import { mensagemDeCodigo } from '@/lib/mensagens'

/**
 * A parte da entrada do cliente que dá para provar sem banco. O isolamento em
 * si — o critério de pronto da Sprint 4 — é provado contra o Postgres de
 * verdade em `testes-de-banco/isolamento-do-cliente.teste.ts`.
 */

describe('gerarCodigo', () => {
  it('tem sempre seis dígitos, inclusive quando sorteia número pequeno', () => {
    for (let i = 0; i < 500; i += 1) {
      const codigo = gerarCodigo()
      expect(codigo).toHaveLength(DIGITOS_DO_CODIGO)
      expect(codigo).toMatch(/^[0-9]{6}$/)
    }
  })

  it('não repete o mesmo valor a cada chamada', () => {
    const sorteados = new Set(Array.from({ length: 200 }, () => gerarCodigo()))
    // 200 sorteios em um milhão de possibilidades: repetir tudo seria um
    // gerador quebrado, não azar.
    expect(sorteados.size).toBeGreaterThan(150)
  })
})

describe('validarPedido', () => {
  it('aceita CPF válido, com ou sem máscara, e devolve só os dígitos', () => {
    for (const escrito of ['529.982.247-25', '52998224725', ' 529982247-25 ']) {
      const resultado = validarPedido({ documento: escrito })
      expect(resultado.ok).toBe(true)
      if (!resultado.ok) continue
      expect(resultado.dados.documento).toBe('52998224725')
    }
  })

  it('aceita CNPJ válido', () => {
    const resultado = validarPedido({ documento: '11.222.333/0001-81' })
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    expect(resultado.dados.documento).toBe('11222333000181')
  })

  // Regra 4: dígito verificador, não só máscara. Aqui isso também evita ir ao
  // banco para qualquer sequência que alguém digite.
  it('recusa documento que reprova no dígito verificador', () => {
    const resultado = validarPedido({ documento: '381.204.556-08' })
    expect(resultado.ok).toBe(false)
    if (resultado.ok) return
    expect(resultado.erros['documento']).toMatch(/inválido/i)
  })

  it('recusa campo vazio com mensagem própria', () => {
    const resultado = validarPedido({ documento: '   ' })
    expect(resultado.ok).toBe(false)
    if (resultado.ok) return
    expect(resultado.erros['documento']).toMatch(/informe/i)
  })
})

describe('validarConferencia', () => {
  it('aceita o código com seis dígitos e limpa o que não é número', () => {
    const resultado = validarConferencia({
      documento: '529.982.247-25',
      codigo: '49 27-31',
    })

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    expect(resultado.dados.codigo).toBe('492731')
  })

  it('recusa código curto ou longo', () => {
    for (const codigo of ['1234', '1234567']) {
      const resultado = validarConferencia({ documento: '52998224725', codigo })
      expect(resultado.ok).toBe(false)
    }
  })

  it('recusa documento inválido mesmo com código bem formado', () => {
    const resultado = validarConferencia({
      documento: '111.111.111-11',
      codigo: '123456',
    })
    expect(resultado.ok).toBe(false)
  })
})

describe('mensagemDeCodigo', () => {
  const mensagem = mensagemDeCodigo(
    'cliente@exemplo.invalido',
    'Cliente de Teste',
    '492731',
    MINUTOS_DE_VALIDADE,
  )

  it('leva o código e a validade, no assunto e no corpo', () => {
    expect(mensagem.assunto).toContain('492731')
    expect(mensagem.texto).toContain('492731')
    expect(mensagem.html).toContain('492731')
    expect(mensagem.texto).toContain(`${MINUTOS_DE_VALIDADE} minutos`)
  })

  /**
   * Caixa de e-mail é lugar que outras pessoas leem. O aviso de código não
   * pode carregar número de processo, assunto nem parte contrária.
   */
  it('não fala do processo', () => {
    const corpo = `${mensagem.assunto} ${mensagem.texto} ${mensagem.html}`
    for (const proibido of ['processo', 'vara', 'ação', 'parte contrária']) {
      expect(corpo.toLowerCase()).not.toContain(proibido)
    }
  })

  it('escapa o que vem do cadastro, para o HTML não virar marcação', () => {
    const comMarcacao = mensagemDeCodigo(
      'x@exemplo.invalido',
      '<script>alert(1)</script>',
      '000001',
      MINUTOS_DE_VALIDADE,
    )
    expect(comMarcacao.html).not.toContain('<script>')
    expect(comMarcacao.html).toContain('&lt;script&gt;')
  })
})

describe('os números da entrada do cliente', () => {
  it('seguem o protótipo e a régua do painel', () => {
    // "O código vale por 10 minutos" — protótipo, tela "Cliente — entrar".
    expect(MINUTOS_DE_VALIDADE).toBe(10)
    // Mesma régua do bloqueio do operador: cinco tentativas.
    expect(TENTATIVAS_POR_CODIGO).toBe(5)
    // "Reenviar em 0:38" no protótipo — a espera é de um minuto.
    expect(SEGUNDOS_ENTRE_PEDIDOS).toBe(60)
  })
})
