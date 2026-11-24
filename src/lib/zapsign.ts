/**
 * Cliente da API de assinatura eletrônica da ZapSign.
 *
 * O escritório trocou a D4Sign pela ZapSign em 11/2026: o pacote da D4Sign
 * esgotou, o limite de chamadas travava o envio e as assinaturas saíam fora
 * do lugar. A Consensus One (outro sistema do mesmo grupo) fez a mesma troca
 * antes, e este cliente segue o mesmo desenho. Os envios antigos terminam na
 * D4Sign (`src/lib/d4sign.ts`); `EnvioParaAssinatura.provedor` diz quem é quem.
 *
 * Documentação: https://docs.zapsign.com.br
 *   criar        POST /docs/                         PDF em base64, signatários junto
 *   posicionar   POST /docs/{token}/place-signatures/ coordenadas em % da página
 *   detalhar     GET  /docs/{token}/                 status, signatários, signed_file
 *   plano        GET  /info-plan/                    só leitura, não gasta documento
 *
 * Diferenças da D4Sign que mudam o desenho:
 *
 *   1. CRIAR JÁ ENVIA. Não existe "subiu ao cofre e não saiu": o documento
 *      nasce com os signatários e os convites partem na mesma chamada.
 *   2. TODO DOCUMENTO CRIADO CONTA NO PLANO, mesmo nunca assinado. Por isso
 *      todas as recusas (sem e-mail, já enviado…) acontecem antes daqui.
 *   3. O AVISO (webhook) NÃO É ASSINADO. Do corpo só se lê qual documento; o
 *      estado vem sempre de `consultarDocumento`, autenticado.
 *   4. O LINK DO PDF ASSINADO EXPIRA EM 60 MINUTOS: baixa-se na hora, com o
 *      link de uma consulta nova, e ele nunca é gravado.
 *   5. Não há cofre nem saldo por chamada: o plano é por documentos no mês.
 *
 * O token vai no cabeçalho Authorization, nunca na URL (regra 8).
 * OPCIONAL, como a D4Sign: sem ZAPSIGN_API_TOKEN nada aqui é chamado.
 */

const BASE_PADRAO = 'https://api.zapsign.com.br/api/v1'
const TEMPO_LIMITE_MS = 30_000
/** Mesmo teto do assinado da D4Sign. */
export const TAMANHO_MAXIMO_DO_ASSINADO = 40 * 1024 * 1024
/** A ZapSign recusa algumas chamadas sem User-Agent. */
const AGENTE = 'PortalEFerreira/1.0'

function variavel(nome: string): string {
  return (process.env[nome] ?? '').trim()
}

function base(): string {
  return (variavel('ZAPSIGN_BASE_URL') || BASE_PADRAO).replace(/\/+$/, '')
}

export function zapsignAtiva(): boolean {
  return variavel('ZAPSIGN_API_TOKEN') !== ''
}

type Etapa = 'criar' | 'posicionar' | 'consultar' | 'baixar' | 'plano'

const ROTULO_DA_ETAPA: Record<Etapa, string> = {
  criar: 'na criação do documento',
  posicionar: 'no posicionamento das assinaturas',
  consultar: 'na consulta do documento',
  baixar: 'no download do assinado',
  plano: 'na consulta do plano',
}

/** Erro técnico. `descreverFalhaDaZapSign` traduz para a tela. */
export class FalhaNaZapSign extends Error {
  constructor(
    readonly situacao: number,
    readonly corpo: string,
    readonly etapa: Etapa,
    mensagem?: string,
  ) {
    super(mensagem ?? `ZapSign respondeu ${situacao} (${etapa}): ${corpo.slice(0, 300)}`)
    this.name = 'FalhaNaZapSign'
  }
}

async function chamar<T>(
  caminho: string,
  etapa: Etapa,
  opcoes: { metodo?: 'GET' | 'POST'; corpo?: unknown } = {},
): Promise<T> {
  const resposta = await fetch(`${base()}${caminho}`, {
    method: opcoes.metodo ?? (opcoes.corpo === undefined ? 'GET' : 'POST'),
    headers: {
      Authorization: `Bearer ${variavel('ZAPSIGN_API_TOKEN')}`,
      'User-Agent': AGENTE,
      Accept: 'application/json',
      ...(opcoes.corpo === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(opcoes.corpo === undefined ? {} : { body: JSON.stringify(opcoes.corpo) }),
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
  })

  const texto = await resposta.text()
  if (!resposta.ok) throw new FalhaNaZapSign(resposta.status, texto.slice(0, 500), etapa)

  try {
    return (texto === '' ? {} : JSON.parse(texto)) as T
  } catch {
    throw new FalhaNaZapSign(resposta.status, '', etapa, 'A ZapSign respondeu algo que não é JSON.')
  }
}

// ---------------------------------------------------------------------------
// Signatários e envio
// ---------------------------------------------------------------------------

/** Formas de identificação aceitas pela ZapSign (ZAPSIGN_AUTENTICACAO). */
export const MODOS_DE_AUTENTICACAO = [
  'assinaturaTela',
  'tokenEmail',
  'assinaturaTela-tokenEmail',
  'tokenSms',
  'assinaturaTela-tokenSms',
  'tokenWhatsapp',
  'assinaturaTela-tokenWhatsapp',
  'certificadoDigital',
] as const

export type ModoDeAutenticacao = (typeof MODOS_DE_AUTENTICACAO)[number]

/** Assinatura na tela + código por e-mail: sem custo extra por assinatura. */
export const AUTENTICACAO_PADRAO: ModoDeAutenticacao = 'assinaturaTela-tokenEmail'

export function modoDeAutenticacao(
  valor: string | undefined = process.env['ZAPSIGN_AUTENTICACAO'],
): ModoDeAutenticacao {
  const limpo = (valor ?? '').trim()
  return (MODOS_DE_AUTENTICACAO as readonly string[]).includes(limpo)
    ? (limpo as ModoDeAutenticacao)
    : AUTENTICACAO_PADRAO
}

/**
 * Selfie (só a foto do rosto) ao assinar — decisão do Dr. Sergio para a
 * ZapSign: "vamos confirmar por selfie". Fica no relatório de assinaturas,
 * como na procuração de exemplo que o escritório mandou. Sem validação
 * biométrica, que tem custo extra e não foi pedida. ZAPSIGN_SELFIE=0 desliga.
 */
export function exigirSelfie(valor: string | undefined = process.env['ZAPSIGN_SELFIE']): boolean {
  return !/^(0|nao|não|false|off)$/i.test((valor ?? '').trim())
}

export type SignatarioParaZapSign = {
  nome: string
  email: string
  /** "Cliente", "Testemunha"… — aparece no relatório de assinaturas. */
  qualificacao: string
  /** Texto do PDF onde a assinatura é desenhada; null = sem âncora. */
  ancora: string | null
}

export type PedidoDeDocumento = {
  nome: string
  pdf: Uint8Array
  /** Nosso id do Documento, para achar o envio pelo painel da ZapSign. */
  idExterno: string
  mensagem: string
  signatarios: readonly SignatarioParaZapSign[]
}

/**
 * Corpo do POST /docs/. Função pura: é aqui que mora a chance de errar campo,
 * e cada erro aqui é um documento do plano gasto.
 *
 * A ZapSign desenha a assinatura em TODAS as ocorrências da âncora. Duas
 * pessoas com a mesma âncora assinariam uma por cima da outra; por isso só a
 * primeira de cada âncora a recebe.
 */
export function corpoDoDocumento(
  pedido: PedidoDeDocumento,
  autenticacao: ModoDeAutenticacao = modoDeAutenticacao(),
  selfie: boolean = exigirSelfie(),
): Record<string, unknown> {
  const ancorasUsadas = new Set<string>()

  return {
    name: pedido.nome.slice(0, 255),
    base64_pdf: Buffer.from(pedido.pdf).toString('base64'),
    lang: 'pt-br',
    external_id: pedido.idExterno,
    folder_path: '/Portal E. Ferreira',
    disable_signer_emails: false,
    signers: pedido.signatarios.map((signatario) => {
      const ancora =
        signatario.ancora !== null && !ancorasUsadas.has(signatario.ancora) ? signatario.ancora : null
      if (ancora !== null) ancorasUsadas.add(ancora)
      return {
        name: signatario.nome,
        email: signatario.email,
        auth_mode: autenticacao,
        require_selfie_photo: selfie,
        send_automatic_email: true,
        send_automatic_whatsapp: false,
        lock_name: true,
        lock_email: true,
        qualification: signatario.qualificacao,
        custom_message: pedido.mensagem,
        ...(ancora === null ? {} : { signature_placement: ancora }),
      }
    }),
  }
}

export type DocumentoCriado = {
  token: string
  /** Token de cada signatário, pelo e-mail — é o que o posicionamento pede. */
  signatarios: { email: string; token: string }[]
}

/** Cria o documento e dispara os convites. Gasta um documento do plano. */
export async function criarDocumento(pedido: PedidoDeDocumento): Promise<DocumentoCriado> {
  const dados = await chamar<{ token?: unknown; signers?: unknown }>('/docs/', 'criar', {
    corpo: corpoDoDocumento(pedido),
  })
  if (typeof dados.token !== 'string' || dados.token === '') {
    throw new FalhaNaZapSign(200, '', 'criar', 'A ZapSign não devolveu o identificador do documento.')
  }
  const signers = Array.isArray(dados.signers) ? (dados.signers as Record<string, unknown>[]) : []
  return {
    token: dados.token,
    signatarios: signers
      .filter((s) => typeof s['token'] === 'string')
      .map((s) => ({ email: String(s['email'] ?? '').toLowerCase(), token: String(s['token']) })),
  }
}

// ---------------------------------------------------------------------------
// Posição por coordenada — documento avulso (ANEXO)
// ---------------------------------------------------------------------------

/** Tamanho recomendado pela ZapSign para assinatura em A4 retrato, em % da página. */
export const TAMANHO_DA_ASSINATURA = { x: 19.55, y: 9.42 } as const

export type Rubrica = {
  type: 'signature'
  page: number
  relative_position_bottom: number
  relative_position_left: number
  relative_size_x: number
  relative_size_y: number
  signer_token: string
}

/** Onde o operador escolheu, nos mesmos termos da tela (ver `PosicaoEscolhida`). */
export type PosicaoNaPagina = {
  /** 0 = a última página; 1 = a primeira. */
  pagina: number
  lado: 'esquerda' | 'centro' | 'direita'
  /** Do topo da página, em % da altura: o centro da assinatura fica aqui. */
  alturaEmPercentual: number
}

const CENTRO_DO_LADO = { esquerda: 27, centro: 50, direita: 73 } as const

function limitar(valor: number, minimo: number, maximo: number): number {
  return Math.min(Math.max(valor, minimo), maximo)
}

/**
 * Converte a escolha da tela na coordenada da ZapSign (origem no canto
 * INFERIOR esquerdo, em %, página contada a partir de 0). Função pura.
 */
export function rubricaDaPosicao(
  posicao: PosicaoNaPagina,
  totalDePaginas: number,
  tokenDoSignatario: string,
): Rubrica {
  const ultima = Math.max(totalDePaginas - 1, 0)
  const page = posicao.pagina <= 0 || posicao.pagina > totalDePaginas ? ultima : posicao.pagina - 1
  const { x, y } = TAMANHO_DA_ASSINATURA
  const arredondar = (n: number) => Math.round(n * 100) / 100
  return {
    type: 'signature',
    page,
    relative_position_left: arredondar(limitar(CENTRO_DO_LADO[posicao.lado] - x / 2, 0, 100 - x)),
    relative_position_bottom: arredondar(
      limitar(100 - posicao.alturaEmPercentual - y / 2, 0, 100 - y),
    ),
    relative_size_x: x,
    relative_size_y: y,
    signer_token: tokenDoSignatario,
  }
}

/** Define onde cada um assina (substitui posições anteriores, se houver). */
export async function posicionarAssinaturas(
  tokenDoDocumento: string,
  rubricas: readonly Rubrica[],
): Promise<void> {
  if (rubricas.length === 0) return
  await chamar(`/docs/${encodeURIComponent(tokenDoDocumento)}/place-signatures/`, 'posicionar', {
    corpo: { rubricas },
  })
}

// ---------------------------------------------------------------------------
// Consulta e download
// ---------------------------------------------------------------------------

export type SituacaoNaZapSign = 'aguardando' | 'assinado' | 'cancelado'

export type DocumentoNaZapSign = {
  situacao: SituacaoNaZapSign
  /** Status como a ZapSign escreve, para o registro. */
  situacaoBruta: string
  totalSignatarios: number
  assinaram: number
  /** Link temporário (60 min) do PDF assinado; só existe quando assinado. */
  arquivoAssinado: string | null
}

/**
 * Lê o GET /docs/{token}/. Função pura. Recusado aparece como "refused" na API
 * e "recusado" no exemplo do aviso: os dois valem, e documento excluído também
 * é cancelamento.
 */
export function interpretarDocumento(dados: unknown): DocumentoNaZapSign {
  const d = (dados ?? {}) as Record<string, unknown>
  const situacaoBruta = String(d['status'] ?? '')
  const signers = Array.isArray(d['signers']) ? (d['signers'] as Record<string, unknown>[]) : []

  let situacao: SituacaoNaZapSign = 'aguardando'
  if (d['deleted'] === true || /^(refused|recusado|rejected)$/i.test(situacaoBruta)) {
    situacao = 'cancelado'
  } else if (/^signed$/i.test(situacaoBruta)) {
    situacao = 'assinado'
  }

  const arquivo = d['signed_file']
  return {
    situacao,
    situacaoBruta,
    totalSignatarios: signers.length,
    assinaram: signers.filter((s) => /^signed$/i.test(String(s['status'] ?? ''))).length,
    arquivoAssinado: situacao === 'assinado' && typeof arquivo === 'string' && arquivo !== '' ? arquivo : null,
  }
}

/** Null quando a ZapSign diz que o documento não existe. */
export async function consultarDocumento(tokenDoDocumento: string): Promise<DocumentoNaZapSign | null> {
  try {
    return interpretarDocumento(await chamar(`/docs/${encodeURIComponent(tokenDoDocumento)}/`, 'consultar'))
  } catch (erro) {
    if (erro instanceof FalhaNaZapSign && erro.situacao === 404) return null
    throw erro
  }
}

/**
 * Baixa o PDF assinado, com link fresco de uma consulta nova. Null quando o
 * documento ainda não tem arquivo assinado.
 */
export async function baixarAssinado(tokenDoDocumento: string): Promise<Uint8Array | null> {
  const documento = await consultarDocumento(tokenDoDocumento)
  if (documento === null || documento.arquivoAssinado === null) return null

  const resposta = await fetch(documento.arquivoAssinado, { signal: AbortSignal.timeout(TEMPO_LIMITE_MS) })
  if (!resposta.ok) {
    // O link dá acesso ao documento assinado: não vai para a mensagem.
    throw new FalhaNaZapSign(resposta.status, '', 'baixar', 'O endereço do documento assinado não abriu.')
  }
  const conteudo = new Uint8Array(await resposta.arrayBuffer())
  if (conteudo.byteLength === 0) {
    throw new FalhaNaZapSign(200, '', 'baixar', 'A ZapSign entregou o documento assinado vazio.')
  }
  if (conteudo.byteLength > TAMANHO_MAXIMO_DO_ASSINADO) {
    throw new FalhaNaZapSign(200, '', 'baixar', 'O documento assinado é grande demais.')
  }
  return conteudo
}

// ---------------------------------------------------------------------------
// Aviso (webhook) e mensagens
// ---------------------------------------------------------------------------

/**
 * Do corpo do aviso só interessa QUAL documento. O resto (status, signatários,
 * link do arquivo) é ignorado de propósito: o aviso não é assinado.
 */
export function tokenDoAviso(corpo: unknown): string | null {
  if (corpo === null || typeof corpo !== 'object') return null
  const token = (corpo as Record<string, unknown>)['token']
  return typeof token === 'string' && token.trim() !== '' ? token.trim() : null
}

function motivoNoCorpo(corpo: string): string | null {
  try {
    const dados = JSON.parse(corpo) as Record<string, unknown>
    for (const campo of ['message', 'detail', 'error', 'erro']) {
      const valor = dados[campo]
      if (typeof valor === 'string' && valor.trim() !== '') return valor.trim().slice(0, 200)
    }
  } catch {
    // Não era JSON (página de erro em HTML): não vale mostrar.
  }
  return null
}

/** Frase para a tela, sem token nem URL. */
export function descreverFalhaDaZapSign(erro: unknown): string {
  if (erro instanceof FalhaNaZapSign) {
    const etapa = ROTULO_DA_ETAPA[erro.etapa]
    const motivo = motivoNoCorpo(erro.corpo)
    const disse = motivo === null ? '' : ` A ZapSign respondeu: "${motivo}".`
    if (erro.situacao === 401 || erro.situacao === 403) {
      return `A ZapSign recusou a chave de acesso do escritório ${etapa}. Confira ZAPSIGN_API_TOKEN.${disse}`
    }
    if (erro.situacao === 402) {
      return `A ZapSign recusou ${etapa}: o plano não inclui a API ou está com pagamento pendente.${disse}`
    }
    if (erro.situacao === 429) return `A ZapSign limitou as requisições ${etapa}. Aguarde um minuto.`
    if (erro.situacao >= 500) return `A ZapSign está instável ${etapa}. Tente de novo em alguns minutos.`
    if (erro.situacao >= 400) return `A ZapSign recusou o pedido ${etapa}.${disse || ' Avise o suporte.'}`
    return erro.message
  }
  if (erro instanceof Error && (erro.name === 'TimeoutError' || erro.name === 'AbortError')) {
    return 'A ZapSign demorou demais para responder. Confira na pasta se o envio saiu antes de tentar de novo.'
  }
  return 'Não foi possível falar com a ZapSign. Tente de novo em alguns minutos.'
}
