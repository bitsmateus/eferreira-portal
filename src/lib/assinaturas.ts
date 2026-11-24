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
  OrigemDoDocumento,
  PapelDaParte,
  PerfilUsuario,
  ProvedorAssinatura,
  SituacaoDoEnvio,
  TipoDocumento,
  TipoPessoa,
} from '@prisma/client'
import { z } from 'zod'

import { exigirEquipe, filtroDeDocumentos, type SessaoServidor } from '@/lib/autorizacao'
import { ROTULO_DO_PAPEL, type PapelNaAssinatura } from '@/lib/rotulos-de-assinatura'
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
import {
  ajusteDoAmbiente,
  lerPaginasDoPdf,
  pinsDosAvulsos,
  pinsPelasMarcas,
  posicaoPadrao,
  posicionamentoLigado,
  type AjusteDoPin,
  type PaginaDoPdf,
  type PinDaAssinatura,
  type PosicaoEscolhida,
} from '@/lib/posicao-da-assinatura'
import { registrarAssinatura } from '@/lib/assinatura'
import { assinadoEstaCompleto, resumirPdf } from '@/lib/conferencia-do-assinado'
import {
  baixarAssinado,
  cancelarDocumento as cancelarNaD4Sign,
  configuracaoD4Sign,
  consultarDocumento,
  definirSignatarios,
  descreverFalhaDaD4Sign,
  mandarAssinar,
  esquecerSaldo,
  posicionarAssinaturas,
  saldoGuardado,
  subirDocumento,
} from '@/lib/d4sign'
import { NOME_DO_PROVEDOR, provedorEscolhido, zapsignLigada } from '@/lib/provedor-de-assinatura'
import * as zapsign from '@/lib/zapsign'

// ---------------------------------------------------------------------------
// Quem assina o quê — decisão pura, sem banco e sem rede
// ---------------------------------------------------------------------------

/**
 * O código da D4Sign para "assinar". Os outros são aprovar, reconhecer e
 * testemunhar, e nenhum documento deste sistema usa esses papéis hoje.
 *
 * TESTEMUNHAS ELETRÔNICAS FICAVAM DE FORA — decisão revista duas vezes.
 * Até 14/09/2026, o contrato tinha linhas de testemunha em papel, e elas não
 * entravam na lista de signatários da D4Sign: "cada testemunha eletrônica
 * seria mais um endereço a cadastrar e mais gente a esperar". Em 17/09 o
 * escritório voltou atrás para DOCUMENTOS AVULSOS (`ANEXO`, ver
 * `SignatarioAvulso` abaixo), e em 21/09/2026 confirmou: "as assinaturas de
 * testemunha vamos manter para os documentos avulso e o contrato de
 * honorários". Escolhidas na hora do envio (`partesDoEnvio`), nunca por regra
 * fixa. Procuração e declaração continuam só com quem `partesQueAssinam`
 * decide, sem testemunha nenhuma.
 */
export const ACAO_ASSINAR = '1'

export type { PapelNaAssinatura }

export type ParteQueAssina = {
  papel: PapelNaAssinatura
  nome: string
  /** Nulo quando o cadastro não tem endereço: o envio não sai assim. */
  email: string | null
}

// Reexportado para quem já importava daqui — `ROTULO_DO_PAPEL` de verdade
// mora em `rotulos-de-assinatura.ts`, sem nada de servidor: é o que permite a
// tela de assinatura ('use client') mostrar o rótulo do papel sem arrastar
// Prisma, sessão e D4Sign inteiros para o pacote do navegador.
export { ROTULO_DO_PAPEL }

// ---------------------------------------------------------------------------
// Signatários avulsos — só para documentos do tipo ANEXO (17/09/2026)
// ---------------------------------------------------------------------------

/** O que a tela de envio manda: escolhido do cadastro de partes, ou digitado na hora. */
export type SignatarioAvulso = {
  nome: string
  email: string
  papel: PapelDaParte
  /** Onde este signatário assina, se o operador escolheu (24/09/2026). */
  posicao?: PosicaoEscolhida | undefined
}

const esquemaDePosicao = z.object({
  pagina: z.number().int().min(0).max(999),
  lado: z.enum(['esquerda', 'centro', 'direita']),
  alturaEmPercentual: z.number().min(5).max(95),
})

const esquemaDeSignatarioAvulso = z.object({
  nome: z.string().trim().min(2).max(180),
  email: z.string().trim().toLowerCase().email(),
  papel: z.nativeEnum(PapelDaParte),
  posicao: esquemaDePosicao.optional(),
})

const esquemaDeAvulsos = z.array(esquemaDeSignatarioAvulso)

/**
 * Lê a lista de signatários avulsos que a tela mandou, como JSON num campo
 * escondido — nunca confiando no que veio de lá sem checar de novo aqui.
 * Devolve lista vazia para qualquer entrada malformada: quem decide se uma
 * lista vazia é aceitável é `prepararEnvio` (`sem_signatarios`), não este
 * leitor.
 */
export function lerAvulsos(json: string): SignatarioAvulso[] {
  let bruto: unknown
  try {
    bruto = JSON.parse(json)
  } catch {
    return []
  }

  const conferido = esquemaDeAvulsos.safeParse(bruto)
  return conferido.success ? conferido.data : []
}

/**
 * O endereço que assina pelo escritório.
 *
 * Sem a variável `D4SIGN_EMAIL_DO_ESCRITORIO`, vale o e-mail do escritório
 * (`contato@`) — pedido do escritório em 18/11/2026: "alterar o e-mail que
 * aparece como do escritório nos contratos, de sergioferreira@ para
 * contato@". Antes o padrão era o e-mail pessoal do advogado.
 */
export function emailDoEscritorio(): string {
  const configurado = (process.env['D4SIGN_EMAIL_DO_ESCRITORIO'] ?? '').trim()
  return configurado === '' ? ESCRITORIO.email : configurado
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
 *  - **pessoa física com assistente vinculado** (menor ou incapaz, modelos
 *    "representada/assistida" de 24/09/2026): quem assina é o assistente.
 *  - **pessoa jurídica**: empresa não assina, quem assina é o representante
 *    legal. Sem e-mail próprio dele, vale o da empresa.
 *  - **anexo**: nada AQUI — um anexo não tem cliente nem representante
 *    decidindo quem assina por regra fixa. Quem assina um anexo vem de fora,
 *    escolhido na hora do envio (ver `SignatarioAvulso`, acima, e o uso em
 *    `prepararEnvio`).
 */
export function partesQueAssinam(
  tipo: TipoDocumento,
  cliente: ClienteQueAssina,
  representante: { nome: string; email: string | null } | null,
): ParteQueAssina[] {
  if (tipo === TipoDocumento.ANEXO) return []

  const partes: ParteQueAssina[] =
    representante !== null
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

/**
 * A lista final de quem recebe o e-mail: as partes automáticas de
 * `partesQueAssinam` mais o que a tela mandou.
 *
 *  - **anexo**: só quem a tela mandou, com o papel escolhido lá.
 *  - **contrato**: cliente e escritório, mais as testemunhas que a tela
 *    mandou — e SÓ como testemunha, seja qual for o papel que veio no JSON
 *    (o que chega do navegador não decide o papel de ninguém, regra 2). O
 *    escritório confirmou em 21/09/2026 que as testemunhas ficam na assinatura
 *    eletrônica dos documentos avulsos E do contrato de honorários.
 *  - **procuração e declaração**: só as automáticas; nada da tela entra.
 */
export function partesDoEnvio(
  tipo: TipoDocumento,
  automaticas: readonly ParteQueAssina[],
  avulsos: readonly SignatarioAvulso[],
): ParteQueAssina[] {
  const daTela: ParteQueAssina[] = avulsos.map((avulso) => ({
    papel: tipo === TipoDocumento.CONTRATO ? PapelDaParte.TESTEMUNHA : avulso.papel,
    nome: avulso.nome,
    email: avulso.email,
  }))

  if (tipo === TipoDocumento.ANEXO) return daTela
  if (tipo === TipoDocumento.CONTRATO) return [...automaticas, ...daTela]
  return [...automaticas]
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

/**
 * Os pins do envio. Cliente, representante e escritório entram pela marca que
 * o modelo deixou no PDF; documento avulso, pelo que o operador escolheu (ou
 * pelo padrão). Testemunha do contrato fica sem pin — o contrato não tem lugar
 * marcado para ela, e a D4Sign a posiciona como sempre fez.
 */
export function pinsDoEnvio(
  tipo: TipoDocumento,
  partes: readonly ParteQueAssina[],
  avulsos: readonly SignatarioAvulso[],
  paginas: readonly PaginaDoPdf[],
  ajuste: AjusteDoPin,
): PinDaAssinatura[] {
  if (tipo === TipoDocumento.ANEXO) {
    return pinsDosAvulsos(
      paginas,
      partes
        .filter((parte) => parte.email !== null && parte.email.trim() !== '')
        .map((parte) => ({
          email: (parte.email ?? '').trim(),
          posicao: avulsos.find((avulso) => avulso.email === (parte.email ?? '').trim())?.posicao,
        })),
      ajuste,
    )
  }

  const marcadas = partes.flatMap((parte) => {
    const email = (parte.email ?? '').trim()
    if (email === '') return []
    if (parte.papel === 'escritorio') return [{ email, chave: 'escritorio' }]
    if (parte.papel === 'cliente' || parte.papel === 'representante') {
      return [{ email, chave: 'parte' }]
    }
    return []
  })

  return pinsPelasMarcas(paginas, marcadas, ajuste)
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
  /** Plataforma que recebeu este envio (D4Sign até 11/2026, ZapSign depois). */
  provedor: ProvedorAssinatura
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
      /** Plataforma pela qual este envio sairia (`ASSINATURA_PROVEDOR`). */
      provedor: ProvedorAssinatura
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
  /** Anexo sem ninguém escolhido para assinar ainda. */
  | { situacao: 'sem_signatarios' }

const ENVIO = {
  id: true,
  documentoId: true,
  provedor: true,
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
  provedor: ProvedorAssinatura
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
    provedor: linha.provedor,
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
 * O mesmo que `enviosDoCliente`, mas para TODOS os documentos que esta
 * sessão enxerga — é o que a tela de Documentos usa para saber, sem abrir
 * cliente por cliente, quem está aguardando assinatura (item 2 da lista de
 * melhorias). Só a equipe chega aqui: `filtroDeDocumentos` sem `clienteId`
 * devolveria a base inteira para uma sessão de cliente, se ela conseguisse
 * chamar isto — o que `exigirEquipe` impede antes de qualquer consulta.
 */
export async function enviosRecentes(
  sessao: SessaoServidor,
): Promise<Map<string, EnvioEmAndamento>> {
  exigirEquipe(sessao)

  const linhas = await prisma.envioParaAssinatura.findMany({
    where: { documento: filtroDeDocumentos(sessao) },
    select: ENVIO,
    orderBy: { criadoEm: 'desc' },
  })

  const porDocumento = new Map<string, EnvioEmAndamento>()
  for (const linha of linhas) {
    if (!porDocumento.has(linha.documentoId)) {
      porDocumento.set(linha.documentoId, comoEnvio(linha))
    }
  }

  return porDocumento
}

/**
 * Tudo que a tela de confirmação precisa, sem gastar crédito e sem mandar
 * e-mail nenhum. Ler o saldo é chamada de leitura da D4Sign.
 *
 * `avulsos` é a lista escolhida na tela (do cadastro de partes, ou digitada na
 * hora). No ANEXO é quem assina; no CONTRATO são as testemunhas, somadas a
 * cliente e escritório; na procuração e na declaração é ignorada. Ver
 * `partesDoEnvio`.
 */
export async function prepararEnvio(
  sessao: SessaoServidor,
  documentoId: string,
  avulsos: readonly SignatarioAvulso[] = [],
): Promise<ResultadoDoPreparo> {
  exigirEquipe(sessao)

  // A plataforma dos envios novos (ASSINATURA_PROVEDOR). Na ZapSign não há
  // cofre nem saldo por chamada: só a chave precisa existir.
  const provedor = provedorEscolhido()
  const configuracao = provedor === ProvedorAssinatura.D4SIGN ? configuracaoD4Sign() : null
  if (provedor === ProvedorAssinatura.D4SIGN) {
    if (configuracao === null) return { situacao: 'sem_integracao' }
    if (configuracao.cofre === '') return { situacao: 'sem_cofre' }
  } else if (!zapsign.zapsignAtiva()) {
    return { situacao: 'sem_integracao' }
  }

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

  // O PDF que voltou assinado não se manda assinar de novo — isso vale para
  // qualquer tipo, inclusive o anexo que já tiver voltado assinado.
  if (documento.origemDaAssinatura !== null) {
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
  const partes = partesDoEnvio(
    documento.tipo,
    partesQueAssinam(documento.tipo, documento.cliente, representante),
    avulsos,
  )

  // Anexo não tem ninguém "automático" — sem escolha na tela, não há para
  // quem mandar. Os demais tipos sempre têm ao menos o cliente.
  if (documento.tipo === TipoDocumento.ANEXO && partes.length === 0) {
    return { situacao: 'sem_signatarios' }
  }

  const faltando = papeisSemEmail(partes)
  if (faltando.length > 0) {
    return {
      situacao: 'sem_email',
      faltando,
      ondePreencher: `/painel/clientes/${documento.clienteId}/editar`,
    }
  }

  // Leitura pura: não consome crédito, mas consome chamada da chave de API —
  // por isso vem guardada por alguns minutos (`saldoGuardado`). Se a D4Sign
  // não responder, a tela mostra "não foi possível consultar" em vez de um
  // número inventado.
  const creditosRestantes =
    configuracao === null ? null : ((await saldoGuardado(configuracao))?.restantes ?? null)

  if (creditosRestantes !== null && creditosRestantes <= 0) {
    return { situacao: 'sem_creditos' }
  }

  return {
    situacao: 'pronto',
    provedor,
    documento: {
      id: documento.id,
      nome: documento.nome,
      tipo: documento.tipo,
      clienteId: documento.clienteId,
      clienteNome: documento.cliente.nome,
    },
    partes,
    creditosRestantes,
    // Retomar é coisa da D4Sign (o PDF ficou no cofre dela). Com a ZapSign
    // escolhida, um NO_COFRE antigo não se retoma: o envio sai do zero, lá.
    retomavel:
      emAndamento !== null &&
      emAndamento.situacao === SituacaoDoEnvio.NO_COFRE &&
      emAndamento.provedor === ProvedorAssinatura.D4SIGN &&
      provedor === ProvedorAssinatura.D4SIGN
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
  /** A D4Sign recusou ANTES de o PDF subir: nada ficou no cofre, nenhum crédito gasto. */
  | { situacao: 'falha_na_d4sign'; motivo: string }
  | Exclude<ResultadoDoPreparo, { situacao: 'pronto' }>

export async function enviarParaAssinatura(
  sessao: SessaoServidor,
  documentoId: string,
  emailDoAutor: string | null,
  avulsos: readonly SignatarioAvulso[] = [],
): Promise<ResultadoDoEnvio> {
  // As mesmas conferências da tela, refeitas no servidor: entre a tela e o
  // clique o cadastro pode ter mudado, e a tela não decide nada (regra 2).
  const preparo = await prepararEnvio(sessao, documentoId, avulsos)
  if (preparo.situacao !== 'pronto') return preparo

  const documento = await prisma.documento.findFirst({
    where: filtroDeDocumentos(sessao, { id: documentoId }),
    select: { id: true, nome: true, tipo: true, chaveArquivo: true, clienteId: true },
  })
  if (documento === null) return { situacao: 'nao_encontrado' }

  if (preparo.provedor === ProvedorAssinatura.ZAPSIGN) {
    return enviarPelaZapSign(sessao, documento, preparo, avulsos, emailDoAutor)
  }

  const configuracao = configuracaoD4Sign()
  if (configuracao === null) return { situacao: 'sem_integracao' }

  const partesParaGravar = preparo.partes.map((parte) => ({ ...parte }))

  // Retomar reaproveita o que já está no cofre. Subir de novo deixaria duas
  // cópias do mesmo documento no cofre do escritório, e apagar está proibido.
  let envioId: string
  let uuid: string
  // Se um retry anterior já cadastrou os signatários com sucesso, uma nova
  // tentativa NÃO pode repetir esse passo — ver o comentário grande logo
  // abaixo, no bloco que usa esta variável.
  let signatariosJaDefinidos = false
  // Idem para a posição dos carimbos (`addpins`).
  let posicoesJaDefinidas = false

  if (preparo.retomavel !== null) {
    envioId = preparo.retomavel.id
    const anterior = await prisma.envioParaAssinatura.findUnique({
      where: { id: envioId },
      select: {
        uuidDocumento: true,
        signatariosDefinidosEm: true,
        posicoesDefinidasEm: true,
      },
    })
    if (anterior === null) return { situacao: 'nao_encontrado' }
    uuid = anterior.uuidDocumento
    signatariosJaDefinidos = anterior.signatariosDefinidosEm !== null
    posicoesJaDefinidas = anterior.posicoesDefinidasEm !== null
  } else {
    const pdf = await lerArquivo(documento.chaveArquivo)
    // Recusa aqui (ex.: limite mensal da chave de API, 18/11/2026) não pode
    // virar a tela de erro genérico: nada subiu, e a pessoa precisa saber por quê.
    try {
      uuid = await subirDocumento(configuracao, configuracao.cofre, documento.nome, pdf)
    } catch (erro) {
      return { situacao: 'falha_na_d4sign', motivo: descreverFalhaDaD4Sign(erro) }
    }

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
    // ─────────────────────────────────────────────────────────────────────
    // createlist NÃO É IDEMPOTENTE NA D4Sign: cada chamada ACRESCENTA
    // signatários à lista do documento, nunca substitui os que já estão lá.
    //
    // Sem esta trava, um retry depois de `mandarAssinar` falhar (por
    // exemplo, a instabilidade corrigida em 16-17/09/2026) cadastrava os
    // MESMOS dois signatários de novo — e de novo a cada nova tentativa —,
    // deixando o documento com sósias duplicados. O signatário do escritório
    // tem conta na D4Sign e ela absorveu os duplicados sem avisar; o
    // signatário externo (sem conta, `foreign`) ganhou vagas "a assinar"
    // extras que ninguém jamais completaria — e o documento nunca fechava
    // 100%, mesmo com as duas partes de verdade já tendo assinado.
    //
    // `signatariosJaDefinidos` é a memória de que esse passo já funcionou
    // para ESTE envio: um retry só repete o que realmente falhou antes.
    // ─────────────────────────────────────────────────────────────────────
    if (!signatariosJaDefinidos) {
      await definirSignatarios(
        configuracao,
        uuid,
        preparo.partes.map((parte) => ({
          email: (parte.email ?? '').trim(),
          acao: ACAO_ASSINAR,
        })),
      )

      // Gravado imediatamente, antes de `mandarAssinar`: se o próximo passo
      // falhar, o retry seguinte já sabe que não deve repetir este.
      await prisma.envioParaAssinatura.update({
        where: { id: envioId },
        data: { signatariosDefinidosEm: new Date() },
      })
    }

    // Onde cada um assina. Desligado por padrão (ver
    // `posicao-da-assinatura.ts`); ligado, uma falha aqui PARA o envio antes
    // do passo que cobra — carimbo fora do lugar é o defeito que se quer evitar.
    if (posicionamentoLigado() && !posicoesJaDefinidas) {
      const pdf = await lerArquivo(documento.chaveArquivo)
      const paginas = await lerPaginasDoPdf(pdf)
      await posicionarAssinaturas(
        configuracao,
        uuid,
        pinsDoEnvio(documento.tipo, preparo.partes, avulsos, paginas, ajusteDoAmbiente()),
      )

      await prisma.envioParaAssinatura.update({
        where: { id: envioId },
        data: { posicoesDefinidasEm: new Date() },
      })
    }

    // O passo que cobra. Depois dele não há volta: o e-mail já saiu.
    await mandarAssinar(
      configuracao,
      uuid,
      mensagemDoEnvio(documento.tipo, preparo.documento.clienteNome),
    )
  } catch (erro) {
    const motivo = descreverFalhaDaD4Sign(erro)

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
  // Um crédito acabou de ser gasto: o saldo guardado ficou velho.
  esquecerSaldo()

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
  | { situacao: 'falha_na_d4sign'; motivo: string }

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

  const envio = await prisma.envioParaAssinatura.findFirst({
    // Regra 2: o envio só é alcançável se o documento dele for alcançável.
    where: { id: envioId, documento: filtroDeDocumentos(sessao) },
    select: {
      id: true,
      provedor: true,
      uuidDocumento: true,
      documentoAssinadoId: true,
      situacao: true,
      documento: {
        select: {
          id: true,
          nome: true,
          tipo: true,
          casoId: true,
          clienteId: true,
          chaveArquivo: true,
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

  // Cancelado não volta a andar: não gasta chamada da chave de API perguntando
  // de novo (18/11/2026). NO_COFRE continua perguntando — um envio pode ter
  // saído na D4Sign mesmo com a resposta perdida no caminho.
  if (envio.situacao === SituacaoDoEnvio.CANCELADO) return { situacao: 'cancelado' }

  // Cada envio é conferido na plataforma que o recebeu (11/2026).
  if (envio.provedor === ProvedorAssinatura.ZAPSIGN) {
    return conferirNaZapSign(sessao, envio, emailDoAutor)
  }

  const configuracao = configuracaoD4Sign()
  if (configuracao === null) return { situacao: 'sem_integracao' }

  let naD4Sign: Awaited<ReturnType<typeof consultarDocumento>>
  try {
    naD4Sign = await consultarDocumento(configuracao, envio.uuidDocumento)
  } catch (erro) {
    return { situacao: 'falha_na_d4sign', motivo: descreverFalhaDaD4Sign(erro) }
  }
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

  return arquivarAssinado(
    sessao,
    () => baixarAssinado(configuracao, envio.uuidDocumento),
    ProvedorAssinatura.D4SIGN,
    envio,
    emailDoAutor,
    agora,
  )
}

/**
 * O aviso automático da D4Sign (25/09/2026): quando alguém assina, ela chama o
 * endereço de retorno do cofre (`/api/d4sign/retorno`) e esta função confere
 * aquele documento — a mesma conferência do botão "Conferir assinatura", sem
 * ninguém apertar nada.
 *
 * Nada do que a D4Sign manda é tomado por verdade: o corpo do aviso só diz QUAL
 * documento olhar, e a situação de verdade vem da pergunta que o portal faz de
 * volta (`consultarDocumento`). Um aviso forjado, no máximo, faz o portal
 * perguntar à D4Sign algo que ela responderia de qualquer jeito.
 *
 * Quem "assinou" a ação, para a auditoria (regra 6), é quem pediu o envio —
 * o registro diz que veio do retorno automático.
 */
export async function conferirAssinaturaPorRetorno(
  uuidDocumento: string,
): Promise<ResultadoDaConferencia> {
  const envio = await prisma.envioParaAssinatura.findUnique({
    where: { uuidDocumento },
    select: { id: true, pedidoPorId: true, provedor: true },
  })
  if (envio === null) return { situacao: 'nao_encontrado' }

  // Quem pediu o envio; se essa pessoa não existe mais, um administrador ativo
  // — a auditoria precisa de alguém, e o registro diz que veio do retorno.
  const autorId =
    envio.pedidoPorId ??
    (
      await prisma.usuario.findFirst({
        where: { perfil: PerfilUsuario.ADMINISTRADOR, situacao: 'ATIVO' },
        select: { id: true },
      })
    )?.id
  if (autorId === undefined) return { situacao: 'nao_encontrado' }

  const sessaoDoPedido: SessaoServidor = {
    usuarioId: autorId,
    perfil: PerfilUsuario.OPERADOR,
    clienteId: null,
    contratoAssinado: false,
  }

  return conferirAssinatura(
    sessaoDoPedido,
    envio.id,
    `retorno automático da ${NOME_DO_PROVEDOR[envio.provedor]}`,
  )
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
    chaveArquivo: string
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
  baixar: () => Promise<Uint8Array | null>,
  provedor: ProvedorAssinatura,
  envio: EnvioParaArquivar,
  emailDoAutor: string | null,
  agora: Date,
): Promise<ResultadoDaConferencia> {
  const pdf = await baixar()

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

  // O que voltou tem que ser o documento assinado COMPLETO, e não só o
  // certificado de assinaturas (reportado pelo escritório em 25/09/2026). Se
  // parecer só o certificado, NADA é arquivado: um arquivo errado na pasta como
  // "assinado" é pior do que nenhum, e a tela diz o motivo.
  const veredito = assinadoEstaCompleto(
    await resumirPdf(await lerArquivo(envio.documento.chaveArquivo)),
    await resumirPdf(pdf),
  )
  if (!veredito.completo) {
    await prisma.envioParaAssinatura.update({
      where: { id: envio.id },
      data: { situacaoNaD4Sign: veredito.motivo, conferidoEm: agora },
    })
    return { situacao: 'desconhecida', situacaoNaD4Sign: veredito.motivo }
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
          origem:
            provedor === ProvedorAssinatura.ZAPSIGN
              ? OrigemDoDocumento.ASSINADO_NA_ZAPSIGN
              : OrigemDoDocumento.ASSINADO_NA_D4SIGN,
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
            origem:
              provedor === ProvedorAssinatura.ZAPSIGN ? 'assinado_na_zapsign' : 'assinado_na_d4sign',
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

// ---------------------------------------------------------------------------
// ZapSign (11/2026) — o envio, a conferência e o reenvio do que ficou na D4Sign
// ---------------------------------------------------------------------------

/**
 * A âncora de cada parte no PDF: o texto invisível que os modelos já deixam
 * no lugar da assinatura (`.marca-de-assinatura`). A ZapSign desenha a
 * assinatura em cima dele. Testemunha do contrato e signatário de documento
 * avulso não têm âncora: o avulso vai por coordenada (`rubricasDosAvulsos`),
 * e a testemunha fica no relatório de assinaturas. Função pura.
 */
export function ancoraDaParte(tipo: TipoDocumento, parte: ParteQueAssina): string | null {
  if (tipo === TipoDocumento.ANEXO) return null
  if (parte.papel === 'escritorio') return '[[assina:escritorio]]'
  if (parte.papel === 'cliente' || parte.papel === 'representante') return '[[assina:parte]]'
  return null
}

/**
 * Onde cada signatário de documento AVULSO assina na ZapSign: a escolha da
 * tela ou, sem escolha, o mesmo padrão de sempre (última página, perto do pé,
 * um ao lado do outro). Função pura.
 */
export function rubricasDosAvulsos(
  partes: readonly ParteQueAssina[],
  avulsos: readonly SignatarioAvulso[],
  totalDePaginas: number,
  tokens: readonly { email: string; token: string }[],
): zapsign.Rubrica[] {
  const rubricas: zapsign.Rubrica[] = []
  partes.forEach((parte, indice) => {
    const email = (parte.email ?? '').trim().toLowerCase()
    const token = tokens.find((t) => t.email === email)?.token
    if (email === '' || token === undefined) return
    const escolhida = avulsos.find((avulso) => avulso.email === email)?.posicao
    rubricas.push(zapsign.rubricaDaPosicao(escolhida ?? posicaoPadrao(indice), totalDePaginas, token))
  })
  return rubricas
}

type DocumentoDoEnvio = {
  id: string
  nome: string
  tipo: TipoDocumento
  chaveArquivo: string
  clienteId: string
}

/**
 * O envio pela ZapSign. Uma chamada cria o documento JÁ com os signatários e
 * dispara os convites — não existe "subiu e não saiu" para retomar. Todo
 * documento criado conta no plano, por isso tudo o que pode recusar já foi
 * conferido em `prepararEnvio`.
 */
async function enviarPelaZapSign(
  sessao: SessaoServidor,
  documento: DocumentoDoEnvio,
  preparo: Extract<ResultadoDoPreparo, { situacao: 'pronto' }>,
  avulsos: readonly SignatarioAvulso[],
  emailDoAutor: string | null,
): Promise<ResultadoDoEnvio> {
  const pdf = await lerArquivo(documento.chaveArquivo)
  const partesParaGravar = preparo.partes.map((parte) => ({ ...parte }))

  let criado: zapsign.DocumentoCriado
  try {
    criado = await zapsign.criarDocumento({
      nome: `${ROTULO_DO_TIPO[documento.tipo]} — ${preparo.documento.clienteNome}`,
      pdf,
      idExterno: documento.id,
      mensagem: mensagemDoEnvio(documento.tipo, preparo.documento.clienteNome),
      signatarios: preparo.partes.map((parte) => ({
        nome: parte.nome,
        email: (parte.email ?? '').trim().toLowerCase(),
        qualificacao: ROTULO_DO_PAPEL[parte.papel],
        ancora: ancoraDaParte(documento.tipo, parte),
      })),
    })
  } catch (erro) {
    // Mesmo resultado da D4Sign "antes de subir": nada saiu daqui.
    return { situacao: 'falha_na_d4sign', motivo: zapsign.descreverFalhaDaZapSign(erro) }
  }

  const agora = new Date()
  let envioId: string
  try {
    const gravado = await prisma.envioParaAssinatura.create({
      data: {
        documentoId: documento.id,
        provedor: ProvedorAssinatura.ZAPSIGN,
        uuidDocumento: criado.token,
        cofre: 'zapsign',
        situacao: SituacaoDoEnvio.AGUARDANDO,
        signatarios: partesParaGravar,
        pedidoPorId: sessao.usuarioId,
        enviadoEm: agora,
        signatariosDefinidosEm: agora,
      },
      select: { id: true },
    })
    envioId = gravado.id
  } catch (erro) {
    // O documento já existe na ZapSign e os convites saíram: o identificador
    // vai para o log, para ninguém mandar de novo sem olhar o painel deles.
    console.error(`Envio criado na ZapSign (${criado.token}) mas não gravado no portal.`, erro)
    throw erro
  }

  // Documento avulso: a posição de cada um vai por coordenada, logo depois de
  // criar. Se falhar, o envio já saiu — fica registrado, e quem assina sem
  // posição aparece no relatório de assinaturas.
  if (documento.tipo === TipoDocumento.ANEXO) {
    try {
      const paginas = await lerPaginasDoPdf(pdf)
      await zapsign.posicionarAssinaturas(
        criado.token,
        rubricasDosAvulsos(preparo.partes, avulsos, paginas.length, criado.signatarios),
      )
      await prisma.envioParaAssinatura.update({
        where: { id: envioId },
        data: { posicoesDefinidasEm: new Date() },
      })
    } catch (erro) {
      await prisma.envioParaAssinatura.update({
        where: { id: envioId },
        data: {
          situacaoNaD4Sign: `Enviado, mas a posição das assinaturas não foi definida: ${zapsign.descreverFalhaDaZapSign(erro)}`,
        },
      })
    }
  }

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
      provedor: ProvedorAssinatura.ZAPSIGN,
      signatarios: preparo.partes.map((parte) => ({ papel: parte.papel, email: parte.email })),
    },
  })

  return { situacao: 'enviado', envioId }
}

/** A conferência de um envio feito pela ZapSign — mesma regra da D4Sign. */
async function conferirNaZapSign(
  sessao: SessaoServidor,
  envio: EnvioParaArquivar,
  emailDoAutor: string | null,
): Promise<ResultadoDaConferencia> {
  if (!zapsign.zapsignAtiva()) return { situacao: 'sem_integracao' }

  let naZapSign: zapsign.DocumentoNaZapSign | null
  try {
    naZapSign = await zapsign.consultarDocumento(envio.uuidDocumento)
  } catch (erro) {
    return { situacao: 'falha_na_d4sign', motivo: zapsign.descreverFalhaDaZapSign(erro) }
  }
  const agora = new Date()

  if (naZapSign === null) {
    await prisma.envioParaAssinatura.update({ where: { id: envio.id }, data: { conferidoEm: agora } })
    return { situacao: 'nao_encontrado' }
  }

  if (naZapSign.situacao === 'cancelado') {
    await prisma.envioParaAssinatura.update({
      where: { id: envio.id },
      data: {
        situacao: SituacaoDoEnvio.CANCELADO,
        situacaoNaD4Sign: naZapSign.situacaoBruta,
        conferidoEm: agora,
      },
    })
    return { situacao: 'cancelado' }
  }

  if (naZapSign.situacao === 'aguardando') {
    await prisma.envioParaAssinatura.update({
      where: { id: envio.id },
      data: {
        situacaoNaD4Sign: `${naZapSign.assinaram} de ${naZapSign.totalSignatarios} assinaram`,
        conferidoEm: agora,
      },
    })
    return { situacao: 'aguardando' }
  }

  return arquivarAssinado(
    sessao,
    () => zapsign.baixarAssinado(envio.uuidDocumento),
    ProvedorAssinatura.ZAPSIGN,
    envio,
    emailDoAutor,
    agora,
  )
}

/** Papéis que vêm de fora (tela), e não da regra fixa de quem assina. */
const PAPEIS_AVULSOS = new Set<string>(Object.values(PapelDaParte))

export type ResultadoDoReenvio =
  | ResultadoDoEnvio
  | { situacao: 'zapsign_desligada' }
  | { situacao: 'nada_a_reenviar' }

/**
 * Reenvia pela ZapSign um documento cujo envio está pendente na D4Sign.
 *
 * Decisão do grupo do escritório (11/2026): reenviar tudo pela ZapSign, mas
 * só com ela 100% pronta — por isso nada acontece sem `zapsignLigada()`. A
 * ordem protege o cliente de receber dois convites válidos ao mesmo tempo:
 *
 *   1. o envio da D4Sign é marcado CANCELADO aqui (libera o documento);
 *   2. sai o envio novo pela ZapSign, com as mesmas pessoas;
 *   3. só se ele saiu, o documento é cancelado na D4Sign. Se não saiu, o envio
 *      antigo volta a valer e nada na D4Sign é tocado.
 *
 * Cancelar na D4Sign não apaga nada (pedido de 14/09/2026). Se a D4Sign não
 * deixar cancelar, fica registrado para cancelar pelo painel dela.
 */
export async function reenviarPelaZapSign(
  sessao: SessaoServidor,
  documentoId: string,
  emailDoAutor: string | null,
): Promise<ResultadoDoReenvio> {
  exigirEquipe(sessao)
  if (!zapsignLigada()) return { situacao: 'zapsign_desligada' }

  const antigo = await envioDoDocumento(sessao, documentoId)
  if (
    antigo === null ||
    antigo.provedor !== ProvedorAssinatura.D4SIGN ||
    antigo.situacao !== SituacaoDoEnvio.AGUARDANDO
  ) {
    return { situacao: 'nada_a_reenviar' }
  }

  const linhaAntiga = await prisma.envioParaAssinatura.findUnique({
    where: { id: antigo.id },
    select: { uuidDocumento: true, situacaoNaD4Sign: true },
  })
  if (linhaAntiga === null) return { situacao: 'nada_a_reenviar' }

  // As mesmas pessoas de fora (testemunhas, signatários do avulso). Cliente,
  // representante e escritório vêm da regra de sempre, em `prepararEnvio`.
  const avulsos: SignatarioAvulso[] = antigo.partes
    .filter((parte) => PAPEIS_AVULSOS.has(parte.papel) && (parte.email ?? '').trim() !== '')
    .map((parte) => ({
      nome: parte.nome,
      email: (parte.email ?? '').trim().toLowerCase(),
      papel: parte.papel as PapelDaParte,
    }))

  await prisma.envioParaAssinatura.update({
    where: { id: antigo.id },
    data: { situacao: SituacaoDoEnvio.CANCELADO, situacaoNaD4Sign: 'reenviando pela ZapSign' },
  })

  const novo = await enviarParaAssinatura(sessao, documentoId, emailDoAutor, avulsos).catch(
    async (erro: unknown) => {
      await prisma.envioParaAssinatura.update({
        where: { id: antigo.id },
        data: { situacao: SituacaoDoEnvio.AGUARDANDO, situacaoNaD4Sign: linhaAntiga.situacaoNaD4Sign },
      })
      throw erro
    },
  )

  if (novo.situacao !== 'enviado') {
    // Não saiu: o envio da D4Sign volta a valer, e nada lá foi tocado.
    await prisma.envioParaAssinatura.update({
      where: { id: antigo.id },
      data: { situacao: SituacaoDoEnvio.AGUARDANDO, situacaoNaD4Sign: linhaAntiga.situacaoNaD4Sign },
    })
    return novo
  }

  let canceladoNaD4Sign = false
  const configuracao = configuracaoD4Sign()
  if (configuracao !== null) {
    try {
      await cancelarNaD4Sign(configuracao, linhaAntiga.uuidDocumento, 'Reenviado pela ZapSign.')
      canceladoNaD4Sign = true
    } catch {
      // Limite da chave ou instabilidade: registrado abaixo para o painel.
    }
  }

  await prisma.envioParaAssinatura.update({
    where: { id: antigo.id },
    data: {
      situacaoNaD4Sign: canceladoNaD4Sign
        ? 'cancelado na D4Sign: reenviado pela ZapSign'
        : 'reenviado pela ZapSign — cancele este documento no painel da D4Sign',
    },
  })

  await registrarAuditoria({
    usuarioId: sessao.usuarioId,
    usuarioEmail: emailDoAutor,
    acao: AcaoAuditoria.ATUALIZACAO,
    entidade: 'envio_para_assinatura',
    entidadeId: antigo.id,
    detalhes: {
      documentoId,
      resultado: 'reenviado_pela_zapsign',
      envioNovoId: novo.envioId,
      canceladoNaD4Sign,
    },
  })

  return novo
}

/** O botão de reenvio aparece só para isto. Função pura. */
export function podeReenviarPelaZapSign(
  envio: Pick<EnvioEmAndamento, 'provedor' | 'situacao'> | null,
  ligada: boolean,
): boolean {
  return (
    ligada &&
    envio !== null &&
    envio.provedor === ProvedorAssinatura.D4SIGN &&
    envio.situacao === SituacaoDoEnvio.AGUARDANDO
  )
}
