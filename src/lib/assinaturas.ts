/**
 * Assinatura eletrônica — Anexo II, item 3.4 (resolvido: D4Sign).
 *
 * Fecha o ciclo que a Sprint 3 deixou pela metade:
 *
 *   gerar → enviar → o cliente assina → o assinado volta para a pasta →
 *   e, no caso do CONTRATO, o acesso ao portal se abre sozinho.
 *
 * Esse último passo é o Anexo I, 1.d. Até aqui a data da assinatura era
 * digitada por um operador (`src/lib/assinatura.ts`, que continua existindo e
 * continua valendo para o contrato assinado em papel). Quando o documento vem
 * da D4Sign, quem informa a data é a própria plataforma.
 *
 * Esta camada decide **quem pode** e **o que acontece**; `src/lib/d4sign.ts`
 * sabe apenas conversar com a API. Mesma divisão de `documentos.ts` e
 * `armazenamento.ts`.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POR QUE O ENVIO É UM BOTÃO, E NUNCA UM EFEITO COLATERAL
 *
 * O escritório usa token de PRODUÇÃO e não existe modo de ensaio. Cada envio:
 *
 *   1. consome um crédito da conta do escritório (custo de terceiro, Cláusula
 *      6ª — não é do desenvolvimento);
 *   2. manda e-mail de assinatura DE VERDADE para o cliente.
 *
 * Por isso gerar o PDF não envia nada, o envio tem tela de confirmação com o
 * endereço de cada signatário à vista, e o saldo aparece antes do botão. Um
 * envio por engano não se desfaz: o crédito foi, e o cliente já recebeu.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ─────────────────────────────────────────────────────────────────────────
 * NADA AQUI APAGA NADA
 *
 * O cofre é o do escritório e tem documentos de clientes reais. O pedido de
 * 14/09/2026 foi explícito: "apenas não exclua nada que tem ali". Por isso:
 *
 *  - não há chamada de exclusão, nem de documento, nem de cofre;
 *  - um envio que falha no meio do caminho vira `NO_COFRE` em vez de sumir, e
 *    a tela diz que aquele PDF ficou lá;
 *  - retomar um envio reaproveita o documento que já subiu, em vez de subir
 *    outra cópia — é o mais perto de "limpar" que dá para chegar sem apagar.
 * ─────────────────────────────────────────────────────────────────────────
 */

import {
  AcaoAuditoria,
  SituacaoDoEnvio,
  TipoDocumento,
  TipoPessoa,
} from '@prisma/client'

import { exigirEquipe, filtroDeDocumentos, type SessaoServidor } from '@/lib/autorizacao'
import { prisma } from '@/lib/prisma'
import { registrarAuditoria } from '@/lib/auditoria'
import {
  enviarArquivo,
  gerarChaveDeArquivo,
  lerArquivo,
  removerArquivo,
} from '@/lib/armazenamento'
import { ROTULO_DO_TIPO } from '@/lib/arquivos'
import { ESCRITORIO } from '@/lib/escritorio'
import { registrarAssinatura } from '@/lib/assinatura'
import {
  baixarAssinado,
  configuracaoD4Sign,
  consultarDocumento,
  definirSignatarios,
  mandarAssinar,
  saldo,
  subirDocumento,
  type ConfiguracaoD4Sign,
} from '@/lib/d4sign'

// ---------------------------------------------------------------------------
// Quem assina o quê — decisão pura, sem banco e sem rede
// ---------------------------------------------------------------------------

/**
 * O código da D4Sign para "assinar". Os outros são aprovar, reconhecer e
 * testemunhar, e nenhum documento deste sistema usa esses papéis hoje.
 *
 * TESTEMUNHAS FICAM NO PAPEL. O contrato do escritório tem linhas de
 * testemunha, e elas não entram na lista de signatários: cada testemunha
 * eletrônica seria mais um endereço que o escritório teria de cadastrar e mais
 * gente a esperar para o documento fechar. Combinado em 14/09/2026 —
 * confirmar na demonstração.
 */
export const ACAO_ASSINAR = '1'

export type PapelNaAssinatura = 'cliente' | 'representante' | 'escritorio'

export type ParteQueAssina = {
  papel: PapelNaAssinatura
  nome: string
  /** Nulo quando o cadastro não tem endereço: o envio não sai assim. */
  email: string | null
}

export const ROTULO_DO_PAPEL: Record<PapelNaAssinatura, string> = {
  cliente: 'Cliente',
  representante: 'Representante legal',
  escritorio: 'Escritório',
}

/**
 * O endereço que assina pelo escritório.
 *
 * Fica em variável de ambiente porque não é o mesmo e-mail do SMTP: o portal
 * *manda* mensagens por `contato@`, e quem *assina* pelo escritório é o
 * advogado. Sem a variável, vale o e-mail do advogado que já consta na
 * procuração.
 */
export function emailDoEscritorio(): string {
  const configurado = (process.env['D4SIGN_EMAIL_DO_ESCRITORIO'] ?? '').trim()
  return configurado === '' ? ESCRITORIO.emailDoAdvogado : configurado
}

export type ClienteQueAssina = {
  nome: string
  email: string | null
  tipoPessoa: TipoPessoa
}

/**
 * Quem recebe o e-mail de assinatura, em ordem.
 *
 * As regras, combinadas com o escritório em 14/09/2026:
 *
 *  - **procuração** e **declaração**: só o cliente. São declarações dele; o
 *    escritório é destinatário, não parte que assina.
 *  - **contrato**: o cliente e o escritório — é bilateral.
 *  - **pessoa jurídica**: empresa não assina, quem assina é o representante
 *    legal. Sem e-mail próprio dele, vale o da empresa.
 *  - **anexo**: nada. Anexo é arquivo que o escritório recebeu, não documento
 *    que o sistema emitiu.
 */
export function partesQueAssinam(
  tipo: TipoDocumento,
  cliente: ClienteQueAssina,
  representante: { nome: string; email: string | null } | null,
): ParteQueAssina[] {
  if (tipo === TipoDocumento.ANEXO) return []

  const partes: ParteQueAssina[] =
    cliente.tipoPessoa === TipoPessoa.JURIDICA && representante !== null
      ? [
          {
            papel: 'representante',
            nome: representante.nome,
            email: representante.email ?? cliente.email,
          },
        ]
      : [{ papel: 'cliente', nome: cliente.nome, email: cliente.email }]

  if (tipo === TipoDocumento.CONTRATO) {
    partes.push({
      papel: 'escritorio',
      nome: ESCRITORIO.advogado,
      email: emailDoEscritorio(),
    })
  }

  return partes
}

/** Os papéis que estão sem endereço — a lista que a tela mostra. */
export function papeisSemEmail(partes: readonly ParteQueAssina[]): string[] {
  return partes
    .filter((parte) => parte.email === null || parte.email.trim() === '')
    .map((parte) => ROTULO_DO_PAPEL[parte.papel])
}

/**
 * A mensagem que o signatário lê no e-mail da D4Sign.
 *
 * Diz o que é e de quem vem, e nada além disso: quem recebe pode não ser o
 * cliente (na pessoa jurídica é o sócio, e a caixa pode ser compartilhada).
 * Nome de parte contrária, número de processo e assunto do caso não entram —
 * é o mesmo cuidado de `mensagens.ts`.
 */
export function mensagemDoEnvio(tipo: TipoDocumento, nomeDoCliente: string): string {
  return [
    `${ROTULO_DO_TIPO[tipo]} — ${nomeDoCliente}`,
    '',
    `Documento enviado por ${ESCRITORIO.razaoSocial} para assinatura eletrônica.`,
    'Em caso de dúvida, fale com o escritório antes de assinar.',
  ].join('\n')
}

/** O nome do PDF assinado na pasta do cliente, ao lado do original. */
export function nomeDoAssinado(nomeOriginal: string): string {
  const semExtensao = nomeOriginal.replace(/\.pdf$/i, '')
  return `${semExtensao} (assinado).pdf`
}

// ---------------------------------------------------------------------------
// Leitura — o que a tela de confirmação precisa saber antes do botão
// ---------------------------------------------------------------------------

export type DocumentoParaAssinar = {
  id: string
  nome: string
  tipo: TipoDocumento
  clienteId: string
  clienteNome: string
}

export type EnvioEmAndamento = {
  id: string
  documentoId: string
  situacao: SituacaoDoEnvio
  situacaoNaD4Sign: string | null
  enviadoEm: Date | null
  conferidoEm: Date | null
  assinadoEm: Date | null
  partes: ParteQueAssina[]
  documentoAssinadoId: string | null
}

export type ResultadoDoPreparo =
  | {
      situacao: 'pronto'
      documento: DocumentoParaAssinar
      partes: ParteQueAssina[]
      /** Nulo quando a D4Sign não respondeu — a tela avisa em vez de mentir. */
      creditosRestantes: number | null
      /** Um envio que subiu ao cofre e não chegou a sair. Dá para retomar. */
      retomavel: EnvioEmAndamento | null
    }
  | { situacao: 'nao_encontrado' }
  /** Sem token no ambiente: esta instalação simplesmente não assina. */
  | { situacao: 'sem_integracao' }
  | { situacao: 'sem_cofre' }
  | { situacao: 'tipo_nao_assinavel' }
  | { situacao: 'ja_assinado' }
  | { situacao: 'ja_enviado'; envio: EnvioEmAndamento }
  | { situacao: 'sem_email'; faltando: string[]; ondePreencher: string }
  | { situacao: 'sem_creditos' }

const ENVIO = {
  id: true,
  documentoId: true,
  situacao: true,
  situacaoNaD4Sign: true,
  enviadoEm: true,
  conferidoEm: true,
  assinadoEm: true,
  signatarios: true,
  documentoAssinadoId: true,
  uuidDocumento: true,
  cofre: true,
} as const

function comoEnvio(linha: {
  id: string
  documentoId: string
  situacao: SituacaoDoEnvio
  situacaoNaD4Sign: string | null
  enviadoEm: Date | null
  conferidoEm: Date | null
  assinadoEm: Date | null
  signatarios: unknown
  documentoAssinadoId: string | null
}): EnvioEmAndamento {
  return {
    id: linha.id,
    documentoId: linha.documentoId,
    situacao: linha.situacao,
    situacaoNaD4Sign: linha.situacaoNaD4Sign,
    enviadoEm: linha.enviadoEm,
    conferidoEm: linha.conferidoEm,
    assinadoEm: linha.assinadoEm,
    // Json do banco: só é lista de partes se tiver a forma certa.
    partes: Array.isArray(linha.signatarios)
      ? (linha.signatarios as ParteQueAssina[])
      : [],
    documentoAssinadoId: linha.documentoAssinadoId,
  }
}

/** O envio que vale para um documento: o mais recente. */
export async function envioDoDocumento(
  sessao: SessaoServidor,
  documentoId: string,
): Promise<EnvioEmAndamento | null> {
  exigirEquipe(sessao)

  const linha = await prisma.envioParaAssinatura.findFirst({
    // Regra 2: o filtro da sessão entra mesmo sendo consulta da equipe.
    where: { documento: filtroDeDocumentos(sessao, { id: documentoId }) },
    select: ENVIO,
    orderBy: { criadoEm: 'desc' },
  })

  return linha === null ? null : comoEnvio(linha)
}

/** Os envios de todos os documentos de um cliente, por documento. */
export async function enviosDoCliente(
  sessao: SessaoServidor,
  clienteId: string,
): Promise<Map<string, EnvioEmAndamento>> {
  exigirEquipe(sessao)

  const linhas = await prisma.envioParaAssinatura.findMany({
    where: { documento: filtroDeDocumentos(sessao, { clienteId }) },
    select: ENVIO,
    orderBy: { criadoEm: 'desc' },
  })

  const porDocumento = new Map<string, EnvioEmAndamento>()
  for (const linha of linhas) {
    // Ordenado do mais novo para o mais velho: o primeiro de cada documento é
    // o que vale, e os anteriores não sobrescrevem.
    if (!porDocumento.has(linha.documentoId)) {
      porDocumento.set(linha.documentoId, comoEnvio(linha))
    }
  }

  return porDocumento
}

/**
 * Tudo que a tela de confirmação precisa, sem gastar crédito e sem mandar
 * e-mail nenhum. Ler o saldo é chamada de leitura da D4Sign.
 */
export async function prepararEnvio(
  sessao: SessaoServidor,
  documentoId: string,
): Promise<ResultadoDoPreparo> {
  exigirEquipe(sessao)

  const configuracao = configuracaoD4Sign()
  if (configuracao === null) return { situacao: 'sem_integracao' }
  if (configuracao.cofre === '') return { situacao: 'sem_cofre' }

  const documento = await prisma.documento.findFirst({
    where: filtroDeDocumentos(sessao, { id: documentoId }),
    select: {
      id: true,
      nome: true,
      tipo: true,
      assinadoEm: true,
      clienteId: true,
      origemDaAssinatura: { select: { id: true } },
      cliente: {
        select: {
          nome: true,
          email: true,
          tipoPessoa: true,
          representantes: {
            orderBy: { criadoEm: 'asc' },
            take: 1,
            select: { pessoaFisica: { select: { nome: true, email: true } } },
          },
        },
      },
    },
  })

  if (documento === null) return { situacao: 'nao_encontrado' }

  // O PDF que voltou assinado não se manda assinar de novo.
  if (documento.tipo === TipoDocumento.ANEXO || documento.origemDaAssinatura !== null) {
    return { situacao: 'tipo_nao_assinavel' }
  }

  if (documento.assinadoEm !== null) return { situacao: 'ja_assinado' }

  const emAndamento = await envioDoDocumento(sessao, documento.id)

  if (
    emAndamento !== null &&
    (emAndamento.situacao === SituacaoDoEnvio.AGUARDANDO ||
      emAndamento.situacao === SituacaoDoEnvio.ASSINADO)
  ) {
    return { situacao: 'ja_enviado', envio: emAndamento }
  }

  const representante = documento.cliente.representantes[0]?.pessoaFisica ?? null
  const partes = partesQueAssinam(documento.tipo, documento.cliente, representante)

  const faltando = papeisSemEmail(partes)
  if (faltando.length > 0) {
    return {
      situacao: 'sem_email',
      faltando,
      ondePreencher: `/painel/clientes/${documento.clienteId}/editar`,
    }
  }

  // Leitura pura: não consome crédito. Se a D4Sign não responder, a tela
  // mostra "não foi possível consultar" em vez de um número inventado.
  let creditosRestantes: number | null = null
  try {
    creditosRestantes = (await saldo(configuracao)).restantes
  } catch {
    creditosRestantes = null
  }

  if (creditosRestantes !== null && creditosRestantes <= 0) {
    return { situacao: 'sem_creditos' }
  }

  return {
    situacao: 'pronto',
    documento: {
      id: documento.id,
      nome: documento.nome,
      tipo: documento.tipo,
      clienteId: documento.clienteId,
      clienteNome: documento.cliente.nome,
    },
    partes,
    creditosRestantes,
    retomavel:
      emAndamento !== null && emAndamento.situacao === SituacaoDoEnvio.NO_COFRE
        ? emAndamento
        : null,
  }
}

// ---------------------------------------------------------------------------
// Envio — daqui para baixo gasta crédito e manda e-mail de verdade
// ---------------------------------------------------------------------------

export type ResultadoDoEnvio =
  | { situacao: 'enviado'; envioId: string }
  /** Subiu ao cofre e parou no caminho. O PDF ficou lá, e a tela diz isso. */
  | { situacao: 'parou_no_cofre'; envioId: string; motivo: string }
  | Exclude<ResultadoDoPreparo, { situacao: 'pronto' }>

export async function enviarParaAssinatura(
  sessao: SessaoServidor,
  documentoId: string,
  emailDoAutor: string | null,
): Promise<ResultadoDoEnvio> {
  // As mesmas conferências da tela, refeitas no servidor: entre a tela e o
  // clique o cadastro pode ter mudado, e a tela não decide nada (regra 2).
  const preparo = await prepararEnvio(sessao, documentoId)
  if (preparo.situacao !== 'pronto') return preparo

  const configuracao = configuracaoD4Sign()
  if (configuracao === null) return { situacao: 'sem_integracao' }

  const documento = await prisma.documento.findFirst({
    where: filtroDeDocumentos(sessao, { id: documentoId }),
    select: { id: true, nome: true, tipo: true, chaveArquivo: true, clienteId: true },
  })
  if (documento === null) return { situacao: 'nao_encontrado' }

  const partesParaGravar = preparo.partes.map((parte) => ({ ...parte }))

  // Retomar reaproveita o que já está no cofre. Subir de novo deixaria duas
  // cópias do mesmo documento no cofre do escritório, e apagar está proibido.
  let envioId: string
  let uuid: string

  if (preparo.retomavel !== null) {
    envioId = preparo.retomavel.id
    const anterior = await prisma.envioParaAssinatura.findUnique({
      where: { id: envioId },
      select: { uuidDocumento: true },
    })
    if (anterior === null) return { situacao: 'nao_encontrado' }
    uuid = anterior.uuidDocumento
  } else {
    const pdf = await lerArquivo(documento.chaveArquivo)
    uuid = await subirDocumento(configuracao, configuracao.cofre, documento.nome, pdf)

    // Gravado ANTES do envio, de propósito: se o passo seguinte falhar, o
    // documento já está no cofre do escritório e precisa ter dono no sistema.
    const criado = await prisma.envioParaAssinatura.create({
      data: {
        documentoId: documento.id,
        uuidDocumento: uuid,
        cofre: configuracao.cofre,
        situacao: SituacaoDoEnvio.NO_COFRE,
        signatarios: partesParaGravar,
        pedidoPorId: sessao.usuarioId,
      },
      select: { id: true },
    })
    envioId = criado.id
  }

  try {
    await definirSignatarios(
      configuracao,
      uuid,
      preparo.partes.map((parte) => ({
        email: (parte.email ?? '').trim(),
        acao: ACAO_ASSINAR,
      })),
    )

    // O passo que cobra. Depois dele não há volta: o e-mail já saiu.
    await mandarAssinar(
      configuracao,
      uuid,
      mensagemDoEnvio(documento.tipo, preparo.documento.clienteNome),
    )
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : 'Falha desconhecida.'

    await prisma.envioParaAssinatura.update({
      where: { id: envioId },
      data: { situacao: SituacaoDoEnvio.NO_COFRE, situacaoNaD4Sign: motivo },
    })

    await registrarAuditoria({
      usuarioId: sessao.usuarioId,
      usuarioEmail: emailDoAutor,
      acao: AcaoAuditoria.ATUALIZACAO,
      entidade: 'envio_para_assinatura',
      entidadeId: envioId,
      detalhes: {
        documentoId: documento.id,
        clienteId: documento.clienteId,
        resultado: 'parou_no_cofre',
        motivo,
      },
    })

    return { situacao: 'parou_no_cofre', envioId, motivo }
  }

  const agora = new Date()

  await prisma.envioParaAssinatura.update({
    where: { id: envioId },
    data: {
      situacao: SituacaoDoEnvio.AGUARDANDO,
      enviadoEm: agora,
      signatarios: partesParaGravar,
      situacaoNaD4Sign: null,
    },
  })

  // Regra 6: quem mandou, para quem e quando. É este registro que responde
  // "quem gastou o crédito" e "para qual endereço este contrato foi".
  await registrarAuditoria({
    usuarioId: sessao.usuarioId,
    usuarioEmail: emailDoAutor,
    acao: AcaoAuditoria.CRIACAO,
    entidade: 'envio_para_assinatura',
    entidadeId: envioId,
    detalhes: {
      documentoId: documento.id,
      clienteId: documento.clienteId,
      tipo: documento.tipo,
      cofre: configuracao.cofre,
      signatarios: preparo.partes.map((parte) => ({
        papel: parte.papel,
        email: parte.email,
      })),
    },
  })

  return { situacao: 'enviado', envioId }
}

// ---------------------------------------------------------------------------
// A volta — perguntar à D4Sign se já assinaram
// ---------------------------------------------------------------------------

export type ResultadoDaConferencia =
  | { situacao: 'aguardando' }
  | {
      situacao: 'assinado'
      documentoAssinadoId: string
      /** Verdadeiro quando esta conferência liberou o acesso do cliente. */
      acessoLiberado: boolean
    }
  | { situacao: 'cancelado' }
  | { situacao: 'nao_encontrado' }
  | { situacao: 'sem_integracao' }
  | { situacao: 'desconhecida'; situacaoNaD4Sign: string }

/**
 * Pergunta à D4Sign como está o documento e, se já estiver assinado, traz o
 * PDF de volta para a pasta do cliente.
 *
 * **Por que perguntar em vez de esperar um aviso.** A D4Sign sabe chamar um
 * endereço nosso quando o documento fecha, mas isso exige duas coisas que não
 * estão nas nossas mãos: alguém configurando o webhook no painel do escritório
 * e um endereço público deste portal aceitando requisição de fora, sem sessão.
 * Perguntar funciona sem depender de ninguém, e é chamada de leitura — não
 * gasta crédito. Se o escritório quiser o aviso automático depois, ele entra
 * por cima disto, chamando esta mesma função.
 *
 * Idempotente: conferir de novo um envio já assinado não baixa o PDF outra vez
 * nem cria um segundo documento.
 */
export async function conferirAssinatura(
  sessao: SessaoServidor,
  envioId: string,
  emailDoAutor: string | null,
): Promise<ResultadoDaConferencia> {
  exigirEquipe(sessao)

  const configuracao = configuracaoD4Sign()
  if (configuracao === null) return { situacao: 'sem_integracao' }

  const envio = await prisma.envioParaAssinatura.findFirst({
    // Regra 2: o envio só é alcançável se o documento dele for alcançável.
    where: { id: envioId, documento: filtroDeDocumentos(sessao) },
    select: {
      id: true,
      uuidDocumento: true,
      documentoAssinadoId: true,
      documento: {
        select: {
          id: true,
          nome: true,
          tipo: true,
          casoId: true,
          clienteId: true,
        },
      },
    },
  })

  if (envio === null) return { situacao: 'nao_encontrado' }

  // Já resolvido em uma conferência anterior: nada a perguntar.
  if (envio.documentoAssinadoId !== null) {
    return {
      situacao: 'assinado',
      documentoAssinadoId: envio.documentoAssinadoId,
      acessoLiberado: false,
    }
  }

  const naD4Sign = await consultarDocumento(configuracao, envio.uuidDocumento)
  const agora = new Date()

  if (naD4Sign === null) {
    await prisma.envioParaAssinatura.update({
      where: { id: envio.id },
      data: { conferidoEm: agora },
    })
    return { situacao: 'nao_encontrado' }
  }

  if (naD4Sign.situacao === 'cancelado') {
    await prisma.envioParaAssinatura.update({
      where: { id: envio.id },
      data: {
        situacao: SituacaoDoEnvio.CANCELADO,
        situacaoNaD4Sign: naD4Sign.situacaoBruta,
        conferidoEm: agora,
      },
    })
    return { situacao: 'cancelado' }
  }

  if (naD4Sign.situacao !== 'assinado') {
    await prisma.envioParaAssinatura.update({
      where: { id: envio.id },
      data: { situacaoNaD4Sign: naD4Sign.situacaoBruta, conferidoEm: agora },
    })

    return naD4Sign.situacao === 'aguardando'
      ? { situacao: 'aguardando' }
      : { situacao: 'desconhecida', situacaoNaD4Sign: naD4Sign.situacaoBruta }
  }

  return arquivarAssinado(sessao, configuracao, envio, emailDoAutor, agora)
}

type EnvioParaArquivar = {
  id: string
  uuidDocumento: string
  documento: {
    id: string
    nome: string
    tipo: TipoDocumento
    casoId: string | null
    clienteId: string
  }
}

/**
 * Traz o PDF assinado, arquiva na pasta e — se for o contrato — destranca o
 * portal para o cliente.
 *
 * O documento original NÃO é substituído. Ficam os dois, lado a lado: o que
 * foi enviado e o que voltou assinado. Sobrescrever pouparia uma linha na tela
 * e destruiria a única forma de conferir, depois, que o que foi assinado é o
 * que foi mandado.
 */
async function arquivarAssinado(
  sessao: SessaoServidor,
  configuracao: ConfiguracaoD4Sign,
  envio: EnvioParaArquivar,
  emailDoAutor: string | null,
  agora: Date,
): Promise<ResultadoDaConferencia> {
  const pdf = await baixarAssinado(configuracao, envio.uuidDocumento)

  if (pdf === null) {
    await prisma.envioParaAssinatura.update({
      where: { id: envio.id },
      data: {
        situacaoNaD4Sign: 'assinado, mas sem arquivo para baixar',
        conferidoEm: agora,
      },
    })
    return { situacao: 'aguardando' }
  }

  const chave = gerarChaveDeArquivo()
  await enviarArquivo(chave, pdf, 'application/pdf')

  let documentoAssinadoId: string
  try {
    documentoAssinadoId = await prisma.$transaction(async (transacao) => {
      const criado = await transacao.documento.create({
        data: {
          clienteId: envio.documento.clienteId,
          casoId: envio.documento.casoId,
          tipo: envio.documento.tipo,
          nome: nomeDoAssinado(envio.documento.nome),
          chaveArquivo: chave,
          tipoConteudo: 'application/pdf',
          tamanhoBytes: pdf.byteLength,
          assinadoEm: agora,
          enviadoPorId: sessao.usuarioId,
        },
        select: { id: true },
      })

      await transacao.envioParaAssinatura.update({
        where: { id: envio.id },
        data: {
          situacao: SituacaoDoEnvio.ASSINADO,
          assinadoEm: agora,
          conferidoEm: agora,
          situacaoNaD4Sign: 'assinado',
          documentoAssinadoId: criado.id,
        },
      })

      // O original passa a valer como assinado também: é o mesmo texto, e é
      // ele que a tela de geração conhece.
      await transacao.documento.update({
        where: { id: envio.documento.id },
        data: { assinadoEm: agora },
      })

      await registrarAuditoria(
        {
          usuarioId: sessao.usuarioId,
          usuarioEmail: emailDoAutor,
          acao: AcaoAuditoria.CRIACAO,
          entidade: 'documento',
          entidadeId: criado.id,
          detalhes: {
            origem: 'assinado_na_d4sign',
            envioId: envio.id,
            documentoDeOrigemId: envio.documento.id,
            clienteId: envio.documento.clienteId,
            tipo: envio.documento.tipo,
          },
        },
        transacao,
      )

      return criado.id
    })
  } catch (erro) {
    await removerArquivo(chave).catch(() => undefined)
    throw erro
  }

  // O gatilho do Anexo I, 1.d, finalmente automático: contrato assinado
  // libera o acesso do cliente sem ninguém digitar data nenhuma.
  let acessoLiberado = false
  if (envio.documento.tipo === TipoDocumento.CONTRATO) {
    const resultado = await registrarAssinatura(
      sessao,
      envio.documento.clienteId,
      { assinadoEm: agora },
      emailDoAutor,
    )
    acessoLiberado = resultado.situacao === 'registrada'
  }

  return { situacao: 'assinado', documentoAssinadoId, acessoLiberado }
}
