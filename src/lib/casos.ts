/**
 * Casos — Anexo I, item 2.2.
 *
 * Um cliente tem vários casos; cada caso tem identificação própria e o
 * respectivo número de processo. O caso é o registro interno; "número do
 * processo" é um campo dele — nunca chame o caso de "processo".
 *
 * Regra 2: o cliente ao qual o caso é vinculado é sempre reconferido contra o
 * filtro da sessão. Um `clienteId` no corpo do formulário não é autorização.
 */

import {
  AcaoAuditoria,
  CanalDePagamentoDosHonorariosFixos,
  NaturezaDoHonorarioPersonalizado,
  PerfilUsuario,
  type Prisma,
  SituacaoCaso,
  SituacaoUsuario,
  TipoDeObjeto,
} from '@prisma/client'
import { z } from 'zod'

import { exigirEquipe, filtroDeCasos, filtroDeClientes, type SessaoServidor } from '@/lib/autorizacao'
import { ehViolacaoDeUnicidade, prisma } from '@/lib/prisma'
import { registrarAuditoria } from '@/lib/auditoria'
import { normalizarNumeroDeProcesso, somenteDigitos } from '@/lib/formatos'
import { reaisParaCentavos } from '@/lib/extenso'
import { diaCivilParaData } from '@/lib/datas'
import { errosPorCampo, type ResultadoDeFormulario } from '@/lib/formulario'

// ---------------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------------

const opcional = z
  .string()
  .trim()
  .max(180, 'Texto longo demais para este campo.')
  .transform((valor) => (valor === '' ? null : valor))

/**
 * O número do processo é opcional: o protótipo prevê caso em fase
 * pré-processual, que ainda não tem número. Quando existe, é guardado
 * normalizado, para que a mesma numeração com e sem máscara não vire dois
 * casos diferentes.
 */
const numeroDoProcesso = z
  .string()
  .trim()
  .max(60, 'Número de processo longo demais.')
  .transform((valor, contexto) => {
    if (valor === '') return null

    const digitos = somenteDigitos(valor)
    if (digitos.length === 0) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'O número do processo precisa ter dígitos.',
      })
      return z.NEVER
    }

    return normalizarNumeroDeProcesso(valor)
  })

/**
 * Honorários — só o que a cláusula 2ª do contrato precisa para ser escrita.
 *
 * Regra 12: nada de pagamento. O escritório foi explícito — "nada vinculado
 * referente a pagamentos, somente a adicionar". Se aparecer pedido de baixa
 * de parcela ou de controle de inadimplência, pare e avise: é módulo
 * financeiro, e está fora do contrato.
 */
const honorarios = z
  .string()
  .trim()
  .transform((valor, contexto) => {
    if (valor === '') return null

    const centavos = reaisParaCentavos(valor)
    if (centavos === null) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Valor inválido. Escreva como 1.750,00.',
      })
      return z.NEVER
    }

    if (centavos <= 0) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'O valor dos honorários precisa ser maior que zero.',
      })
      return z.NEVER
    }

    return centavos
  })

/**
 * Honorários de êxito e percentual sobre proveito econômico — as duas
 * modalidades combináveis com o valor fixo acima (17/09/2026). As duas usam
 * a mesma faixa: 10 a 30, número inteiro, sem casas decimais — foi assim que
 * o escritório descreveu em reunião.
 */
function percentualDeHonorario(rotulo: string) {
  return z
    .string()
    .trim()
    .transform((valor, contexto) => {
      if (valor === '') return null

      const numero = Number(valor.replace(',', '.'))
      if (!Number.isInteger(numero)) {
        contexto.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Informe ${rotulo} como um número inteiro, de 10 a 30.`,
        })
        return z.NEVER
      }

      if (numero < 10 || numero > 30) {
        contexto.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${rotulo} precisa estar entre 10% e 30%.`,
        })
        return z.NEVER
      }

      return numero
    })
}

/**
 * Texto livre e longo — a descrição do objeto e os campos dos honorários
 * personalizados. É texto que o escritório escreve caso a caso e que entra
 * tal qual no contrato, por isso o teto é bem maior que o de `opcional`.
 */
const textoLongo = z
  .string()
  .trim()
  .max(2000, 'Texto longo demais para este campo (máximo de 2.000 caracteres).')
  .transform((valor) => (valor === '' ? null : valor))

/** "Vencerão em N dias": inteiro de 1 a 365, em branco = ainda não informado. */
const prazoEmDias = z
  .string()
  .trim()
  .transform((valor, contexto) => {
    if (valor === '') return null

    const numero = Number(valor)
    if (!Number.isInteger(numero) || numero < 1 || numero > 365) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe o prazo em dias, de 1 a 365.',
      })
      return z.NEVER
    }

    return numero
  })

/** Lista fechada vinda de um `<select>`; em branco = ainda não escolhido. */
function escolhaOpcional<E extends Record<string, string>>(
  valores: E,
  mensagem: string,
) {
  return z.preprocess(
    (valor) => (valor === '' || valor === undefined ? null : valor),
    z.nativeEnum(valores, { errorMap: () => ({ message: mensagem }) }).nullable(),
  )
}

/**
 * Quantas linhas de parcela o formulário mostra. Linhas fixas em vez de um
 * botão "adicionar": o contrato do escritório nunca passou de três parcelas, e
 * assim o formulário funciona sem JavaScript.
 */
export const LINHAS_DE_PARCELA = 12

export type ParcelaInformada = { valorEmCentavos: number; vencimento: Date }

/**
 * Lê as parcelas que vieram do formulário. Linha sem valor e sem data é
 * ignorada — o formulário mostra algumas linhas em branco de propósito.
 */
export function lerParcelas(
  linhas: readonly { valor: string; vencimento: string }[],
): ResultadoDeFormulario<ParcelaInformada[]> {
  const parcelas: ParcelaInformada[] = []
  const erros: Record<string, string> = {}

  linhas.forEach((linha, indice) => {
    const valor = linha.valor.trim()
    const vencimento = linha.vencimento.trim()

    if (valor === '' && vencimento === '') return

    const centavos = reaisParaCentavos(valor)
    if (centavos === null || centavos <= 0) {
      erros[`parcelas.${indice}.valor`] = 'Valor inválido. Escreva como 500,00.'
      return
    }

    const data = diaCivilParaData(vencimento)
    if (data === null) {
      erros[`parcelas.${indice}.vencimento`] = 'Informe o vencimento da parcela.'
      return
    }

    parcelas.push({ valorEmCentavos: centavos, vencimento: data })
  })

  if (Object.keys(erros).length > 0) return { ok: false, erros }

  return { ok: true, dados: parcelas }
}

/**
 * A soma das parcelas tem que bater com o total. Divergência aqui vira
 * contrato assinado dizendo duas coisas diferentes sobre o mesmo valor.
 */
export function somaDasParcelasConfere(
  honorariosEmCentavos: number | null,
  parcelas: readonly ParcelaInformada[],
): boolean {
  if (honorariosEmCentavos === null || parcelas.length === 0) return true
  const soma = parcelas.reduce((total, parcela) => total + parcela.valorEmCentavos, 0)
  return soma === honorariosEmCentavos
}

export const esquemaDeCaso = z.object({
  honorarios,
  canalDePagamentoFixo: escolhaOpcional(
    CanalDePagamentoDosHonorariosFixos,
    'Canal de pagamento inválido.',
  ),
  percentualExito: percentualDeHonorario('o percentual de honorários de êxito'),
  percentualProveitoEconomico: percentualDeHonorario(
    'o percentual sobre o proveito econômico',
  ),
  referenciaDaEconomia: textoLongo,
  prazoDePagamentoDaEconomia: prazoEmDias,
  tipoDeObjeto: escolhaOpcional(TipoDeObjeto, 'Tipo de objeto inválido.'),
  descricaoDoObjeto: textoLongo,
  // Caixinha do formulário: marcada chega como "on", desmarcada nem chega.
  honorariosPersonalizados: z.string().transform((valor) => valor === 'on'),
  personalizadoServicos: textoLongo,
  personalizadoValorOuPercentual: textoLongo,
  personalizadoBaseDeCalculo: textoLongo,
  personalizadoCondicaoDeExigibilidade: textoLongo,
  personalizadoPagamento: textoLongo,
  personalizadoNatureza: escolhaOpcional(
    NaturezaDoHonorarioPersonalizado,
    'Escolha se a remuneração é cumulativa, substitutiva ou compensável.',
  ),
  personalizadoRelacaoComAsDemais: textoLongo,
  personalizadoCondicoesEspecificas: textoLongo,
  numeroProcesso: numeroDoProcesso,
  assunto: z
    .string()
    .trim()
    .min(3, 'Descreva o assunto do caso.')
    .max(180, 'Assunto longo demais.'),
  vara: opcional,
  parteContraria: opcional,
  // Em branco vira "em andamento", que é como o caso nasce. O `nativeEnum`
  // sozinho devolveria a mensagem em inglês do Zod para valor fora da lista,
  // e regra 1 vale também para mensagem de erro.
  situacao: z.preprocess(
    (valor) => (valor === '' || valor === undefined ? SituacaoCaso.EM_ANDAMENTO : valor),
    z.nativeEnum(SituacaoCaso, {
      errorMap: () => ({ message: 'Situação de caso inválida.' }),
    }),
  ),
  responsavelId: z
    .string()
    .trim()
    .transform((valor) => (valor === '' ? null : valor)),
})

export type DadosDeCaso = z.output<typeof esquemaDeCaso>
export type CamposDeCaso = Record<keyof z.input<typeof esquemaDeCaso>, string>

/**
 * Modalidade desligada não deixa resto para trás.
 *
 * Quem desmarca "honorários personalizados" ou apaga o percentual do proveito
 * econômico não quer que o texto antigo continue guardado no caso — ele
 * voltaria a aparecer se alguém religasse a modalidade, e num contrato isso é
 * cláusula com dado de outra conversa.
 */
function semRestoDeModalidadeDesligada(dados: DadosDeCaso): DadosDeCaso {
  const limpo = { ...dados }

  if (limpo.honorarios === null) {
    limpo.canalDePagamentoFixo = null
  }

  if (limpo.percentualProveitoEconomico === null) {
    limpo.referenciaDaEconomia = null
    limpo.prazoDePagamentoDaEconomia = null
  }

  if (!limpo.honorariosPersonalizados) {
    limpo.personalizadoServicos = null
    limpo.personalizadoValorOuPercentual = null
    limpo.personalizadoBaseDeCalculo = null
    limpo.personalizadoCondicaoDeExigibilidade = null
    limpo.personalizadoPagamento = null
    limpo.personalizadoNatureza = null
    limpo.personalizadoRelacaoComAsDemais = null
    limpo.personalizadoCondicoesEspecificas = null
  }

  return limpo
}

export function validarCaso(campos: CamposDeCaso): ResultadoDeFormulario<DadosDeCaso> {
  const conferido = esquemaDeCaso.safeParse(campos)
  if (!conferido.success) {
    return { ok: false, erros: errosPorCampo(conferido.error) }
  }
  return { ok: true, dados: semRestoDeModalidadeDesligada(conferido.data) }
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

const RESUMO = {
  id: true,
  numeroProcesso: true,
  assunto: true,
  vara: true,
  situacao: true,
  criadoEm: true,
  cliente: { select: { id: true, nome: true, documento: true } },
  responsavel: { select: { nome: true } },
  andamentos: {
    select: { data: true },
    orderBy: { data: 'desc' as const },
    take: 1,
  },
} satisfies Prisma.CasoSelect

export type LinhaDeCaso = Prisma.CasoGetPayload<{ select: typeof RESUMO }>

/**
 * Busca de caso por número do processo, assunto ou nome do cliente. Como na
 * lista de clientes, um termo só de dígitos é tratado como numeração.
 */
function condicaoDaBusca(termo: string): Prisma.CasoWhereInput | undefined {
  const limpo = termo.trim()
  if (limpo === '') return undefined

  const digitos = somenteDigitos(limpo)
  const temLetra = /\p{L}/u.test(limpo)

  if (!temLetra && digitos.length >= 3) {
    return {
      OR: [
        { numeroProcesso: { contains: digitos } },
        { cliente: { documento: { contains: digitos } } },
      ],
    }
  }

  return {
    OR: [
      { assunto: { contains: limpo, mode: 'insensitive' } },
      { cliente: { nome: { contains: limpo, mode: 'insensitive' } } },
      { numeroProcesso: { contains: limpo, mode: 'insensitive' } },
    ],
  }
}

/** Teto de linhas por página, como na lista de clientes. */
// ---------------------------------------------------------------------------
// Filtros da lista
//
// Montados a partir da query string, que é do navegador — e por isso entram
// SEMPRE por dentro de `filtroDeCasos` (regra 2). Cada um só estreita.
// Valor desconhecido vira "sem filtro", nunca erro.
// ---------------------------------------------------------------------------

export type FiltrosDeCaso = {
  /** '' = todas. */
  situacao: '' | 'EM_ANDAMENTO' | 'ARQUIVADO'
  /** '' = todos; 'sem' = sem responsável definido; ou o id de um da equipe. */
  responsavel: string
  /** '' = todos; 'com'/'sem' número de processo (pré-processual). */
  numero: '' | 'com' | 'sem'
}

export const FILTROS_DE_CASO_VAZIOS: FiltrosDeCaso = {
  situacao: '',
  responsavel: '',
  numero: '',
}

export function lerFiltrosDeCaso(
  entrada: Record<string, string | undefined>,
): FiltrosDeCaso {
  const situacao = entrada['situacao'] ?? ''
  const numero = entrada['numero'] ?? ''

  return {
    situacao:
      situacao === SituacaoCaso.EM_ANDAMENTO || situacao === SituacaoCaso.ARQUIVADO
        ? situacao
        : '',
    // Não confere aqui se o id existe: id inexistente simplesmente não acha
    // caso nenhum, que é o resultado honesto.
    responsavel: (entrada['responsavel'] ?? '').trim(),
    numero: numero === 'com' || numero === 'sem' ? numero : '',
  }
}

export function algumFiltroDeCasoAtivo(filtros: FiltrosDeCaso): boolean {
  return filtros.situacao !== '' || filtros.responsavel !== '' || filtros.numero !== ''
}

export function condicaoDosFiltrosDeCaso(
  filtros: FiltrosDeCaso,
): Prisma.CasoWhereInput {
  const condicoes: Prisma.CasoWhereInput[] = []

  if (filtros.situacao !== '') condicoes.push({ situacao: filtros.situacao })

  if (filtros.responsavel === 'sem') {
    condicoes.push({ responsavelId: null })
  } else if (filtros.responsavel !== '') {
    condicoes.push({ responsavelId: filtros.responsavel })
  }

  // O protótipo prevê caso ainda em fase pré-processual, sem número. Saber
  // quais são é a diferença entre lembrar e esquecer de protocolar.
  if (filtros.numero === 'com') condicoes.push({ numeroProcesso: { not: null } })
  if (filtros.numero === 'sem') condicoes.push({ numeroProcesso: null })

  return condicoes.length === 0 ? {} : { AND: condicoes }
}

export const LIMITE_DA_LISTA = 200

export type ListaDeCasos = {
  linhas: LinhaDeCaso[]
  /** Verdadeiro quando havia mais do que cabe: a tela precisa dizer isso. */
  truncada: boolean
}

export async function listarCasos(
  sessao: SessaoServidor,
  termo: string,
  filtros: FiltrosDeCaso = FILTROS_DE_CASO_VAZIOS,
): Promise<ListaDeCasos> {
  const condicoes: Prisma.CasoWhereInput[] = []
  const daBusca = condicaoDaBusca(termo)
  if (daBusca !== undefined) condicoes.push(daBusca)
  if (algumFiltroDeCasoAtivo(filtros)) condicoes.push(condicaoDosFiltrosDeCaso(filtros))

  const casos = await prisma.caso.findMany({
    where: filtroDeCasos(
      sessao,
      condicoes.length === 0 ? undefined : { AND: condicoes },
    ),
    select: RESUMO,
    orderBy: { criadoEm: 'desc' },
    take: LIMITE_DA_LISTA + 1,
  })

  return {
    linhas: casos.slice(0, LIMITE_DA_LISTA),
    truncada: casos.length > LIMITE_DA_LISTA,
  }
}

/**
 * Confere que o responsável escolhido existe e é da equipe do escritório.
 *
 * O `responsavelId` chega do `<select>`, e o navegador manda o que quiser.
 * Sem esta conferência, um id inexistente derruba a escrita com erro de chave
 * estrangeira, e o id de um usuário de perfil CLIENTE viraria "responsável"
 * por um caso.
 */
async function responsavelEhValido(responsavelId: string): Promise<boolean> {
  const encontrado = await prisma.usuario.findFirst({
    where: {
      id: responsavelId,
      perfil: { in: [PerfilUsuario.OPERADOR, PerfilUsuario.ADMINISTRADOR] },
      situacao: SituacaoUsuario.ATIVO,
    },
    select: { id: true },
  })
  return encontrado !== null
}

export async function contarCasos(sessao: SessaoServidor): Promise<number> {
  return prisma.caso.count({ where: filtroDeCasos(sessao) })
}

/** Devolve null quando a sessão não pode ver este caso. */
export async function obterCaso(sessao: SessaoServidor, id: string) {
  return prisma.caso.findFirst({
    where: filtroDeCasos(sessao, { id }),
    include: {
      cliente: {
        select: { id: true, nome: true, documento: true, tipoPessoa: true },
      },
      responsavel: { select: { id: true, nome: true } },
      parcelas: { orderBy: { numero: 'asc' } },
    },
  })
}

export type CasoDaFicha = NonNullable<Awaited<ReturnType<typeof obterCaso>>>

/** Operadores e administradores que podem ser responsáveis por um caso. */
export async function listarResponsaveis(sessao: SessaoServidor) {
  exigirEquipe(sessao)

  return prisma.usuario.findMany({
    where: {
      perfil: { in: [PerfilUsuario.OPERADOR, PerfilUsuario.ADMINISTRADOR] },
      situacao: SituacaoUsuario.ATIVO,
    },
    select: { id: true, nome: true },
    orderBy: { nome: 'asc' },
  })
}

// ---------------------------------------------------------------------------
// Escrita
// ---------------------------------------------------------------------------

export type ResultadoDeCaso =
  | { situacao: 'criado'; casoId: string }
  | { situacao: 'cliente_nao_encontrado' }
  /** A numeração já está em outro caso — o número do processo é único. */
  | { situacao: 'numero_repetido'; casoId: string }
  /** O responsável escolhido não é operador nem administrador ativo. */
  | { situacao: 'responsavel_invalido' }

/** Numera as parcelas na ordem em que foram informadas. */
function paraGravar(parcelas: readonly ParcelaInformada[]) {
  return parcelas.map((parcela, indice) => ({
    numero: indice + 1,
    valorEmCentavos: parcela.valorEmCentavos,
    vencimento: parcela.vencimento,
  }))
}

export async function criarCaso(
  sessao: SessaoServidor,
  clienteId: string,
  dados: DadosDeCaso,
  parcelas: readonly ParcelaInformada[],
  emailDoAutor: string | null,
): Promise<ResultadoDeCaso> {
  exigirEquipe(sessao)

  // Regra 2: o vínculo só vale se ESTA sessão enxerga ESTE cliente.
  const cliente = await prisma.cliente.findFirst({
    where: filtroDeClientes(sessao, { id: clienteId }),
    select: { id: true },
  })
  if (cliente === null) return { situacao: 'cliente_nao_encontrado' }

  if (dados.responsavelId !== null && !(await responsavelEhValido(dados.responsavelId))) {
    return { situacao: 'responsavel_invalido' }
  }

  if (dados.numeroProcesso !== null) {
    const repetido = await prisma.caso.findUnique({
      where: { numeroProcesso: dados.numeroProcesso },
      select: { id: true },
    })
    if (repetido !== null) {
      return { situacao: 'numero_repetido', casoId: repetido.id }
    }
  }

  let casoId: string
  try {
    casoId = await prisma.$transaction(async (transacao) => {
      const { honorarios, ...camposDoCaso } = dados

      const criado = await transacao.caso.create({
        data: {
          ...camposDoCaso,
          honorariosEmCentavos: honorarios,
          clienteId: cliente.id,
          parcelas: { create: paraGravar(parcelas) },
        },
        select: { id: true },
      })

      await registrarAuditoria(
        {
          usuarioId: sessao.usuarioId,
          usuarioEmail: emailDoAutor,
          acao: AcaoAuditoria.CRIACAO,
          entidade: 'caso',
          entidadeId: criado.id,
          detalhes: {
            clienteId: cliente.id,
            assunto: dados.assunto,
            numeroProcesso: dados.numeroProcesso,
          },
        },
        transacao,
      )

      return criado.id
    })
  } catch (erro) {
    // Mesma história do CPF: quem decide é o índice único do banco.
    if (ehViolacaoDeUnicidade(erro) && dados.numeroProcesso !== null) {
      const repetido = await prisma.caso.findUnique({
        where: { numeroProcesso: dados.numeroProcesso },
        select: { id: true },
      })
      if (repetido !== null) {
        return { situacao: 'numero_repetido', casoId: repetido.id }
      }
    }
    throw erro
  }

  return { situacao: 'criado', casoId }
}

export type ResultadoDeEdicaoDeCaso =
  | { situacao: 'atualizado' }
  | { situacao: 'nao_encontrado' }
  | { situacao: 'numero_repetido'; casoId: string }
  | { situacao: 'responsavel_invalido' }

export async function atualizarCaso(
  sessao: SessaoServidor,
  id: string,
  dados: DadosDeCaso,
  parcelas: readonly ParcelaInformada[],
  emailDoAutor: string | null,
): Promise<ResultadoDeEdicaoDeCaso> {
  exigirEquipe(sessao)

  const alvo = await prisma.caso.findFirst({
    where: filtroDeCasos(sessao, { id }),
    select: { id: true },
  })
  if (alvo === null) return { situacao: 'nao_encontrado' }

  if (dados.responsavelId !== null && !(await responsavelEhValido(dados.responsavelId))) {
    return { situacao: 'responsavel_invalido' }
  }

  if (dados.numeroProcesso !== null) {
    const repetido = await prisma.caso.findFirst({
      where: { numeroProcesso: dados.numeroProcesso, id: { not: id } },
      select: { id: true },
    })
    if (repetido !== null) {
      return { situacao: 'numero_repetido', casoId: repetido.id }
    }
  }

  try {
    await prisma.$transaction(async (transacao) => {
      const { honorarios, ...camposDoCaso } = dados

      // As parcelas são substituídas por inteiro: elas descrevem a cláusula
      // de pagamento do contrato, e editar meia cláusula não faz sentido.
      await transacao.caso.update({
        where: { id },
        data: {
          ...camposDoCaso,
          honorariosEmCentavos: honorarios,
          parcelas: { deleteMany: {}, create: paraGravar(parcelas) },
        },
      })

      await registrarAuditoria(
        {
          usuarioId: sessao.usuarioId,
          usuarioEmail: emailDoAutor,
          acao: AcaoAuditoria.ATUALIZACAO,
          entidade: 'caso',
          entidadeId: id,
          detalhes: {
            assunto: dados.assunto,
            numeroProcesso: dados.numeroProcesso,
            situacao: dados.situacao,
          },
        },
        transacao,
      )
    })
  } catch (erro) {
    if (ehViolacaoDeUnicidade(erro) && dados.numeroProcesso !== null) {
      const repetido = await prisma.caso.findFirst({
        where: { numeroProcesso: dados.numeroProcesso, id: { not: id } },
        select: { id: true },
      })
      if (repetido !== null) {
        return { situacao: 'numero_repetido', casoId: repetido.id }
      }
    }
    throw erro
  }

  return { situacao: 'atualizado' }
}

// ---------------------------------------------------------------------------
// Exclusão
// ---------------------------------------------------------------------------

export type ResultadoDaExclusaoDeCaso =
  | { situacao: 'excluido' }
  | { situacao: 'nao_encontrado' }
  /** Tem rastro: a exclusão é recusada e a tela diz o que existe. */
  | { situacao: 'tem_historico'; andamentos: number; documentos: number }

/**
 * Apaga um caso — e SÓ o caso que ainda não deixou rastro.
 *
 * Mesma lógica de `excluirCliente`, em escala menor: o problema real que isto
 * resolve é o caso cadastrado por engano — vinculado ao cliente errado, ou um
 * teste que ficou. Esse caso não tem nada dentro, e apagá-lo não destrói
 * nada.
 *
 * Caso com andamento ou com documento (contrato, principalmente) é outra
 * coisa: ali existe histórico do processo que o próprio cliente consulta, e
 * documento que pode estar assinado. Apagar isso é destruir prova de
 * diligência, e nenhuma tela deve poder fazê-lo com dois cliques — por isso a
 * recusa vem com os números, em vez de um "não é possível" sem explicação.
 *
 * As parcelas de honorários somem junto, por cascata: são dado do próprio
 * caso, não histórico de nada.
 */
export async function excluirCaso(
  sessao: SessaoServidor,
  casoId: string,
  emailDoAutor: string | null,
): Promise<ResultadoDaExclusaoDeCaso> {
  exigirEquipe(sessao)

  // Regra 2: o id vem da tela, mas quem decide se ele pode ser tocado é o
  // filtro montado a partir da sessão.
  const caso = await prisma.caso.findFirst({
    where: filtroDeCasos(sessao, { id: casoId }),
    select: {
      id: true,
      assunto: true,
      numeroProcesso: true,
      clienteId: true,
      _count: { select: { andamentos: true, documentos: true } },
    },
  })
  if (caso === null) return { situacao: 'nao_encontrado' }

  if (caso._count.andamentos > 0 || caso._count.documentos > 0) {
    return {
      situacao: 'tem_historico',
      andamentos: caso._count.andamentos,
      documentos: caso._count.documentos,
    }
  }

  await prisma.caso.delete({ where: { id: caso.id } })

  await registrarAuditoria({
    usuarioId: sessao.usuarioId,
    usuarioEmail: emailDoAutor,
    acao: AcaoAuditoria.EXCLUSAO,
    entidade: 'caso',
    entidadeId: caso.id,
    detalhes: {
      // Em texto: a linha do caso não existe mais para ser consultada.
      assunto: caso.assunto,
      numeroProcesso: caso.numeroProcesso,
      clienteId: caso.clienteId,
    },
  })

  return { situacao: 'excluido' }
}
