import { describe, expect, it } from 'vitest'

import {
  DIGITOS_DO_CODIGO,
  MINUTOS_DE_VALIDADE,
  SEGUNDOS_ENTRE_PEDIDOS,
  TENTATIVAS_POR_CODIGO,
} from '@/lib/redefinicao'
import {
  gerarCodigo,
  validarPedido,
  validarRedefinicao,
} from '@/lib/redefinicao-de-senha'
import { mensagemDeRedefinicaoDeSenha } from '@/lib/mensagens'

/**
 * A parte da recuperação de senha que dá para provar sem banco. A
 * elegibilidade, os limites e a troca de verdade são provados contra o
 * Postgres em `testes-de-banco/redefinicao-de-senha.teste.ts`.
 */

describe('gerarCodigo', () => {
  it('tem sempre seis dígitos, inclusive quando sorteia número pequeno', () => {
    for (let i = 0; i < 500; i += 1) {
      const codigo = gerarCodigo()
      expect(codigo).toHaveLength(DIGITOS_DO_CODIGO)
      expect(codigo).toMatch(/^[0-9]{6}$/)
    }
  })
})

describe('validarPedido', () => {
  it('aceita e-mail válido e normaliza para minúsculas', () => {
    const resultado = validarPedido({ email: 'Operador@ExemploInvalido.com.br' })
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    expect(resultado.dados.email).toBe('operador@exemploinvalido.com.br')
  })

  it('recusa e-mail mal formado', () => {
    const resultado = validarPedido({ email: 'não-é-email' })
    expect(resultado.ok).toBe(false)
    if (resultado.ok) return
    expect(resultado.erros['email']).toMatch(/inválido/i)
  })

  it('recusa campo vazio com mensagem própria', () => {
    const resultado = validarPedido({ email: '   ' })
    expect(resultado.ok).toBe(false)
    if (resultado.ok) return
    expect(resultado.erros['email']).toMatch(/informe/i)
  })
})

describe('validarRedefinicao', () => {
  const base = {
    email: 'operador@exemploinvalido.com.br',
    codigo: '49 27-31',
    senha: 'umaSenhaForte123',
    confirmacao: 'umaSenhaForte123',
  }

  it('aceita dados válidos e limpa o código do que não é número', () => {
    const resultado = validarRedefinicao(base)
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    expect(resultado.dados.codigo).toBe('492731')
  })

  it('recusa código curto ou longo', () => {
    for (const codigo of ['1234', '1234567']) {
      const resultado = validarRedefinicao({ ...base, codigo })
      expect(resultado.ok).toBe(false)
    }
  })

  it('recusa senha curta', () => {
    const resultado = validarRedefinicao({ ...base, senha: '123', confirmacao: '123' })
    expect(resultado.ok).toBe(false)
    if (resultado.ok) return
    expect(resultado.erros['senha']).toMatch(/8 caracteres/i)
  })

  it('recusa quando a confirmação não bate com a senha', () => {
    const resultado = validarRedefinicao({
      ...base,
      senha: 'umaSenhaForte123',
      confirmacao: 'outraSenhaQualquer',
    })
    expect(resultado.ok).toBe(false)
    if (resultado.ok) return
    expect(resultado.erros['confirmacao']).toMatch(/iguais/i)
  })
})

describe('mensagemDeRedefinicaoDeSenha', () => {
  const mensagem = mensagemDeRedefinicaoDeSenha(
    'operador@exemplo.invalido',
    'Operador de Teste',
    '492731',
    MINUTOS_DE_VALIDADE,
  )

  it('leva o código e a validade, no assunto e no corpo', () => {
    expect(mensagem.assunto).toContain('492731')
    expect(mensagem.texto).toContain('492731')
    expect(mensagem.html).toContain('492731')
    expect(mensagem.texto).toContain(`${MINUTOS_DE_VALIDADE} minutos`)
  })

  it('escapa o que vem do cadastro, para o HTML não virar marcação', () => {
    const comMarcacao = mensagemDeRedefinicaoDeSenha(
      'x@exemplo.invalido',
      '<script>alert(1)</script>',
      '000001',
      MINUTOS_DE_VALIDADE,
    )
    expect(comMarcacao.html).not.toContain('<script>')
    expect(comMarcacao.html).toContain('&lt;script&gt;')
  })
})

describe('os números da recuperação de senha', () => {
  it('seguem a mesma régua do código do cliente e do bloqueio de login', () => {
    expect(MINUTOS_DE_VALIDADE).toBe(10)
    expect(TENTATIVAS_POR_CODIGO).toBe(5)
    expect(SEGUNDOS_ENTRE_PEDIDOS).toBe(60)
  })
})
