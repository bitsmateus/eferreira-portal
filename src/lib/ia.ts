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

/** Extrai o objeto da resposta da Anthropic (`tool_use` forçado). Exportado para teste. */
export function lerRespostaDaAnthropic(corpo: unknown, nome: string): unknown {
  const conteudo = objeto(corpo)?.['content']
  if (!Array.isArray(conteudo)) return null
  for (const bloco of conteudo) {
    const b = objeto(bloco)
    if (b?.['type'] === 'tool_use' && b['name'] === nome) return b['input'] ?? null
  }
  return null
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
          max_tokens: 4096,
          system: pedido.sistema,
          messages: [{ role: 'user', content: pedido.usuario }],
          tools: [{ name: pedido.nome, description: pedido.descricao, input_schema: pedido.esquema }],
          tool_choice: { type: 'tool', name: pedido.nome },
        }),
      })
      if (status !== 200) {
        return { ok: false, erro: descreverRecusa('Anthropic', status, corpo, config.chave) }
      }
      const dados = lerRespostaDaAnthropic(corpo, pedido.nome)
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
