import { describe, expect, it } from 'vitest'
import { TipoPessoa } from '@prisma/client'

import { interpretarBusca, montarLinha, validarCliente } from '@/lib/clientes'

/** Base válida — cada teste troca só o campo que está sendo exercitado. */
function campos(troca: Partial<Record<string, string>> = {}) {
  return {
    documento: '529.982.247-25',
    nome: 'Marcos Vinícius Andrade',
    rg: '',
    dataNascimento: '',
    estadoCivil: '',
    profissao: '',
    nacionalidade: '',
    email: '',
    telefone: '',
    cep: '',
    endereco: '',
    ...troca,
  } as Parameters<typeof validarCliente>[0]
}

describe('validarCliente — CPF e CNPJ', () => {
  it('aceita CPF válido com máscara e guarda só os dígitos', () => {
    const resultado = validarCliente(campos())

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(resultado.dados.documento).toBe('52998224725')
    expect(resultado.dados.tipoPessoa).toBe(TipoPessoa.FISICA)
  })

  it('aceita CNPJ válido e marca pessoa jurídica', () => {
    const resultado = validarCliente(
      campos({ documento: '11.222.333/0001-81', nome: 'Construtora Alvorada Ltda' }),
    )

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(resultado.dados.documento).toBe('11222333000181')
    expect(resultado.dados.tipoPessoa).toBe(TipoPessoa.JURIDICA)
  })

  // Regra 4: dígito verificador, não só máscara. É este teste que impede o
  // cadastro que quebra a busca seis meses depois.
  it('recusa CPF com dígito verificador errado, mesmo com máscara perfeita', () => {
    const resultado = validarCliente(campos({ documento: '529.982.247-24' }))

    expect(resultado.ok).toBe(false)
    if (resultado.ok) return

    expect(resultado.erros['documento']).toMatch(/dígito verificador/i)
  })

  it('recusa CNPJ com dígito verificador errado', () => {
    const resultado = validarCliente(campos({ documento: '11.222.333/0001-80' }))

    expect(resultado.ok).toBe(false)
    if (resultado.ok) return

    expect(resultado.erros['documento']).toMatch(/dígito verificador/i)
  })

  it('recusa sequência repetida, que passa na conta mas não existe', () => {
    const resultado = validarCliente(campos({ documento: '111.111.111-11' }))
    expect(resultado.ok).toBe(false)
  })

  it('recusa documento com quantidade de dígitos que não é 11 nem 14', () => {
    const resultado = validarCliente(campos({ documento: '5299822472' }))

    expect(resultado.ok).toBe(false)
    if (resultado.ok) return

    expect(resultado.erros['documento']).toMatch(/11 dígitos/)
  })

  it('recusa documento em branco', () => {
    const resultado = validarCliente(campos({ documento: '   ' }))
    expect(resultado.ok).toBe(false)
  })

  // O protótipo usa CPFs de exemplo que reprovam no dígito verificador. Este
  // teste existe para que ninguém os leve para o roteiro de aceite.
  it('recusa os CPFs de exemplo do protótipo', () => {
    for (const exemplo of ['205.887.401-72', '744.019.230-66', '918.335.702-14']) {
      expect(validarCliente(campos({ documento: exemplo })).ok).toBe(false)
    }
  })
})

describe('validarCliente — demais campos', () => {
  it('exige nome com pelo menos três letras', () => {
    const resultado = validarCliente(campos({ nome: 'Jo' }))

    expect(resultado.ok).toBe(false)
    if (resultado.ok) return

    expect(resultado.erros['nome']).toMatch(/nome completo/i)
  })

  it('transforma campo opcional em branco em nulo', () => {
    const resultado = validarCliente(campos())

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(resultado.dados.rg).toBeNull()
    expect(resultado.dados.email).toBeNull()
    expect(resultado.dados.telefone).toBeNull()
    expect(resultado.dados.endereco).toBeNull()
  })

  it('normaliza e-mail para minúsculas e recusa e-mail inválido', () => {
    const bom = validarCliente(campos({ email: '  Marcos@Email.COM.BR ' }))
    expect(bom.ok).toBe(true)
    if (bom.ok) expect(bom.dados.email).toBe('marcos@email.com.br')

    const ruim = validarCliente(campos({ email: 'marcos@' }))
    expect(ruim.ok).toBe(false)
    if (!ruim.ok) expect(ruim.erros['email']).toMatch(/e-mail/i)
  })

  it('guarda telefone e CEP só com dígitos', () => {
    const resultado = validarCliente(
      campos({ telefone: '(11) 98812-4470', cep: '01310-100' }),
    )

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(resultado.dados.telefone).toBe('11988124470')
    expect(resultado.dados.cep).toBe('01310100')
  })

  it('aceita data de nascimento e a ancora no dia certo em São Paulo', () => {
    const resultado = validarCliente(campos({ dataNascimento: '1981-03-14' }))

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    const data = resultado.dados.dataNascimento
    expect(data).not.toBeNull()
    expect(
      new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
      }).format(data as Date),
    ).toBe('14/03/1981')
  })

  it('recusa data inexistente e data no futuro', () => {
    expect(validarCliente(campos({ dataNascimento: '2001-02-31' })).ok).toBe(false)
    expect(validarCliente(campos({ dataNascimento: '3000-01-01' })).ok).toBe(false)
  })

  it('junta os erros de campos diferentes em uma resposta só', () => {
    const resultado = validarCliente(
      campos({ documento: '123', nome: 'X', email: 'nao-e-email' }),
    )

    expect(resultado.ok).toBe(false)
    if (resultado.ok) return

    expect(Object.keys(resultado.erros).sort()).toEqual([
      'documento',
      'email',
      'nome',
    ])
  })
})

describe('interpretarBusca', () => {
  it('trata termo vazio como busca vazia', () => {
    expect(interpretarBusca('')).toEqual({ tipo: 'vazia' })
    expect(interpretarBusca('    ')).toEqual({ tipo: 'vazia' })
  })

  it('trata número com pontuação como documento, guardando só os dígitos', () => {
    expect(interpretarBusca('381.204.556-08')).toEqual({
      tipo: 'documento',
      digitos: '38120455608',
    })
    expect(interpretarBusca('18.442.907/0001-55')).toEqual({
      tipo: 'documento',
      digitos: '18442907000155',
    })
  })

  it('trata termo com letra como nome, mesmo tendo números', () => {
    expect(interpretarBusca('Marcos')).toEqual({ tipo: 'nome', texto: 'Marcos' })
    expect(interpretarBusca('Construtora 2')).toEqual({
      tipo: 'nome',
      texto: 'Construtora 2',
    })
  })

  it('trata número curto demais como nome, para não varrer a base inteira', () => {
    expect(interpretarBusca('38')).toEqual({ tipo: 'nome', texto: '38' })
  })
})

describe('montarLinha', () => {
  const base = {
    id: 'cliente-1',
    nome: 'Marcos Vinícius Andrade',
    documento: '52998224725',
    tipoPessoa: TipoPessoa.FISICA,
    email: 'marcos@email.com.br',
    contratoAssinadoEm: new Date('2026-02-12T12:00:00Z'),
    criadoEm: new Date('2026-02-12T12:00:00Z'),
    _count: { casos: 2 },
    casos: [
      { andamentos: [{ data: new Date('2026-08-14T12:00:00Z') }] },
      { andamentos: [{ data: new Date('2026-08-31T12:00:00Z') }] },
    ],
  }

  it('pega o andamento mais recente entre todos os casos do cliente', () => {
    const linha = montarLinha(base)

    expect(linha.ultimoAndamentoEm?.toISOString()).toBe('2026-08-31T12:00:00.000Z')
    expect(linha.quantidadeDeCasos).toBe(2)
    expect(linha.acessoLiberado).toBe(true)
    expect(linha.temEmail).toBe(true)
  })

  it('devolve nulo quando nenhum caso tem andamento', () => {
    const linha = montarLinha({
      ...base,
      casos: [{ andamentos: [] }, { andamentos: [] }],
    })

    expect(linha.ultimoAndamentoEm).toBeNull()
  })

  it('marca sem e-mail e sem acesso quando é o caso', () => {
    const linha = montarLinha({ ...base, email: null, contratoAssinadoEm: null })

    expect(linha.temEmail).toBe(false)
    expect(linha.acessoLiberado).toBe(false)
  })

  it('trata e-mail em branco como ausência de e-mail', () => {
    expect(montarLinha({ ...base, email: '' }).temEmail).toBe(false)
  })
})
