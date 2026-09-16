/**
 * D4Sign — a assinatura eletrônica (Anexo II, item 3.4, resolvido).
 *
 * Esta camada só fala com a API. Ela não decide quem pode enviar o quê: isso é
 * de `src/lib/assinaturas.ts`, que passa pelos filtros da sessão antes de
 * chegar aqui. Aqui é o "como", nunca o "quem pode" — o mesmo desenho de
 * `armazenamento.ts`.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DUAS COISAS QUE CUSTAM DINHEIRO DE VERDADE
 *
 * 1. O escritório usa token de PRODUÇÃO. Não existe modo de ensaio: todo envio
 *    manda e-mail de assinatura para quem estiver na lista, de verdade.
 * 2. Cada envio consome um crédito da conta do escritório — custo de terceiro
 *    da Cláusula 6ª, não do desenvolvimento. `saldo()` existe para que isso
 *    apareça na tela antes de alguém descobrir pela fatura.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Autenticação: a D4Sign não usa cabeçalho, e sim `tokenAPI` e `cryptKey` na
 * query. Por isso nenhuma URL montada aqui pode ir para log ou mensagem de
 * erro — ela carrega as duas credenciais inteiras. Ver `semCredenciais`.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ESTE ARQUIVO NÃO APAGA NADA, E NÃO DEVE PASSAR A APAGAR
 *
 * O cofre usado é um cofre que já existia, com documentos do escritório —
 * pedido expresso de 14/09/2026: "apenas não exclua nada que tem ali".
 *
 * Não há aqui, e não pode haver, chamada de exclusão: nem de documento, nem de
 * cofre, nem de signatário. O que este arquivo faz no cofre é acrescentar.
 * Se algum dia parecer necessário apagar, pare e avise — documento assinado é
 * prova, e prova apagada não volta.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { Buffer } from 'node:buffer'

export type ConfiguracaoD4Sign = {
  url: string
  tokenApi: string
  cryptKey: string
  /** Cofre em que os documentos são criados. Pode estar vazio até escolherem. */
  cofre: string
}

function variavel(nome: string): string {
  return (process.env[nome] ?? '').trim()
}

/**
 * Lê a configuração, ou null se as credenciais não estiverem completas. Null
 * não é erro: é o estado normal de uma instalação que ainda não assina.
 */
export function configuracaoD4Sign(): ConfiguracaoD4Sign | null {
  const url = variavel('D4SIGN_URL') || 'https://secure.d4sign.com.br/api/v1'
  const tokenApi = variavel('D4SIGN_TOKEN_API')
  const cryptKey = variavel('D4SIGN_CRYPT_KEY')

  if (tokenApi === '' || cryptKey === '') return null

  return {
    url: url.replace(/\/+$/, ''),
    tokenApi,
    cryptKey,
    cofre: variavel('D4SIGN_COFRE'),
  }
}

/**
 * Tira as credenciais de qualquer texto antes de ele virar log ou mensagem.
 *
 * A API devolve, em alguns erros, a própria URL chamada — com o token e a
 * cryptKey dentro. Sem esta limpeza, um erro de rede escreveria as duas no
 * log do servidor, e log é lido por mais gente do que cofre (regra 8).
 */
function semCredenciais(texto: string, configuracao: ConfiguracaoD4Sign): string {
  return texto
    .split(configuracao.tokenApi)
    .join('«tokenAPI»')
    .split(configuracao.cryptKey)
    .join('«cryptKey»')
}

export class FalhaNaD4Sign extends Error {
  constructor(
    readonly situacao: number,
    mensagem: string,
  ) {
    super(mensagem)
    this.name = 'FalhaNaD4Sign'
  }
}

function endereco(
  configuracao: ConfiguracaoD4Sign,
  caminho: string,
  extra?: Record<string, string>,
): string {
  const parametros = new URLSearchParams({
    tokenAPI: configuracao.tokenApi,
    cryptKey: configuracao.cryptKey,
    ...extra,
  })
  return `${configuracao.url}${caminho}?${parametros.toString()}`
}

async function chamar<T>(
  configuracao: ConfiguracaoD4Sign,
  caminho: string,
  opcoes: { metodo?: string; corpo?: unknown; multipart?: FormData } = {},
): Promise<T> {
  const resposta = await fetch(endereco(configuracao, caminho), {
    method: opcoes.metodo ?? 'GET',
    headers: {
      Accept: 'application/json',
      ...(opcoes.corpo === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(opcoes.multipart !== undefined
      ? { body: opcoes.multipart }
      : opcoes.corpo === undefined
        ? {}
        : { body: JSON.stringify(opcoes.corpo) }),
  })

  const texto = await resposta.text()

  if (!resposta.ok) {
    throw new FalhaNaD4Sign(
      resposta.status,
      // A resposta pode ecoar a URL chamada, credenciais inclusive.
      semCredenciais(texto.slice(0, 500), configuracao),
    )
  }

  try {
    return JSON.parse(texto) as T
  } catch {
    throw new FalhaNaD4Sign(resposta.status, 'A D4Sign respondeu algo que não é JSON.')
  }
}

// ---------------------------------------------------------------------------
// Leitura — nada aqui consome crédito
// ---------------------------------------------------------------------------

export type Cofre = { uuid: string; nome: string }

export async function listarCofres(configuracao: ConfiguracaoD4Sign): Promise<Cofre[]> {
  const bruto = await chamar<{ uuid_safe: string; 'name-safe': string }[]>(
    configuracao,
    '/safes',
  )

  return bruto.map((cofre) => ({
    uuid: cofre.uuid_safe,
    nome: (cofre['name-safe'] ?? '').trim(),
  }))
}

export type Saldo = {
  creditos: number
  usados: number
  /** O que sobra. É este número que interessa antes de mandar assinar. */
  restantes: number
}

export async function saldo(configuracao: ConfiguracaoD4Sign): Promise<Saldo> {
  const bruto = await chamar<{ credit?: string | number; sent?: string | number }>(
    configuracao,
    '/account/balance',
  )

  const creditos = Number(bruto.credit ?? 0)
  const usados = Number(bruto.sent ?? 0)

  return {
    creditos: Number.isFinite(creditos) ? creditos : 0,
    usados: Number.isFinite(usados) ? usados : 0,
    restantes: Math.max(0, (Number.isFinite(creditos) ? creditos : 0) - (Number.isFinite(usados) ? usados : 0)),
  }
}

/** Situações que a D4Sign devolve, traduzidas para o que o painel mostra. */
export type SituacaoNaD4Sign =
  | 'aguardando'
  | 'assinado'
  | 'cancelado'
  | 'desconhecida'

function traduzirSituacao(bruta: string): SituacaoNaD4Sign {
  const texto = bruta.toLowerCase()
  if (texto.includes('finaliz') || texto.includes('assinad')) return 'assinado'
  if (texto.includes('cancel')) return 'cancelado'
  if (texto.includes('aguard') || texto.includes('process')) return 'aguardando'
  return 'desconhecida'
}

export type DocumentoNaD4Sign = {
  uuid: string
  nome: string
  situacao: SituacaoNaD4Sign
  situacaoBruta: string
}

export async function consultarDocumento(
  configuracao: ConfiguracaoD4Sign,
  uuid: string,
): Promise<DocumentoNaD4Sign | null> {
  const bruto = await chamar<
    { uuidDoc?: string; nameDoc?: string; statusName?: string }[]
  >(configuracao, `/documents/${uuid}`)

  const documento = bruto.find((item) => item.uuidDoc !== undefined)
  if (documento === undefined) return null

  const situacaoBruta = documento.statusName ?? ''

  return {
    uuid: documento.uuidDoc ?? uuid,
    nome: documento.nameDoc ?? '',
    situacao: traduzirSituacao(situacaoBruta),
    situacaoBruta,
  }
}

// ---------------------------------------------------------------------------
// Escrita — daqui para baixo, consome crédito e manda e-mail de verdade
// ---------------------------------------------------------------------------

export type Signatario = {
  email: string
  /**
   * O papel na D4Sign. "1" é assinar; os demais códigos são aprovar,
   * reconhecer, testemunhar. Quem escolhe é `src/lib/assinaturas.ts`.
   */
  acao: string
}

/**
 * Sobe o PDF para o cofre. **Ainda não manda assinar** — só cria o documento.
 *
 * Separado do envio de propósito: se a lista de signatários for recusada, o
 * documento fica no cofre para alguém olhar, em vez de o erro apagar o
 * rastro do que foi tentado.
 */
export async function subirDocumento(
  configuracao: ConfiguracaoD4Sign,
  cofre: string,
  nome: string,
  pdf: Uint8Array,
): Promise<string> {
  const formulario = new FormData()
  formulario.append(
    'file',
    new Blob([Buffer.from(pdf)], { type: 'application/pdf' }),
    nome.toLowerCase().endsWith('.pdf') ? nome : `${nome}.pdf`,
  )

  const resposta = await chamar<{ uuid?: string; message?: string }>(
    configuracao,
    `/documents/${cofre}/upload`,
    { metodo: 'POST', multipart: formulario },
  )

  if (resposta.uuid === undefined || resposta.uuid === '') {
    throw new FalhaNaD4Sign(200, `A D4Sign não devolveu o documento: ${resposta.message ?? ''}`)
  }

  return resposta.uuid
}

export async function definirSignatarios(
  configuracao: ConfiguracaoD4Sign,
  uuidDocumento: string,
  signatarios: readonly Signatario[],
): Promise<void> {
  // A resposta vem em formatos diferentes conforme a versão da API aceita a
  // chamada ou recusa algum signatário — por isso `unknown[]`, e não um tipo
  // fixo. O que importa aqui é só: veio pelo menos uma entrada por
  // signatário mandado? Menos que isso é a D4Sign aceitando o HTTP 200 e
  // descartando por baixo os signatários que não bateram com o formato
  // esperado — e foi exatamente isto que aconteceu com o campo `foreign`
  // grafado errado (`foresign`) até esta correção: a lista de signatários
  // ficava vazia no documento, e só o passo seguinte (`sendtosigner`)
  // acusava "This file not have signers", sem apontar para a causa real.
  const resposta = await chamar<unknown>(
    configuracao,
    `/documents/${uuidDocumento}/createlist`,
    {
      metodo: 'POST',
      corpo: {
        signers: signatarios.map((signatario) => ({
          email: signatario.email,
          act: signatario.acao,
          foreign: '0',
          certificadoicpbr: '0',
          assinatura_presencial: '0',
          docauth: '0',
          docauthandselfie: '0',
          embed_methodauth: 'email',
          embed_smsnumber: '',
          upload_allow: '0',
          upload_obs: '0',
        })),
      },
    },
  )

  if (!Array.isArray(resposta) || resposta.length < signatarios.length) {
    throw new FalhaNaD4Sign(
      200,
      `A D4Sign aceitou a chamada mas não cadastrou todos os signatários: ${JSON.stringify(resposta).slice(0, 300)}`,
    )
  }
}

/** O passo que consome o crédito e dispara os e-mails. */
export async function mandarAssinar(
  configuracao: ConfiguracaoD4Sign,
  uuidDocumento: string,
  mensagem: string,
): Promise<void> {
  await chamar(configuracao, `/documents/${uuidDocumento}/sendtosigner`, {
    metodo: 'POST',
    corpo: {
      message: mensagem,
      // "0": todos assinam ao mesmo tempo, sem ordem obrigatória.
      workflow: '0',
      skip_email: '0',
    },
  })
}

/** O endereço temporário do PDF assinado, para o sistema arquivá-lo. */
export async function enderecoDoAssinado(
  configuracao: ConfiguracaoD4Sign,
  uuidDocumento: string,
): Promise<string | null> {
  const resposta = await chamar<{ url?: string }>(
    configuracao,
    `/documents/${uuidDocumento}/download`,
    { metodo: 'POST', corpo: { type: 'PDF', language: 'pt' } },
  )

  return resposta.url ?? null
}

/**
 * O PDF assinado, em bytes, pronto para ser arquivado na pasta do cliente.
 *
 * São duas etapas porque a D4Sign devolve um endereço temporário em vez do
 * arquivo: primeiro se pede o endereço, depois se busca o conteúdo. O endereço
 * é de uso único e curto — não se guarda, não se mostra na tela e não vai para
 * o banco.
 *
 * O teto de tamanho não é desconfiança da D4Sign: é que este conteúdo entra
 * inteiro na memória do servidor, e um limite explícito é mais barato do que
 * descobrir o problema com o processo derrubado.
 */
export const TAMANHO_MAXIMO_DO_ASSINADO = 40 * 1024 * 1024

export async function baixarAssinado(
  configuracao: ConfiguracaoD4Sign,
  uuidDocumento: string,
): Promise<Uint8Array | null> {
  const url = await enderecoDoAssinado(configuracao, uuidDocumento)
  if (url === null || url === '') return null

  const resposta = await fetch(url)

  if (!resposta.ok) {
    // A URL vem da D4Sign e pode ir para o log: ela não carrega as credenciais
    // (elas ficam na chamada anterior), mas dá acesso ao documento assinado.
    // Por isso a mensagem diz o que houve sem repetir o endereço.
    throw new FalhaNaD4Sign(
      resposta.status,
      'A D4Sign deu um endereço para o documento assinado, mas ele não abriu.',
    )
  }

  const declarado = Number(resposta.headers.get('content-length') ?? '')
  if (Number.isFinite(declarado) && declarado > TAMANHO_MAXIMO_DO_ASSINADO) {
    throw new FalhaNaD4Sign(200, 'O documento assinado é grande demais.')
  }

  const conteudo = new Uint8Array(await resposta.arrayBuffer())

  if (conteudo.byteLength > TAMANHO_MAXIMO_DO_ASSINADO) {
    throw new FalhaNaD4Sign(200, 'O documento assinado é grande demais.')
  }

  return conteudo
}
