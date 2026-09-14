/**
 * A chave da API — Anexo I, item 3.c: "controle de autenticação e de
 * permissões de acesso à API".
 *
 * Formato:
 *
 *     ef_live_a1b2c3d4e5f60718_<32 caracteres sorteados>
 *     └──┬──┘ └───────┬──────┘ └──────────┬───────────┘
 *     ambiente   identificador          segredo
 *
 * O **identificador é público e indexado**: é por ele que a requisição acha a
 * linha em uma consulta só, em vez de varrer a tabela testando hash por hash.
 * O **segredo nunca é guardado** — só o SHA-256 dele.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POR QUE SHA-256 AQUI, SE AS SENHAS USAM ARGON2ID
 *
 * Argon2 é caro de propósito, para proteger segredo escolhido por gente: curto,
 * previsível, reaproveitado de outro serviço. Aqui o segredo são 192 bits
 * sorteados por CSPRNG — não existe dicionário que o alcance, e nenhum custo de
 * hash mudaria isso.
 *
 * E há o outro lado: hash lento roda em TODA requisição de API. Um integrador
 * com 50 requisições por segundo derrubaria o servidor sozinho, sem nem querer.
 * Encarecer a verificação, aqui, é abrir a porta que se queria fechar.
 *
 * A comparação é em tempo constante, que é a parte que importa: sem isso, o
 * tempo de resposta entrega o hash caractere a caractere.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Este arquivo é puro: sorteia, formata, compara. Nada de banco — quem toca o
 * banco é `src/lib/credenciais.ts`.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/** Produção. */
export const PREFIXO_PRODUCAO = 'ef_live_'
/** Ambiente de testes (Anexo I, 3.c). */
export const PREFIXO_TESTES = 'ef_test_'

export const PREFIXOS = [PREFIXO_PRODUCAO, PREFIXO_TESTES] as const
export type Prefixo = (typeof PREFIXOS)[number]

/**
 * O identificador é **hexadecimal**, e não base64url como o segredo.
 *
 * Não é capricho: base64url inclui `_`, que é justamente o caractere que
 * separa as partes da chave. Um identificador com `_` no meio faria a leitura
 * cortar no lugar errado — e a chave, sorteada assim de vez em quando, seria
 * recusada sem motivo aparente. Hexadecimal não tem separador no alfabeto.
 *
 * Ele é público e serve só de índice; a unicidade quem garante é o banco.
 */
const BYTES_DO_IDENTIFICADOR = 8
export const CARACTERES_DO_IDENTIFICADOR = BYTES_DO_IDENTIFICADOR * 2
const BYTES_DO_SEGREDO = 24

/**
 * O prefixo desta instalação.
 *
 * O "ambiente de testes" do contrato é a instalação de **homologação** — os
 * dois projetos separados que a stack já prevê no EasyPanel. Não é um modo
 * dentro da mesma instalação: chave de teste que escreve no banco de produção
 * não é ambiente de testes, é acidente esperando data.
 *
 * O padrão é o de testes de propósito: uma instalação mal configurada deve
 * errar para o lado inofensivo.
 */
export function prefixoDoAmbiente(): Prefixo {
  return (process.env['AMBIENTE_DA_API'] ?? '').trim() === 'producao'
    ? PREFIXO_PRODUCAO
    : PREFIXO_TESTES
}

export type ChaveNova = {
  /** A chave inteira. Aparece uma vez só, no momento em que é gerada. */
  chave: string
  prefixo: Prefixo
  identificador: string
  segredoHash: string
  /** Últimos quatro caracteres, para reconhecer a chave na lista depois. */
  final: string
}

function sortear(bytes: number): string {
  return randomBytes(bytes).toString('base64url')
}

export function gerarChave(prefixo: Prefixo = prefixoDoAmbiente()): ChaveNova {
  const identificador = randomBytes(BYTES_DO_IDENTIFICADOR).toString('hex')
  const segredo = sortear(BYTES_DO_SEGREDO)

  return {
    chave: `${prefixo}${identificador}_${segredo}`,
    prefixo,
    identificador,
    segredoHash: hashDoSegredo(segredo),
    final: segredo.slice(-4),
  }
}

export function hashDoSegredo(segredo: string): string {
  return createHash('sha256').update(segredo, 'utf8').digest('hex')
}

export type ChaveLida = { prefixo: Prefixo; identificador: string; segredo: string }

/**
 * Quebra a chave apresentada nas três partes. Devolve null para qualquer coisa
 * que não tenha a forma certa — sem dizer qual parte estava errada.
 */
export function lerChave(apresentada: string): ChaveLida | null {
  const limpa = apresentada.trim()

  const prefixo = PREFIXOS.find((candidato) => limpa.startsWith(candidato))
  if (prefixo === undefined) return null

  const resto = limpa.slice(prefixo.length)

  // Corte por posição, não pelo primeiro `_`: o segredo é base64url e pode
  // ter `_` dentro. Procurar o separador acharia o dele.
  if (resto[CARACTERES_DO_IDENTIFICADOR] !== '_') return null

  const identificador = resto.slice(0, CARACTERES_DO_IDENTIFICADOR)
  const segredo = resto.slice(CARACTERES_DO_IDENTIFICADOR + 1)

  if (!/^[0-9a-f]+$/.test(identificador)) return null
  if (segredo.length < 8) return null

  return { prefixo, identificador, segredo }
}

/**
 * Compara em tempo constante. Comparar hash com `===` devolve mais rápido
 * quando o primeiro caractere já difere, e essa diferença é suficiente para
 * reconstruir o hash byte a byte.
 */
export function segredoConfere(segredo: string, hashArmazenado: string): boolean {
  const calculado = Buffer.from(hashDoSegredo(segredo), 'utf8')
  const guardado = Buffer.from(hashArmazenado, 'utf8')

  if (calculado.length !== guardado.length) return false
  return timingSafeEqual(calculado, guardado)
}

/**
 * Como a chave aparece na tela depois de criada: `ef_live_••••••4c21`.
 *
 * A chave inteira aparece **uma vez só**, no momento em que é gerada. Depois
 * fica mascarada para sempre — se perder, gera outra. É o padrão de mercado e
 * evita que a chave viva num print de tela (protótipo, tela "API do escritório").
 */
export function mascarar(prefixo: string, final: string): string {
  return `${prefixo}••••••${final}`
}

/** Lê o cabeçalho `Authorization: Bearer <chave>`. */
export function chaveDoCabecalho(autorizacao: string | null): string | null {
  if (autorizacao === null) return null

  const partes = autorizacao.trim().split(/\s+/)
  if (partes.length !== 2) return null
  if ((partes[0] ?? '').toLowerCase() !== 'bearer') return null

  const chave = partes[1] ?? ''
  return chave === '' ? null : chave
}
