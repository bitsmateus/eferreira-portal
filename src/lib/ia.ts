/**
 * Provedor de IA — Claude (Anthropic) ou OpenAI, trocável por configuração
 * (09/11/2026; escopo aprovado pelo escritório em 05/11/2026, item 4).
 *
 * É conveniência, nunca autoridade — mesmo princípio de `cep.ts` e
 * `google-agenda.ts`: sem a chave do provedor escolhido, `iaConfigurada()` é
 * falso e a fila de conferência funciona sem a análise; com o provedor fora do
 * ar, a análise fica para a próxima rodada. Nada no portal depende disto para
 * gravar.
 *
 * Variáveis (todas secretas no EasyPanel, regra 8):
 *  - `IA_PROVEDOR`: `anthropic` (padrão) ou `openai`;
 *  - `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`: a chave da conta de
 *    desenvolvedor DO ESCRITÓRIO (cobrança por consumo, não a assinatura);
 *  - `IA_MODELO`: opcional para a Anthropic, obrigatório para a OpenAI;
 *  - `ANTHROPIC_WORKSPACE_ID`: só para chave criada FORA de um workspace — a
 *    Anthropic recusa essa chave (HTTP 400) sem o cabeçalho
 *    `anthropic-workspace-id`. Chave criada dentro do workspace dispensa.
 *
 * Só `fetch`, sem SDK — mesma escolha de `d4sign.ts` e `google-agenda.ts`. A
 * chave nunca entra em mensagem de erro.
 */

const LIMITE_DE_ESPERA_MS = 90_000
const MODELO_PADRAO_ANTHROPIC = 'claude-sonnet-5-5'

export type ProvedorDeIa = 'anthropic' | 'openai'

type Configuracao = { provedor: ProvedorDeIa; chave: string; modelo: string; workspace: string }

function variavel(nome: string): string {
  return (process.env[nome] ?? '').trim()
}

function configuracao(): Configuracao | null {
  const provedor: ProvedorDeIa = variavel('IA_PROVEDOR').toLowerCase() === 'openai' ? 'openai' : 'anthropic'

  if (provedor === 'anthropic') {
    const chave = variavel('ANTHROPIC_API_KEY')
    if (chave === '') return null
    return {
      provedor,
      chave,
      modelo: variavel('IA_MODELO') || MODELO_PADRAO_ANTHROPIC,
      workspace: variavel('ANTHROPIC_WORKSPACE_ID'),
    }
  }

  const chave = variavel('OPENAI_API_KEY')
  const modelo = variavel('IA_MODELO')
  if (chave === '' || modelo === '') return null
  return { provedor, chave, modelo, workspace: '' }
}

export function iaConfigurada(): boolean {
  return configuracao() !== null
}

/** "anthropic/claude-…" — o que fica gravado na análise e na auditoria. */
export function descricaoDoProvedor(): string | null {
  const config = configuracao()
  return config === null ? null : `${config.provedor}/${config.modelo}`
}

export type PedidoEstruturado = {
  sistema: string
  usuario: string
  /** Nome da "ferramenta" / do esquema, em snake_case. */
  nome: string
  descricao: string
  /** JSON Schema do objeto de resposta. */
  esquema: Record<string, unknown>
}

export type RespostaDaIa =
  | { ok: true; dados: unknown; provedor: string }
  | { ok: false; erro: string }

async function chamar(url: string, init: RequestInit): Promise<{ status: number; corpo: unknown }> {
  const resposta = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(LIMITE_DE_ESPERA_MS),
    cache: 'no-store',
  })
  const corpo: unknown = await resposta.json().catch(() => null)
  return { status: resposta.status, corpo }
}

function objeto(valor: unknown): Record<string, unknown> | null {
  return typeof valor === 'object' && valor !== null ? (valor as Record<string, unknown>) : null
}

/**
 * O motivo que o provedor deu para recusar — `{ error: { message } }` nos
 * dois. Sem ele, "HTTP 400" não diz se é falta de saldo, modelo errado ou
 * pedido malformado. A chave é apagada do texto por garantia (regra 8), e
 * o caso mais comum ganha uma dica em português. Exportado para teste.
 */
export function descreverRecusa(provedor: string, status: number, corpo: unknown, chave: string): string {
  const bruto = objeto(objeto(corpo)?.['error'])?.['message']
  const mensagem =
    typeof bruto === 'string' && bruto.trim() !== ''
      ? bruto.split(chave).join('***').replace(/\s+/g, ' ').trim().slice(0, 300)
      : null

  const base = `${provedor} respondeu HTTP ${status}`
  if (mensagem === null) return `${base}.`
  if (/credit balance|insufficient_quota|exceeded your current quota/i.test(mensagem)) {
    return `${base}: sem saldo na conta de IA do escritório (coloque crédito em Billing). Detalhe: ${mensagem}`
  }
  return `${base}: ${mensagem}`
}

/**
 * Extrai o objeto da resposta da Anthropic. O pedido usa saída estruturada
 * (`output_config.format`): o JSON vem no bloco de texto, depois dos blocos
 * de raciocínio. `tool_choice` forçado não serve mais — os modelos atuais o
 * recusam com HTTP 400. Exportado para teste.
 */
export function lerRespostaDaAnthropic(corpo: unknown): unknown {
  const conteudo = objeto(corpo)?.['content']
  if (!Array.isArray(conteudo)) return null
  const texto = conteudo
    .map((bloco) => objeto(bloco))
    .filter((b) => b?.['type'] === 'text' && typeof b['text'] === 'string')
    .map((b) => b?.['text'] as string)
    .join('')
    .trim()
  if (texto === '') return null
  try {
    return JSON.parse(texto) as unknown
  } catch {
    return null
  }
}

/** Extrai o objeto da resposta da OpenAI (`json_schema`). Exportado para teste. */
export function lerRespostaDaOpenai(corpo: unknown): unknown {
  const escolhas = objeto(corpo)?.['choices']
  if (!Array.isArray(escolhas)) return null
  const mensagem = objeto(objeto(escolhas[0])?.['message'])
  const conteudo = mensagem?.['content']
  if (typeof conteudo !== 'string') return null
  try {
    return JSON.parse(conteudo) as unknown
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Texto longo com pesquisa na web — a minuta (16/11/2026)
// ---------------------------------------------------------------------------

/** Uma minuta com pesquisa leva minutos: a espera é por chamada, não total. */
const LIMITE_DE_ESPERA_DO_TEXTO_MS = 10 * 60_000
/** Quantas vezes se retoma um turno pausado (`pause_turn`) antes de desistir. */
const RETOMADAS_MAXIMAS = 4
const BUSCAS_MAXIMAS = 8
const LEITURAS_MAXIMAS = 6

export type PedidoDeTexto = {
  sistema: string
  usuario: string
  /** Liga a busca e a leitura de páginas na web (só na Anthropic). */
  pesquisaNaWeb: boolean
}

export type FonteDaWeb = { url: string; titulo: string }

export type RespostaDeTexto =
  | { ok: true; texto: string; fontes: FonteDaWeb[]; buscas: number; pesquisou: boolean; provedor: string }
  | { ok: false; erro: string }

type Bloco = Record<string, unknown>

/**
 * Remonta a mensagem a partir dos eventos do streaming da Anthropic: cada
 * bloco começa em `content_block_start` e cresce com os `content_block_delta`
 * (texto, JSON parcial da ferramenta, raciocínio, assinatura, citação). O
 * conteúdo volta inteiro — é ele que se reenvia quando o turno pausa.
 * Exportado para teste.
 */
export function montarMensagemDoStreaming(eventos: readonly unknown[]): {
  conteudo: Bloco[]
  parada: string | null
  erro: string | null
} {
  const conteudo: Bloco[] = []
  const jsonParcial = new Map<number, string>()
  let parada: string | null = null
  let erro: string | null = null

  for (const bruto of eventos) {
    const evento = objeto(bruto)
    if (evento === null) continue
    const tipo = evento['type']
    const indice = typeof evento['index'] === 'number' ? evento['index'] : -1

    if (tipo === 'content_block_start') {
      const bloco = objeto(evento['content_block'])
      if (bloco !== null && indice >= 0) conteudo[indice] = { ...bloco }
    } else if (tipo === 'content_block_delta') {
      const bloco = conteudo[indice]
      const delta = objeto(evento['delta'])
      if (bloco === undefined || delta === null) continue
      if (delta['type'] === 'text_delta' && typeof delta['text'] === 'string') {
        bloco['text'] = `${typeof bloco['text'] === 'string' ? bloco['text'] : ''}${delta['text']}`
      } else if (delta['type'] === 'input_json_delta' && typeof delta['partial_json'] === 'string') {
        jsonParcial.set(indice, `${jsonParcial.get(indice) ?? ''}${delta['partial_json']}`)
      } else if (delta['type'] === 'thinking_delta' && typeof delta['thinking'] === 'string') {
        bloco['thinking'] = `${typeof bloco['thinking'] === 'string' ? bloco['thinking'] : ''}${delta['thinking']}`
      } else if (delta['type'] === 'signature_delta' && typeof delta['signature'] === 'string') {
        bloco['signature'] = delta['signature']
      } else if (delta['type'] === 'citations_delta' && delta['citation'] !== undefined) {
        const anteriores = Array.isArray(bloco['citations']) ? (bloco['citations'] as unknown[]) : []
        bloco['citations'] = [...anteriores, delta['citation']]
      }
    } else if (tipo === 'content_block_stop') {
      const parcial = jsonParcial.get(indice)
      const bloco = conteudo[indice]
      if (parcial !== undefined && bloco !== undefined) {
        try {
          bloco['input'] = parcial === '' ? {} : (JSON.parse(parcial) as unknown)
        } catch {
          bloco['input'] = {}
        }
        jsonParcial.delete(indice)
      }
    } else if (tipo === 'message_delta') {
      const motivo = objeto(evento['delta'])?.['stop_reason']
      if (typeof motivo === 'string') parada = motivo
    } else if (tipo === 'error') {
      const mensagem = objeto(evento['error'])?.['message']
      erro = typeof mensagem === 'string' ? mensagem : 'erro no streaming'
    }
  }
  return { conteudo: conteudo.filter((bloco) => bloco !== undefined), parada, erro }
}

/** Lê o corpo SSE e devolve os eventos já como objetos. */
async function lerEventos(corpo: ReadableStream<Uint8Array>): Promise<unknown[]> {
  const leitor = corpo.getReader()
  const decodificador = new TextDecoder()
  const eventos: unknown[] = []
  let resto = ''
  const processar = (pedaco: string) => {
    for (const linha of pedaco.split('\n')) {
      if (!linha.startsWith('data:')) continue
      const dado = linha.slice(5).trim()
      if (dado === '' || dado === '[DONE]') continue
      try {
        eventos.push(JSON.parse(dado) as unknown)
      } catch {
        // Linha incompleta ou comentário — o SSE permite; ignora.
      }
    }
  }
  for (;;) {
    const { done, value } = await leitor.read()
    if (done) break
    resto += decodificador.decode(value, { stream: true })
    const partes = resto.split(/\r?\n\r?\n/)
    resto = partes.pop() ?? ''
    for (const parte of partes) processar(parte)
  }
  processar(resto + decodificador.decode())
  return eventos
}

/** Texto, fontes e número de buscas de todos os turnos. Exportado para teste. */
export function extrairTextoEFontes(turnos: readonly (readonly Bloco[])[]): {
  texto: string
  fontes: FonteDaWeb[]
  buscas: number
} {
  const partes: string[] = []
  const fontes = new Map<string, FonteDaWeb>()
  let buscas = 0
  const anotar = (url: unknown, titulo: unknown) => {
    if (typeof url !== 'string' || !/^https?:\/\//.test(url) || fontes.has(url)) return
    fontes.set(url, { url, titulo: typeof titulo === 'string' && titulo.trim() !== '' ? titulo.trim() : url })
  }
  for (const turno of turnos) {
    for (const bloco of turno) {
      if (bloco['type'] === 'text' && typeof bloco['text'] === 'string') {
        partes.push(bloco['text'])
        for (const citacao of Array.isArray(bloco['citations']) ? bloco['citations'] : []) {
          const c = objeto(citacao)
          anotar(c?.['url'], c?.['title'])
        }
      } else if (bloco['type'] === 'server_tool_use' && bloco['name'] === 'web_search') {
        buscas += 1
      } else if (bloco['type'] === 'web_search_tool_result' && Array.isArray(bloco['content'])) {
        for (const resultado of bloco['content']) {
          const r = objeto(resultado)
          anotar(r?.['url'], r?.['title'])
        }
      }
    }
  }
  return { texto: partes.join('').trim(), fontes: [...fontes.values()], buscas }
}

async function textoDaAnthropic(config: Configuracao, pedido: PedidoDeTexto): Promise<RespostaDeTexto> {
  const provedor = `${config.provedor}/${config.modelo}`
  const mensagens: { role: 'user' | 'assistant'; content: unknown }[] = [
    { role: 'user', content: pedido.usuario },
  ]
  const ferramentas = pedido.pesquisaNaWeb
    ? [
        { type: 'web_search_20260209', name: 'web_search', max_uses: BUSCAS_MAXIMAS },
        { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: LEITURAS_MAXIMAS },
      ]
    : undefined
  const turnos: Bloco[][] = []

  for (let rodada = 0; rodada <= RETOMADAS_MAXIMAS; rodada += 1) {
    const resposta = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': config.chave,
        'anthropic-version': '2023-06-01',
        ...(config.workspace === '' ? {} : { 'anthropic-workspace-id': config.workspace }),
      },
      body: JSON.stringify({
        model: config.modelo,
        max_tokens: 32000,
        stream: true,
        system: pedido.sistema,
        messages: mensagens,
        ...(ferramentas === undefined ? {} : { tools: ferramentas }),
      }),
      signal: AbortSignal.timeout(LIMITE_DE_ESPERA_DO_TEXTO_MS),
      cache: 'no-store',
    })
    if (resposta.status !== 200 || resposta.body === null) {
      const corpo: unknown = await resposta.json().catch(() => null)
      return { ok: false, erro: descreverRecusa('Anthropic', resposta.status, corpo, config.chave) }
    }

    const { conteudo, parada, erro } = montarMensagemDoStreaming(await lerEventos(resposta.body))
    if (erro !== null) return { ok: false, erro: `A Anthropic interrompeu a resposta: ${erro.split(config.chave).join('***')}` }
    turnos.push(conteudo)

    if (parada === 'pause_turn') {
      // O servidor pausou no meio da pesquisa: reenviar o que veio retoma de onde parou.
      mensagens.push({ role: 'assistant', content: conteudo })
      continue
    }
    if (parada === 'refusal') return { ok: false, erro: 'A Anthropic recusou redigir esta minuta.' }
    if (parada === 'max_tokens') return { ok: false, erro: 'A minuta passou do limite de tamanho da resposta.' }

    const { texto, fontes, buscas } = extrairTextoEFontes(turnos)
    if (texto === '') return { ok: false, erro: 'A Anthropic respondeu sem texto.' }
    return { ok: true, texto, fontes, buscas, pesquisou: pedido.pesquisaNaWeb, provedor }
  }
  return { ok: false, erro: 'A pesquisa não terminou depois de várias retomadas. Tente de novo.' }
}

async function textoDaOpenai(config: Configuracao, pedido: PedidoDeTexto): Promise<RespostaDeTexto> {
  const { status, corpo } = await chamar('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${config.chave}` },
    body: JSON.stringify({
      model: config.modelo,
      messages: [
        { role: 'system', content: pedido.sistema },
        { role: 'user', content: pedido.usuario },
      ],
    }),
  })
  if (status !== 200) return { ok: false, erro: descreverRecusa('OpenAI', status, corpo, config.chave) }
  const escolhas = objeto(corpo)?.['choices']
  const texto = Array.isArray(escolhas) ? objeto(objeto(escolhas[0])?.['message'])?.['content'] : null
  if (typeof texto !== 'string' || texto.trim() === '') return { ok: false, erro: 'A OpenAI respondeu sem texto.' }
  // Sem pesquisa na web por este caminho: a minuta sai com a pesquisa pendente.
  return { ok: true, texto: texto.trim(), fontes: [], buscas: 0, pesquisou: false, provedor: `${config.provedor}/${config.modelo}` }
}

/**
 * Pede à IA um texto longo (a minuta). Na Anthropic, com pesquisa na web
 * quando pedida; na OpenAI, sem pesquisa — `pesquisou` diz qual foi o caso,
 * para a tela não chamar de "jurisprudência conferida" o que não foi buscado.
 */
export async function pedirTexto(pedido: PedidoDeTexto): Promise<RespostaDeTexto> {
  const config = configuracao()
  if (config === null) return { ok: false, erro: 'IA não configurada.' }
  try {
    return config.provedor === 'anthropic' ? await textoDaAnthropic(config, pedido) : await textoDaOpenai(config, pedido)
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.name : 'erro'
    return { ok: false, erro: `Provedor de IA fora do ar ou lento (${motivo}).` }
  }
}

/**
 * Pede à IA um objeto no formato de `esquema`. Quem chama valida o resultado
 * de novo (com zod): o esquema orienta o modelo, não garante nada.
 */
export async function pedirObjeto(pedido: PedidoEstruturado): Promise<RespostaDaIa> {
  const config = configuracao()
  if (config === null) return { ok: false, erro: 'IA não configurada.' }
  const provedor = `${config.provedor}/${config.modelo}`

  try {
    if (config.provedor === 'anthropic') {
      const { status, corpo } = await chamar('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': config.chave,
          'anthropic-version': '2023-06-01',
          ...(config.workspace === '' ? {} : { 'anthropic-workspace-id': config.workspace }),
        },
        body: JSON.stringify({
          model: config.modelo,
          max_tokens: 16000,
          system: `${pedido.sistema}\n\n${pedido.descricao}`,
          messages: [{ role: 'user', content: pedido.usuario }],
          output_config: { format: { type: 'json_schema', schema: pedido.esquema } },
        }),
      })
      if (status !== 200) {
        return { ok: false, erro: descreverRecusa('Anthropic', status, corpo, config.chave) }
      }
      const parada = objeto(corpo)?.['stop_reason']
      if (parada === 'refusal') return { ok: false, erro: 'A Anthropic recusou analisar este texto.' }
      if (parada === 'max_tokens') return { ok: false, erro: 'Resposta da Anthropic cortada no limite de tamanho.' }
      const dados = lerRespostaDaAnthropic(corpo)
      if (dados === null) return { ok: false, erro: 'Resposta da Anthropic sem o objeto pedido.' }
      return { ok: true, dados, provedor }
    }

    const { status, corpo } = await chamar('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${config.chave}` },
      body: JSON.stringify({
        model: config.modelo,
        messages: [
          { role: 'system', content: pedido.sistema },
          { role: 'user', content: pedido.usuario },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: pedido.nome, schema: pedido.esquema, strict: true },
        },
      }),
    })
    if (status !== 200) {
      return { ok: false, erro: descreverRecusa('OpenAI', status, corpo, config.chave) }
    }
    const dados = lerRespostaDaOpenai(corpo)
    if (dados === null) return { ok: false, erro: 'Resposta da OpenAI sem o objeto pedido.' }
    return { ok: true, dados, provedor }
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.name : 'erro'
    return { ok: false, erro: `Provedor de IA fora do ar ou lento (${motivo}).` }
  }
}
