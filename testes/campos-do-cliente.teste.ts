/**
 * O asterisco da tela e a recusa do servidor têm de dizer a mesma coisa.
 *
 * Marcar um campo como obrigatório na tela e não exigi-lo no servidor é chato;
 * o contrário é pior — o operador preenche tudo o que está marcado, salva, e o
 * sistema recusa apontando um campo que não tinha aviso nenhum. Estes testes
 * cruzam as duas pontas: `ehObrigatorio`, que a tela usa, contra
 * `validarCliente`, que é quem de fato bloqueia a gravação.
 */

import { describe, expect, it } from 'vitest'
import { TipoPessoa } from '@prisma/client'

import { ehObrigatorio, obrigatoriosPara } from '@/lib/campos-do-cliente'
import { validarCliente, type CamposDeCliente } from '@/lib/clientes'

/** CPF e CNPJ sintéticos, válidos no dígito verificador. */
const CPF = '52998224725'
const CNPJ = '11222333000181'

const COMPLETO: CamposDeCliente = {
  documento: CPF,
  nome: 'Joana Ribeiro da Silva',
  rg: '12.345.678-9',
  dataNascimento: '',
  estadoCivil: 'solteira',
  profissao: 'professora',
  nacionalidade: 'brasileira',
  nomeMae: 'Maria Ribeiro',
  email: 'joana@exemplo.com.br',
  telefone: '(11) 90000-0000',
  cep: '01310-100',
  endereco: 'Av. Paulista, 1000',
  cidade: 'São Paulo',
  uf: 'SP',
}

/** Os campos do formulário, na ordem em que a tela os mostra. */
const CAMPOS_DA_TELA = [
  'documento',
  'nome',
  'rg',
  'dataNascimento',
  'estadoCivil',
  'profissao',
  'nacionalidade',
  'nomeMae',
  'email',
  'telefone',
  'cep',
  'endereco',
  'cidade',
  'uf',
] as const

describe('o asterisco da tela bate com a recusa do servidor', () => {
  for (const tipoPessoa of [TipoPessoa.FISICA, TipoPessoa.JURIDICA]) {
    const documento = tipoPessoa === TipoPessoa.FISICA ? CPF : CNPJ
    const rotulo = tipoPessoa === TipoPessoa.FISICA ? 'pessoa física' : 'pessoa jurídica'

    for (const campo of CAMPOS_DA_TELA) {
      it(`${rotulo}: "${campo}" ${ehObrigatorio(campo, tipoPessoa) ? 'marcado' : 'não marcado'} na tela, e o servidor concorda`, () => {
        const marcadoNaTela = ehObrigatorio(campo, tipoPessoa)

        // Tira só este campo de um cadastro que, cheio, é aceito.
        const semEsteCampo: CamposDeCliente = { ...COMPLETO, documento, [campo]: '' }
        const conferido = validarCliente(semEsteCampo)

        const servidorRecusou = !conferido.ok && conferido.erros[campo] !== undefined

        expect(servidorRecusou).toBe(marcadoNaTela)
      })
    }
  }
})

describe('a lista muda com o tipo de pessoa', () => {
  // A qualificação pessoal é do sócio, não da empresa. Exigi-la do CNPJ
  // impediria cadastrar qualquer pessoa jurídica.
  it('empresa não precisa de RG, estado civil, profissão nem nacionalidade', () => {
    for (const campo of ['rg', 'estadoCivil', 'profissao', 'nacionalidade']) {
      expect(ehObrigatorio(campo, TipoPessoa.JURIDICA)).toBe(false)
      expect(ehObrigatorio(campo, TipoPessoa.FISICA)).toBe(true)
    }
  })

  // O escritório tirou da lista em 17/09/2026: fica no cadastro, mas nunca
  // bloqueia a gravação — nem da pessoa física, nem do representante legal.
  it('nome da mãe não é obrigatório para ninguém', () => {
    expect(ehObrigatorio('nomeMae', TipoPessoa.FISICA)).toBe(false)
    expect(ehObrigatorio('nomeMae', TipoPessoa.JURIDICA)).toBe(false)
  })

  it('o endereço vale para os dois', () => {
    for (const campo of ['cep', 'endereco', 'cidade', 'uf']) {
      expect(ehObrigatorio(campo, TipoPessoa.FISICA)).toBe(true)
      expect(ehObrigatorio(campo, TipoPessoa.JURIDICA)).toBe(true)
    }
  })

  // Cabeçalho da procuração (24/09/2026): o da empresa não traz e-mail nem
  // telefone dela — os que saem no documento são os do representante legal.
  it('e-mail e telefone são da pessoa física; a empresa não precisa', () => {
    for (const campo of ['email', 'telefone']) {
      expect(ehObrigatorio(campo, TipoPessoa.FISICA)).toBe(true)
      expect(ehObrigatorio(campo, TipoPessoa.JURIDICA)).toBe(false)
    }
  })

  // Documento e nome não estão na lista do escritório porque o próprio
  // esquema já os exige — sem eles não há cadastro nenhum. Que eles NÃO
  // pertencem a `obrigatoriosPara` já é garantido pelo tipo: comparar um
  // `CampoObrigatorio` com 'documento' não compila.
  it('documento e nome são obrigatórios sempre, sem estar na lista', () => {
    for (const tipoPessoa of [TipoPessoa.FISICA, TipoPessoa.JURIDICA]) {
      expect(ehObrigatorio('documento', tipoPessoa)).toBe(true)
      expect(ehObrigatorio('nome', tipoPessoa)).toBe(true)
      expect(obrigatoriosPara(tipoPessoa).length).toBeGreaterThan(0)
    }
  })

  // O escritório tirou da lista em 14/09/2026 e nenhum modelo a usa.
  it('data de nascimento não é obrigatória para ninguém', () => {
    expect(ehObrigatorio('dataNascimento', TipoPessoa.FISICA)).toBe(false)
    expect(ehObrigatorio('dataNascimento', TipoPessoa.JURIDICA)).toBe(false)
  })
})

describe('o cadastro completo passa', () => {
  it('pessoa física', () => {
    expect(validarCliente(COMPLETO).ok).toBe(true)
  })

  it('pessoa jurídica, mesmo sem a qualificação pessoal', () => {
    const empresa: CamposDeCliente = {
      ...COMPLETO,
      documento: CNPJ,
      nome: 'Padaria Aurora Ltda',
      rg: '',
      estadoCivil: '',
      profissao: '',
      nacionalidade: '',
      nomeMae: '',
    }

    expect(validarCliente(empresa).ok).toBe(true)
  })
})
