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

import {
  AcaoAuditoria,
  PerfilUsuario,
  type Prisma,
  SituacaoCliente,
  TipoPessoa,
} from '@prisma/client'
import { z } from 'zod'

import {
  SemAutorizacao,
  exigirEquipe,
  filtroDeClientes,
  type SessaoServidor,
} from '@/lib/autorizacao'
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
    for (const [campo, , mensagem] of obrigatoriosPara(dados.tipoPessoa)) {
      if (dados[campo] === null) {
        contexto.addIssue({
          code: z.ZodIssueCode.custom,
          path: [campo],
          message: mensagem,
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
// Representante legal — obrigatório ao CADASTRAR uma pessoa jurídica
// (reunião de 17/09/2026: "quando eu cadastrar uma empresa, eu preciso
// cadastrar um representante legal também").
//
// Os nomes dos campos já nascem com o prefixo `representante`: o formulário
// de cliente é UM SÓ para os dois cadastros (empresa + sócio) na mesma
// submissão, e sem o prefixo os erros de `documento`, `nome`, `rg` etc. do
// sócio se confundiriam com os da própria empresa no mesmo objeto de erros.
// ---------------------------------------------------------------------------

const textoObrigatorioDoRepresentante = (mensagem: string) =>
  z.string().trim().min(1, mensagem).max(180, 'Texto longo demais para este campo.')

export const esquemaDoRepresentante = z
  .object({
    representanteDocumento: z
      .string()
      .trim()
      .transform((valor, contexto) => {
        const preparado = prepararDocumento(valor)
        if (!preparado.ok) {
          contexto.addIssue({ code: z.ZodIssueCode.custom, message: preparado.motivo })
          return z.NEVER
        }
        if (preparado.tipo !== 'CPF') {
          contexto.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              'O representante legal é sempre uma pessoa física — informe o CPF dele, não o CNPJ da empresa.',
          })
          return z.NEVER
        }
        return preparado.documento
      }),
    representanteNome: z
      .string()
      .trim()
      .min(3, 'Informe o nome completo do representante legal.')
      .max(180, 'Nome longo demais.'),
    representanteRg: textoObrigatorioDoRepresentante(
      'O RG do representante legal é obrigatório.',
    ),
    representanteEstadoCivil: textoObrigatorioDoRepresentante(
      'O estado civil do representante legal é obrigatório.',
    ),
    // O modelo de procuração de pessoa jurídica (24/09/2026) não cita a
    // profissão do representante legal — só a do assistente de pessoa física
    // cita, e essa é conferida na hora de gerar o documento.
    representanteProfissao: opcional,
    representanteNacionalidade: textoObrigatorioDoRepresentante(
      'A nacionalidade do representante legal é obrigatória.',
    ),
    // Opcional, mesma decisão de 17/09/2026 que tirou o nome da mãe dos
    // obrigatórios do cliente pessoa física (ver campos-do-cliente.ts).
    representanteNomeMae: opcional,
    representanteEmail: z
      .string()
      .trim()
      .toLowerCase()
      .transform((valor, contexto) => {
        const conferido = z.string().min(1).email().safeParse(valor)
        if (!conferido.success) {
          contexto.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Informe um e-mail válido do representante legal.',
          })
          return z.NEVER
        }
        return conferido.data
      }),
    representanteTelefone: z
      .string()
      .trim()
      .min(1, 'O telefone do representante legal é obrigatório.')
      .transform((valor) => normalizarTelefone(valor)),
    /// Como consta no contrato social: "sócio", "sócio administrador". Livre
    /// e opcional, mesmo campo que já existia em `vincularRepresentante`.
    representanteQualificacao: opcional,
  })
  .transform((campos) => ({
    documento: campos.representanteDocumento,
    nome: campos.representanteNome,
    rg: campos.representanteRg,
    estadoCivil: campos.representanteEstadoCivil,
    profissao: campos.representanteProfissao,
    nacionalidade: campos.representanteNacionalidade,
    nomeMae: campos.representanteNomeMae,
    email: campos.representanteEmail,
    telefone: campos.representanteTelefone,
    qualificacao: campos.representanteQualificacao,
  }))

export type DadosDoRepresentante = z.output<typeof esquemaDoRepresentante>
export type CamposDoRepresentante = Record<
  keyof z.input<typeof esquemaDoRepresentante>,
  string
>

export function validarRepresentante(
  campos: CamposDoRepresentante,
): ResultadoDeFormulario<DadosDoRepresentante> {
  const conferido = esquemaDoRepresentante.safeParse(campos)
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
// Filtros da lista
//
// São montados a partir da query string, que é do navegador — e por isso
// entram SEMPRE por dentro de `filtroDeClientes` (regra 2). Cada um só
// estreita o resultado; nenhum consegue ampliar o que a sessão enxerga.
//
// Valor desconhecido é tratado como "sem filtro", nunca como erro: link
// antigo, filtro renomeado ou query editada à mão devolvem a lista inteira,
// que é o lado inofensivo de errar.
// ---------------------------------------------------------------------------

export type FiltrosDeCliente = {
  /** '' = todos. */
  tipo: '' | 'FISICA' | 'JURIDICA'
  /** '' = todos; 'liberado'/'aguardando' pelo contrato; 'sem_email' é o furo. */
  acesso: '' | 'liberado' | 'aguardando' | 'sem_email'
  /** '' = todos; 'com'/'sem' casos vinculados. */
  casos: '' | 'com' | 'sem'
  /** '' = todos. Item 4 da lista de melhorias: desativar cliente por engano. */
  situacao: '' | 'ativo' | 'inativo'
}

export const FILTROS_DE_CLIENTE_VAZIOS: FiltrosDeCliente = {
  tipo: '',
  acesso: '',
  casos: '',
  situacao: '',
}

/** Lê os filtros da query string, aceitando só o que existe. */
export function lerFiltrosDeCliente(
  entrada: Record<string, string | undefined>,
): FiltrosDeCliente {
  const dentro = <V extends string>(valor: string | undefined, opcoes: readonly V[]) =>
    (opcoes as readonly string[]).includes(valor ?? '') ? (valor as V) : ('' as V)

  return {
    tipo: dentro(entrada['tipo'], ['FISICA', 'JURIDICA'] as const),
    acesso: dentro(entrada['acesso'], ['liberado', 'aguardando', 'sem_email'] as const),
    casos: dentro(entrada['casos'], ['com', 'sem'] as const),
    situacao: dentro(entrada['situacao'], ['ativo', 'inativo'] as const),
  }
}

export function algumFiltroDeClienteAtivo(filtros: FiltrosDeCliente): boolean {
  return (
    filtros.tipo !== '' ||
    filtros.acesso !== '' ||
    filtros.casos !== '' ||
    filtros.situacao !== ''
  )
}

/** Traduz os filtros em condição do Prisma. Pura: dá para testar sem banco. */
export function condicaoDosFiltrosDeCliente(
  filtros: FiltrosDeCliente,
): Prisma.ClienteWhereInput {
  const condicoes: Prisma.ClienteWhereInput[] = []

  if (filtros.tipo !== '') {
    condicoes.push({ tipoPessoa: filtros.tipo as TipoPessoa })
  }

  if (filtros.acesso === 'liberado') {
    condicoes.push({ contratoAssinadoEm: { not: null } })
  } else if (filtros.acesso === 'aguardando') {
    condicoes.push({ contratoAssinadoEm: null })
  } else if (filtros.acesso === 'sem_email') {
    // Sem e-mail o código de acesso não tem para onde ir: é a lista de quem
    // nunca vai conseguir entrar enquanto ficar assim.
    condicoes.push({ OR: [{ email: null }, { email: '' }] })
  }

  if (filtros.casos === 'com') condicoes.push({ casos: { some: {} } })
  if (filtros.casos === 'sem') condicoes.push({ casos: { none: {} } })

  if (filtros.situacao === 'ativo') condicoes.push({ situacao: SituacaoCliente.ATIVO })
  if (filtros.situacao === 'inativo') condicoes.push({ situacao: SituacaoCliente.INATIVO })

  return condicoes.length === 0 ? {} : { AND: condicoes }
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
  situacao: true,
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
  situacao: SituacaoCliente
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
    situacao: cliente.situacao,
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
  filtros: FiltrosDeCliente = FILTROS_DE_CLIENTE_VAZIOS,
): Promise<ListaDeClientes> {
  const busca = interpretarBusca(termo)

  const condicoes: Prisma.ClienteWhereInput[] = []
  const daBusca = condicaoDaBusca(busca)
  if (daBusca !== undefined) condicoes.push(daBusca)
  if (algumFiltroDeClienteAtivo(filtros)) {
    condicoes.push(condicaoDosFiltrosDeCliente(filtros))
  }

  // Pede um a mais que o teto: se vier, é porque havia mais do que coube.
  const clientes = await prisma.cliente.findMany({
    where: filtroDeClientes(
      sessao,
      condicoes.length === 0 ? undefined : { AND: condicoes },
    ),
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

/**
 * Clientes para o seletor de "a quem pertence este caso".
 *
 * Só id, nome e documento: o seletor não precisa de mais nada, e puxar a
 * ficha inteira de cada cliente para desenhar uma lista suspensa seria
 * desperdício em toda abertura da tela.
 */
export async function listarClientesParaEscolha(
  sessao: SessaoServidor,
): Promise<{ id: string; nome: string; documento: string }[]> {
  exigirEquipe(sessao)

  return prisma.cliente.findMany({
    where: filtroDeClientes(sessao),
    select: { id: true, nome: true, documento: true },
    orderBy: { nome: 'asc' },
  })
}

// ---------------------------------------------------------------------------
// Exclusão
// ---------------------------------------------------------------------------

/** O que existe, em texto — usado tanto na recusa quanto no popup de exclusão forçada. */
export function descreverHistoricoDoCliente(historico: {
  documentos: number
  andamentos: number
  contratoAssinado: boolean
}): string {
  const partes: string[] = []
  if (historico.documentos > 0) {
    partes.push(
      historico.documentos === 1
        ? '1 documento na pasta'
        : `${historico.documentos} documentos na pasta`,
    )
  }
  if (historico.andamentos > 0) {
    partes.push(
      historico.andamentos === 1
        ? '1 andamento lançado'
        : `${historico.andamentos} andamentos lançados`,
    )
  }
  if (historico.contratoAssinado) partes.push('contrato assinado')
  return partes.join(', ')
}

export type ResultadoDaExclusao =
  | { situacao: 'excluido'; nome: string }
  | { situacao: 'nao_encontrado' }
  /** Tem rastro: a exclusão é recusada e a tela diz o que existe. */
  | {
      situacao: 'tem_historico'
      documentos: number
      andamentos: number
      contratoAssinado: boolean
    }

/**
 * Apaga um cliente — e SÓ o cliente que ainda não deixou rastro.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POR QUE NÃO APAGA TUDO
 *
 * O problema real que isto resolve é o cadastro feito por engano: CPF errado,
 * cliente duplicado, teste que ficou. Esse cadastro não tem nada dentro, e
 * apagá-lo não destrói nada.
 *
 * Cliente com documento, com andamento ou com contrato assinado é outra
 * coisa. Ali existe documento gerado ou recebido — em muitos casos assinado —
 * e existe o histórico do processo que o próprio cliente consulta. Apagar
 * isso num escritório de advocacia é destruir prova de diligência, e nenhuma
 * tela deve poder fazê-lo com dois cliques.
 *
 * Por isso a recusa vem com números: a pessoa vê o que existe e decide o que
 * fazer, em vez de receber "não é possível" sem explicação.
 *
 * `opcoes.forcar` é a válvula de escape para quando a decisão É apagar mesmo
 * assim — dado de teste que ficou em produção, cadastro que nunca devia ter
 * virado caso de verdade. Só o ADMINISTRADOR pode usá-la (pedido do
 * escritório, 16/09/2026): a tela exige confirmação reforçada antes de
 * chegar até aqui, mas quem decide destruir prova de diligência precisa ser
 * quem responde pelo escritório, não qualquer operador.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * O que some junto, por cascata: os casos (vazios, ou com andamento e
 * documento quando `forcar` foi usado), o usuário de perfil CLIENTE e os
 * códigos de acesso pendentes.
 *
 * O registro de auditoria fica (regra 6), e guarda nome, documento e — na
 * exclusão forçada — os números do que foi apagado, tudo em texto: depois da
 * exclusão a linha do cliente não existe mais para ser consultada, e
 * "excluiu o cliente cmu48..." não diria nada a ninguém.
 */
export async function excluirCliente(
  sessao: SessaoServidor,
  clienteId: string,
  emailDoAutor: string | null,
  opcoes: { forcar?: boolean } = {},
): Promise<ResultadoDaExclusao> {
  exigirEquipe(sessao)

  // Regra 2: o id vem da tela, mas quem decide se ele pode ser tocado é o
  // filtro montado a partir da sessão.
  const cliente = await prisma.cliente.findFirst({
    where: filtroDeClientes(sessao, { id: clienteId }),
    select: {
      id: true,
      nome: true,
      documento: true,
      contratoAssinadoEm: true,
      _count: { select: { documentos: true, casos: true } },
    },
  })
  if (cliente === null) return { situacao: 'nao_encontrado' }

  const andamentos = await prisma.andamento.count({
    where: { caso: { clienteId: cliente.id } },
  })

  const contratoAssinado = cliente.contratoAssinadoEm !== null
  const temHistorico =
    cliente._count.documentos > 0 || andamentos > 0 || contratoAssinado

  if (temHistorico && opcoes.forcar !== true) {
    return {
      situacao: 'tem_historico',
      documentos: cliente._count.documentos,
      andamentos,
      contratoAssinado,
    }
  }

  if (temHistorico && sessao.perfil !== PerfilUsuario.ADMINISTRADOR) {
    throw new SemAutorizacao(
      'Somente o administrador pode forçar a exclusão de um cliente com histórico.',
    )
  }

  await prisma.cliente.delete({ where: { id: cliente.id } })

  await registrarAuditoria({
    usuarioId: sessao.usuarioId,
    usuarioEmail: emailDoAutor,
    acao: AcaoAuditoria.EXCLUSAO,
    entidade: 'cliente',
    entidadeId: cliente.id,
    detalhes: {
      // Em texto: a linha do cliente não existe mais para ser consultada.
      nome: cliente.nome,
      documento: cliente.documento,
      casosVaziosRemovidos: cliente._count.casos,
      ...(temHistorico
        ? {
            forcado: true,
            documentosApagados: cliente._count.documentos,
            andamentosApagados: andamentos,
            contratoAssinado,
          }
        : {}),
    },
  })

  return { situacao: 'excluido', nome: cliente.nome }
}

// ---------------------------------------------------------------------------
// Situação — desativar sem apagar (item 4 da lista de melhorias: "não há
// como remover cliente cadastrado por engano"). Mesmo padrão de
// `alterarSituacaoDoUsuario`, em `usuarios.ts`.
//
// Diferente da exclusão, isto não precisa de trava de "tem histórico": um
// cliente com caso e documento pode perfeitamente ser desativado — é
// exatamente o caso mais comum (quem terminou o relacionamento com o
// escritório, ou foi cadastrado em duplicidade depois de já ter caso). Nada
// é apagado; o cliente só para de conseguir entrar no portal.
// ---------------------------------------------------------------------------

export type ResultadoDeSituacaoDoCliente =
  | { situacao: 'alterado' }
  | { situacao: 'nao_encontrado' }

export async function alterarSituacaoDoCliente(
  sessao: SessaoServidor,
  id: string,
  novaSituacao: SituacaoCliente,
  emailDoAutor: string | null,
): Promise<ResultadoDeSituacaoDoCliente> {
  exigirEquipe(sessao)

  const alvo = await prisma.cliente.findFirst({
    where: filtroDeClientes(sessao, { id }),
    select: { id: true, situacao: true, nome: true },
  })
  if (alvo === null) return { situacao: 'nao_encontrado' }
  if (alvo.situacao === novaSituacao) return { situacao: 'alterado' }

  await prisma.$transaction(async (transacao) => {
    await transacao.cliente.update({ where: { id }, data: { situacao: novaSituacao } })

    await registrarAuditoria(
      {
        usuarioId: sessao.usuarioId,
        usuarioEmail: emailDoAutor,
        acao: AcaoAuditoria.ATUALIZACAO,
        entidade: 'cliente',
        entidadeId: id,
        detalhes: { nome: alvo.nome, situacao: novaSituacao },
      },
      transacao,
    )
  })

  return { situacao: 'alterado' }
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

/** Documento do representante já pertence a outro CNPJ cadastrado. */
class RepresentanteEhPessoaJuridica extends Error {
  constructor(public readonly nome: string) {
    super(`O documento do representante legal pertence a ${nome}, uma pessoa jurídica.`)
  }
}

export type ResultadoDeCadastroDeEmpresa =
  | { situacao: 'criado'; clienteId: string }
  | { situacao: 'ja_existe'; clienteId: string; nome: string }
  | { situacao: 'representante_e_pessoa_juridica'; nome: string }

/**
 * Cadastra uma pessoa jurídica JÁ COM o representante legal, na mesma
 * transação — decisão de 17/09/2026, que fechou a lacuna registrada mais
 * abaixo em `vincularRepresentante`: até aqui era possível salvar uma empresa
 * sem sócio nenhum, e só a geração de documento (`src/lib/geracao.ts`)
 * percebia a falta, tarde demais no fluxo.
 *
 * Regra 4 continua valendo para o CPF do sócio: se ele já é cliente pessoa
 * física, é reaproveitado (a mesma pessoa pode representar várias empresas);
 * se não existe, nasce um cliente pessoa física novo, só com o que este
 * formulário pediu — endereço e demais campos ficam em branco até alguém
 * preenchê-los na ficha dele, se um dia ele também virar cliente por conta
 * própria.
 */
export async function criarClienteComRepresentante(
  sessao: SessaoServidor,
  dados: DadosDeCliente,
  representante: DadosDoRepresentante,
  emailDoAutor: string | null,
): Promise<ResultadoDeCadastroDeEmpresa> {
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
      const socioExistente = await transacao.cliente.findFirst({
        where: filtroDeClientes(sessao, { documento: representante.documento }),
        select: { id: true, nome: true, tipoPessoa: true },
      })

      if (socioExistente !== null && socioExistente.tipoPessoa !== TipoPessoa.FISICA) {
        throw new RepresentanteEhPessoaJuridica(socioExistente.nome)
      }

      const empresa = await transacao.cliente.create({
        data: {
          ...dados,
          nomeBusca: normalizarParaBusca(dados.nome),
          criadoPorId: sessao.usuarioId,
        },
        select: { id: true },
      })

      const socio =
        socioExistente ??
        (await transacao.cliente.create({
          data: {
            tipoPessoa: TipoPessoa.FISICA,
            documento: representante.documento,
            nome: representante.nome,
            nomeBusca: normalizarParaBusca(representante.nome),
            rg: representante.rg,
            estadoCivil: representante.estadoCivil,
            profissao: representante.profissao,
            nacionalidade: representante.nacionalidade,
            nomeMae: representante.nomeMae,
            email: representante.email,
            telefone: representante.telefone,
            criadoPorId: sessao.usuarioId,
          },
          select: { id: true },
        }))

      await transacao.representanteLegal.create({
        data: {
          pessoaJuridicaId: empresa.id,
          pessoaFisicaId: socio.id,
          qualificacao: representante.qualificacao,
        },
      })

      await registrarAuditoria(
        {
          usuarioId: sessao.usuarioId,
          usuarioEmail: emailDoAutor,
          acao: AcaoAuditoria.CRIACAO,
          entidade: 'cliente',
          entidadeId: empresa.id,
          detalhes: { documento: dados.documento, nome: dados.nome },
        },
        transacao,
      )

      await registrarAuditoria(
        {
          usuarioId: sessao.usuarioId,
          usuarioEmail: emailDoAutor,
          acao: AcaoAuditoria.CRIACAO,
          entidade: 'representante_legal',
          entidadeId: empresa.id,
          detalhes: {
            pessoaFisicaId: socio.id,
            reaproveitado: socioExistente !== null,
            qualificacao: representante.qualificacao,
          },
        },
        transacao,
      )

      return empresa.id
    })
  } catch (erro) {
    if (erro instanceof RepresentanteEhPessoaJuridica) {
      return { situacao: 'representante_e_pessoa_juridica', nome: erro.nome }
    }
    // Mesma corrida que `criarCliente` já trata: entre a checagem acima e o
    // `create`, cabe outro cadastro com o mesmo documento.
    if (ehViolacaoDeUnicidade(erro)) {
      const existenteAgora = await prisma.cliente.findUnique({
        where: { documento: dados.documento },
        select: { id: true, nome: true },
      })
      if (existenteAgora !== null) {
        return { situacao: 'ja_existe', clienteId: existenteAgora.id, nome: existenteAgora.nome }
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
// não existe função para criar um representante avulso: cria-se um cliente
// pessoa física normal e vincula-se. Assim a mesma pessoa representa várias
// empresas sem cadastro duplicado, que é a regra 4 aplicada a este caso.
//
// Desde 17/09/2026 o PRIMEIRO representante nasce junto com a empresa, em
// `criarClienteComRepresentante`, acima — o pedido do escritório foi tornar
// isso obrigatório no cadastro, não só na ficha depois. `vincularRepresentante`
// continua existindo para o que aquela função não cobre: uma segunda empresa
// para o mesmo sócio, um segundo sócio para a mesma empresa, ou uma empresa
// cadastrada antes desta mudança e que ainda não tinha ninguém vinculado.
// ---------------------------------------------------------------------------

export type ResultadoDeVinculo =
  | { situacao: 'vinculado' }
  | { situacao: 'empresa_nao_encontrada' }
  | { situacao: 'pessoa_nao_encontrada' }
  /** O documento informado é de outra empresa, não de uma pessoa física. */
  | { situacao: 'nao_e_pessoa_fisica' }
  | { situacao: 'ja_vinculado'; nome: string }
  /** Ninguém é responsável por si mesmo. */
  | { situacao: 'mesmo_cliente' }

/**
 * Vincula quem responde por um cliente: o sócio que assina por uma EMPRESA
 * ou, desde 24/09/2026, o responsável por um cliente pessoa física MENOR DE
 * IDADE (procuração de menor, modelo do escritório). É a mesma tabela — só a
 * ponta representada muda de tipo; o nome `pessoaJuridicaId` ficou de antes.
 * Pessoa física com responsável vinculado = menor representado.
 */
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
    where: filtroDeClientes(sessao, { id: pessoaJuridicaId }),
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
  if (pessoa.id === empresa.id) return { situacao: 'mesmo_cliente' }

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
