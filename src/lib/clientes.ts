/**
 * Clientes — Anexo I, itens 1.e e 2.1.
 *
 * O CPF ou CNPJ é a chave de identificação em todo o sistema. Aqui ficam a
 * validação do cadastro, a busca e o "reconhecimento" do passo 2: ao digitar
 * um documento já cadastrado, o sistema traz o cliente existente com os casos
 * dele em vez de abrir um registro duplicado.
 *
 * Regra 2: nenhuma consulta usa `findUnique` por id vindo da URL. Tudo passa
 * por `filtroDeClientes`, montado a partir da sessão do servidor.
 */

import { AcaoAuditoria, type Prisma, TipoPessoa } from '@prisma/client'
import { z } from 'zod'

import { exigirEquipe, filtroDeClientes, type SessaoServidor } from '@/lib/autorizacao'
import { ehViolacaoDeUnicidade, prisma } from '@/lib/prisma'
import { registrarAuditoria } from '@/lib/auditoria'
import { prepararDocumento } from '@/lib/documento'
import { diaCivilParaData, diaEmSaoPaulo } from '@/lib/datas'
import {
  normalizarCep,
  normalizarParaBusca,
  normalizarTelefone,
  somenteDigitos,
  ufValida,
} from '@/lib/formatos'
import { errosPorCampo, type ResultadoDeFormulario } from '@/lib/formulario'
import { obrigatoriosPara } from '@/lib/campos-do-cliente'

// ---------------------------------------------------------------------------
// Validação do cadastro
// ---------------------------------------------------------------------------

// A lista de obrigatórios vive em `campos-do-cliente.ts`, que o formulário
// também importa para marcar o asterisco. Uma lista só: a tela e o servidor
// não podem discordar sobre o que é obrigatório.
export { obrigatoriosPara } from '@/lib/campos-do-cliente'

const unidadeFederativa = z
  .string()
  .trim()
  .toUpperCase()
  .transform((valor, contexto) => {
    if (valor === '') return null

    if (!ufValida(valor)) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'UF inválida. Use a sigla de dois caracteres, como SP.',
      })
      return z.NEVER
    }

    return valor
  })

/** Texto que, em branco, vira nulo — quase todo campo de qualificação é opcional. */
const opcional = z
  .string()
  .trim()
  .max(180, 'Texto longo demais para este campo.')
  .transform((valor) => (valor === '' ? null : valor))

const documentoDoCliente = z
  .string()
  .trim()
  .transform((valor, contexto) => {
    const preparado = prepararDocumento(valor)
    if (!preparado.ok) {
      contexto.addIssue({ code: z.ZodIssueCode.custom, message: preparado.motivo })
      return z.NEVER
    }
    return preparado
  })

const dataDeNascimento = z
  .string()
  .trim()
  .transform((valor, contexto) => {
    if (valor === '') return null

    const data = diaCivilParaData(valor)
    if (data === null) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Data de nascimento inválida.',
      })
      return z.NEVER
    }

    // Comparar com `Date.now()` rejeitaria a data de hoje entre 00:00 e 09:00
    // em Brasília, porque o dia civil é ancorado ao meio-dia UTC. A comparação
    // certa é entre dias civis em São Paulo, não entre instantes.
    if (valor > diaEmSaoPaulo(new Date())) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A data não pode estar no futuro.',
      })
      return z.NEVER
    }

    return data
  })

const emailDoCliente = z
  .string()
  .trim()
  .toLowerCase()
  .transform((valor, contexto) => {
    if (valor === '') return null

    const conferido = z.string().email().safeParse(valor)
    if (!conferido.success) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'E-mail inválido. Sem e-mail válido o cliente nunca recebe o código de acesso.',
      })
      return z.NEVER
    }

    return conferido.data
  })

export const esquemaDeCliente = z
  .object({
    documento: documentoDoCliente,
    nome: z
      .string()
      .trim()
      .min(3, 'Informe o nome completo do cliente.')
      .max(180, 'Nome longo demais.'),
    rg: opcional,
    dataNascimento: dataDeNascimento,
    estadoCivil: opcional,
    profissao: opcional,
    nacionalidade: opcional,
    nomeMae: opcional,
    email: emailDoCliente,
    telefone: opcional.transform((valor) =>
      valor === null ? null : normalizarTelefone(valor),
    ),
    cep: opcional.transform((valor) => (valor === null ? null : normalizarCep(valor))),
    endereco: z
      .string()
      .trim()
      .max(240, 'Endereço longo demais.')
      .transform((valor) => (valor === '' ? null : valor)),
    cidade: z
      .string()
      .trim()
      .max(120, 'Nome de cidade longo demais.')
      .transform((valor) => (valor === '' ? null : valor)),
    uf: unidadeFederativa,
  })
  .transform((campos) => ({
    ...campos,
    documento: campos.documento.documento,
    // Regra 2: o tipo de pessoa sai do próprio documento, não do que o
    // navegador escolheu no seletor. CPF é pessoa física, CNPJ é jurídica.
    tipoPessoa:
      campos.documento.tipo === 'CPF' ? TipoPessoa.FISICA : TipoPessoa.JURIDICA,
  }))
  .superRefine((dados, contexto) => {
    for (const [campo, rotulo] of obrigatoriosPara(dados.tipoPessoa)) {
      if (dados[campo] === null) {
        contexto.addIssue({
          code: z.ZodIssueCode.custom,
          path: [campo],
          message: `${rotulo} é obrigatório.`,
        })
      }
    }
  })

export type DadosDeCliente = z.output<typeof esquemaDeCliente>

/** Entrada crua do formulário, antes de qualquer confiança. */
export type CamposDeCliente = Record<keyof z.input<typeof esquemaDeCliente>, string>

export function validarCliente(
  campos: CamposDeCliente,
): ResultadoDeFormulario<DadosDeCliente> {
  const conferido = esquemaDeCliente.safeParse(campos)
  if (!conferido.success) {
    return { ok: false, erros: errosPorCampo(conferido.error) }
  }
  return { ok: true, dados: conferido.data }
}

// ---------------------------------------------------------------------------
// Busca — Anexo I, 2.1: por nome, CPF ou CNPJ
// ---------------------------------------------------------------------------

export type Busca =
  | { tipo: 'vazia' }
  | { tipo: 'documento'; digitos: string }
  | { tipo: 'nome'; texto: string }

/**
 * Decide se o termo digitado é documento ou nome.
 *
 * Um termo só de dígitos (com ou sem ponto, barra e traço) é procurado como
 * CPF/CNPJ; qualquer letra o torna busca por nome. É pura de propósito: a
 * regra de interpretação da busca tem teste próprio.
 */
export function interpretarBusca(termo: string): Busca {
  const limpo = termo.trim()
  if (limpo === '') return { tipo: 'vazia' }

  const temLetra = /\p{L}/u.test(limpo)
  const digitos = somenteDigitos(limpo)

  if (!temLetra && digitos.length >= 3) {
    return { tipo: 'documento', digitos }
  }

  return { tipo: 'nome', texto: limpo }
}

function condicaoDaBusca(busca: Busca): Prisma.ClienteWhereInput | undefined {
  if (busca.tipo === 'vazia') return undefined
  if (busca.tipo === 'documento') return { documento: { contains: busca.digitos } }
  // Compara com a coluna já normalizada: "Vinicius" acha "Vinícius".
  return { nomeBusca: { contains: normalizarParaBusca(busca.texto) } }
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

/**
 * Colunas da lista de clientes do protótipo: nome, CPF/CNPJ, casos, último
 * andamento e situação do acesso.
 *
 * O último andamento vem aninhado sob o cliente — que já saiu do filtro de
 * autorização —, então o isolamento se mantém por construção.
 */
const RESUMO = {
  id: true,
  nome: true,
  documento: true,
  tipoPessoa: true,
  email: true,
  contratoAssinadoEm: true,
  criadoEm: true,
  _count: { select: { casos: true } },
  casos: {
    select: {
      andamentos: {
        select: { data: true },
        orderBy: { data: 'desc' as const },
        take: 1,
      },
    },
  },
} satisfies Prisma.ClienteSelect

type ClienteResumido = Prisma.ClienteGetPayload<{ select: typeof RESUMO }>

export type LinhaDeCliente = {
  id: string
  nome: string
  documento: string
  tipoPessoa: TipoPessoa
  quantidadeDeCasos: number
  ultimoAndamentoEm: Date | null
  temEmail: boolean
  acessoLiberado: boolean
}

/** Achata o resumo do banco na linha que a tabela desenha. */
export function montarLinha(cliente: ClienteResumido): LinhaDeCliente {
  let ultimo: Date | null = null
  for (const caso of cliente.casos) {
    const andamento = caso.andamentos[0]
    if (andamento !== undefined && (ultimo === null || andamento.data > ultimo)) {
      ultimo = andamento.data
    }
  }

  return {
    id: cliente.id,
    nome: cliente.nome,
    documento: cliente.documento,
    tipoPessoa: cliente.tipoPessoa,
    quantidadeDeCasos: cliente._count.casos,
    ultimoAndamentoEm: ultimo,
    temEmail: cliente.email !== null && cliente.email !== '',
    acessoLiberado: cliente.contratoAssinadoEm !== null,
  }
}

/** Teto de linhas por página. Existe para a tela não puxar a base inteira. */
export const LIMITE_DA_LISTA = 200

export type ListaDeClientes = {
  linhas: LinhaDeCliente[]
  /** Verdadeiro quando havia mais do que cabe: a tela precisa dizer isso. */
  truncada: boolean
}

export async function listarClientes(
  sessao: SessaoServidor,
  termo: string,
): Promise<ListaDeClientes> {
  const busca = interpretarBusca(termo)

  // Pede um a mais que o teto: se vier, é porque havia mais do que coube.
  const clientes = await prisma.cliente.findMany({
    where: filtroDeClientes(sessao, condicaoDaBusca(busca)),
    select: RESUMO,
    orderBy: { nome: 'asc' },
    take: LIMITE_DA_LISTA + 1,
  })

  const truncada = clientes.length > LIMITE_DA_LISTA

  return {
    linhas: clientes.slice(0, LIMITE_DA_LISTA).map(montarLinha),
    truncada,
  }
}

export async function contarClientes(sessao: SessaoServidor): Promise<number> {
  return prisma.cliente.count({ where: filtroDeClientes(sessao) })
}

/** A ficha do cliente. Devolve null quando a sessão não pode vê-lo. */
export async function obterCliente(sessao: SessaoServidor, id: string) {
  return prisma.cliente.findFirst({
    where: filtroDeClientes(sessao, { id }),
    include: {
      casos: {
        orderBy: { criadoEm: 'desc' },
        include: {
          responsavel: { select: { nome: true } },
          andamentos: {
            select: { data: true },
            orderBy: { data: 'desc' },
            take: 1,
          },
        },
      },
      // O sócio que assina pela empresa, e — quando este cliente é pessoa
      // física — as empresas pelas quais ele assina.
      representantes: {
        orderBy: { criadoEm: 'asc' },
        include: {
          pessoaFisica: {
            select: { id: true, nome: true, documento: true, nomeMae: true, rg: true },
          },
        },
      },
      empresasQueRepresenta: {
        orderBy: { criadoEm: 'asc' },
        include: {
          pessoaJuridica: { select: { id: true, nome: true, documento: true } },
        },
      },
    },
  })
}

export type ClienteDaFicha = NonNullable<Awaited<ReturnType<typeof obterCliente>>>

/**
 * O reconhecimento do passo 2: dado um CPF ou CNPJ, devolve o cliente que já
 * existe — ou null. É o que evita o cadastro duplicado.
 */
export async function reconhecerPorDocumento(
  sessao: SessaoServidor,
  valor: string,
): Promise<{ id: string; nome: string; quantidadeDeCasos: number } | null> {
  const preparado = prepararDocumento(valor)
  if (!preparado.ok) return null

  const cliente = await prisma.cliente.findFirst({
    where: filtroDeClientes(sessao, { documento: preparado.documento }),
    select: { id: true, nome: true, _count: { select: { casos: true } } },
  })

  if (cliente === null) return null

  return {
    id: cliente.id,
    nome: cliente.nome,
    quantidadeDeCasos: cliente._count.casos,
  }
}

// ---------------------------------------------------------------------------
// Escrita — sempre com auditoria (regra 6)
// ---------------------------------------------------------------------------

export type ResultadoDeCadastro =
  | { situacao: 'criado'; clienteId: string }
  /** Documento já cadastrado: em vez de duplicar, devolvemos quem já existe. */
  | { situacao: 'ja_existe'; clienteId: string; nome: string }

export async function criarCliente(
  sessao: SessaoServidor,
  dados: DadosDeCliente,
  emailDoAutor: string | null,
): Promise<ResultadoDeCadastro> {
  exigirEquipe(sessao)

  const existente = await prisma.cliente.findUnique({
    where: { documento: dados.documento },
    select: { id: true, nome: true },
  })

  if (existente !== null) {
    return { situacao: 'ja_existe', clienteId: existente.id, nome: existente.nome }
  }

  let clienteId: string
  try {
    clienteId = await prisma.$transaction(async (transacao) => {
      const criado = await transacao.cliente.create({
        data: {
          ...dados,
          nomeBusca: normalizarParaBusca(dados.nome),
          criadoPorId: sessao.usuarioId,
        },
        select: { id: true },
      })

      await registrarAuditoria(
        {
          usuarioId: sessao.usuarioId,
          usuarioEmail: emailDoAutor,
          acao: AcaoAuditoria.CRIACAO,
          entidade: 'cliente',
          entidadeId: criado.id,
          detalhes: { documento: dados.documento, nome: dados.nome },
        },
        transacao,
      )

      return criado.id
    })
  } catch (erro) {
    // A checagem acima resolve o caso comum, mas entre ela e o `create` cabe
    // outro cadastro do mesmo documento. Quem decide de verdade é o índice
    // único do banco; aqui só traduzimos a violação para a mesma resposta.
    if (ehViolacaoDeUnicidade(erro)) {
      const existente = await prisma.cliente.findUnique({
        where: { documento: dados.documento },
        select: { id: true, nome: true },
      })
      if (existente !== null) {
        return { situacao: 'ja_existe', clienteId: existente.id, nome: existente.nome }
      }
    }
    throw erro
  }

  return { situacao: 'criado', clienteId }
}

export type ResultadoDeAtualizacao =
  | { situacao: 'atualizado' }
  | { situacao: 'nao_encontrado' }
  /** O novo documento já pertence a outro cliente. */
  | { situacao: 'documento_de_outro'; nome: string }

export async function atualizarCliente(
  sessao: SessaoServidor,
  id: string,
  dados: DadosDeCliente,
  emailDoAutor: string | null,
): Promise<ResultadoDeAtualizacao> {
  exigirEquipe(sessao)

  // Regra 2: confirma que ESTA sessão enxerga ESTE cliente antes de escrever.
  const alvo = await prisma.cliente.findFirst({
    where: filtroDeClientes(sessao, { id }),
    select: { id: true },
  })
  if (alvo === null) return { situacao: 'nao_encontrado' }

  const conflito = await prisma.cliente.findFirst({
    where: { documento: dados.documento, id: { not: id } },
    select: { nome: true },
  })
  if (conflito !== null) {
    return { situacao: 'documento_de_outro', nome: conflito.nome }
  }

  try {
    await prisma.$transaction(async (transacao) => {
      await transacao.cliente.update({
        where: { id },
        data: { ...dados, nomeBusca: normalizarParaBusca(dados.nome) },
      })

      await registrarAuditoria(
        {
          usuarioId: sessao.usuarioId,
          usuarioEmail: emailDoAutor,
          acao: AcaoAuditoria.ATUALIZACAO,
          entidade: 'cliente',
          entidadeId: id,
          detalhes: { documento: dados.documento, nome: dados.nome },
        },
        transacao,
      )
    })
  } catch (erro) {
    if (ehViolacaoDeUnicidade(erro)) {
      const conflitante = await prisma.cliente.findUnique({
        where: { documento: dados.documento },
        select: { nome: true },
      })
      return {
        situacao: 'documento_de_outro',
        nome: conflitante?.nome ?? 'outro cliente',
      }
    }
    throw erro
  }

  return { situacao: 'atualizado' }
}

// ---------------------------------------------------------------------------
// Representante legal — o "sócio" (Anexo II, 3.5, respondido em 14/09/2026)
//
// "Seria o mesmo cadastro da PF mas está ligado ao cadastro do PJ." Por isso
// não existe função para criar um representante: cria-se um cliente pessoa
// física normal e vincula-se. Assim a mesma pessoa representa várias empresas
// sem cadastro duplicado, que é a regra 4 aplicada a este caso.
// ---------------------------------------------------------------------------

export type ResultadoDeVinculo =
  | { situacao: 'vinculado' }
  | { situacao: 'empresa_nao_encontrada' }
  | { situacao: 'pessoa_nao_encontrada' }
  /** O documento informado é de outra empresa, não de uma pessoa física. */
  | { situacao: 'nao_e_pessoa_fisica' }
  | { situacao: 'ja_vinculado'; nome: string }

export async function vincularRepresentante(
  sessao: SessaoServidor,
  pessoaJuridicaId: string,
  documentoDaPessoaFisica: string,
  qualificacao: string | null,
  emailDoAutor: string | null,
): Promise<ResultadoDeVinculo> {
  exigirEquipe(sessao)

  const preparado = prepararDocumento(documentoDaPessoaFisica)
  if (!preparado.ok || preparado.tipo !== 'CPF') {
    return { situacao: 'nao_e_pessoa_fisica' }
  }

  // Regra 2: as duas pontas do vínculo passam pelo filtro da sessão.
  const empresa = await prisma.cliente.findFirst({
    where: filtroDeClientes(sessao, {
      id: pessoaJuridicaId,
      tipoPessoa: TipoPessoa.JURIDICA,
    }),
    select: { id: true },
  })
  if (empresa === null) return { situacao: 'empresa_nao_encontrada' }

  const pessoa = await prisma.cliente.findFirst({
    where: filtroDeClientes(sessao, {
      documento: preparado.documento,
      tipoPessoa: TipoPessoa.FISICA,
    }),
    select: { id: true, nome: true },
  })
  if (pessoa === null) return { situacao: 'pessoa_nao_encontrada' }

  const jaExiste = await prisma.representanteLegal.findUnique({
    where: {
      pessoaJuridicaId_pessoaFisicaId: {
        pessoaJuridicaId: empresa.id,
        pessoaFisicaId: pessoa.id,
      },
    },
    select: { id: true },
  })
  if (jaExiste !== null) return { situacao: 'ja_vinculado', nome: pessoa.nome }

  await prisma.$transaction(async (transacao) => {
    await transacao.representanteLegal.create({
      data: {
        pessoaJuridicaId: empresa.id,
        pessoaFisicaId: pessoa.id,
        qualificacao,
      },
    })

    await registrarAuditoria(
      {
        usuarioId: sessao.usuarioId,
        usuarioEmail: emailDoAutor,
        acao: AcaoAuditoria.CRIACAO,
        entidade: 'representante_legal',
        entidadeId: empresa.id,
        detalhes: { pessoaFisicaId: pessoa.id, qualificacao },
      },
      transacao,
    )
  })

  return { situacao: 'vinculado' }
}

export async function desvincularRepresentante(
  sessao: SessaoServidor,
  pessoaJuridicaId: string,
  pessoaFisicaId: string,
  emailDoAutor: string | null,
): Promise<boolean> {
  exigirEquipe(sessao)

  const empresa = await prisma.cliente.findFirst({
    where: filtroDeClientes(sessao, { id: pessoaJuridicaId }),
    select: { id: true },
  })
  if (empresa === null) return false

  const removidos = await prisma.$transaction(async (transacao) => {
    const resultado = await transacao.representanteLegal.deleteMany({
      where: { pessoaJuridicaId: empresa.id, pessoaFisicaId },
    })

    if (resultado.count > 0) {
      await registrarAuditoria(
        {
          usuarioId: sessao.usuarioId,
          usuarioEmail: emailDoAutor,
          acao: AcaoAuditoria.EXCLUSAO,
          entidade: 'representante_legal',
          entidadeId: empresa.id,
          detalhes: { pessoaFisicaId },
        },
        transacao,
      )
    }

    return resultado.count
  })

  return removidos > 0
}
