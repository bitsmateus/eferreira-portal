/**
 * O contrato comum de todas as rotas da API — Anexo I, itens 3.b e 3.c.
 *
 * Três coisas ficam aqui, e não espalhadas por rota, porque um integrador
 * precisa poder aprender uma vez só: como autenticar, que forma tem um erro e
 * como as datas são escritas.
 *
 * Regra 2 continua valendo: a chave diz **quem** está chamando e o que aquela
 * chave pode fazer; o recorte dos dados continua saindo de `SessaoServidor` e
 * dos filtros de autorização, nunca de um id que veio no corpo.
 */

import { NextResponse, type NextRequest } from 'next/server'
import type { PermissaoApi } from '@prisma/client'

import {
  anotarUso,
  autenticarChave,
  podeNaApi,
  type CredencialAutenticada,
} from '@/lib/credenciais'
import { chaveDoCabecalho } from '@/lib/chave-de-api'
import type { ErrosDeCampo } from '@/lib/formulario'

/** Versão do contrato da API. Muda de número se algum campo mudar de sentido. */
export const VERSAO_DA_API = '1'

// ---------------------------------------------------------------------------
// Respostas
// ---------------------------------------------------------------------------

/**
 * Códigos de erro. São estáveis e em português, como todo o resto (regra 1).
 * O integrador programa contra o `erro`; a `mensagem` é para quem lê o log.
 */
export type CodigoDeErro =
  | 'nao_autenticado'
  | 'sem_permissao'
  | 'dados_invalidos'
  | 'nao_encontrado'
  | 'conflito'
  | 'corpo_invalido'

const STATUS: Record<CodigoDeErro, number> = {
  nao_autenticado: 401,
  sem_permissao: 403,
  dados_invalidos: 422,
  nao_encontrado: 404,
  conflito: 409,
  corpo_invalido: 400,
}

/**
 * Nenhuma resposta da API vai para cache. São dados de processo de cliente;
 * um proxy intermediário guardando a resposta de uma chave e devolvendo para
 * outra seria vazamento silencioso.
 */
const CABECALHOS = {
  'Cache-Control': 'no-store, max-age=0',
  'X-Versao-Api': VERSAO_DA_API,
} as const

export function responder(dados: unknown, status = 200): NextResponse {
  return NextResponse.json(dados, { status, headers: CABECALHOS })
}

export function falhar(
  codigo: CodigoDeErro,
  mensagem: string,
  extra?: { campos?: ErrosDeCampo; conflito?: Record<string, unknown> },
): NextResponse {
  return NextResponse.json(
    {
      erro: codigo,
      mensagem,
      ...(extra?.campos === undefined ? {} : { campos: extra.campos }),
      ...(extra?.conflito === undefined ? {} : extra.conflito),
    },
    {
      status: STATUS[codigo],
      headers:
        codigo === 'nao_autenticado'
          ? { ...CABECALHOS, 'WWW-Authenticate': 'Bearer' }
          : CABECALHOS,
    },
  )
}

// ---------------------------------------------------------------------------
// Autenticação
// ---------------------------------------------------------------------------

export type Autenticada =
  | { ok: true; credencial: CredencialAutenticada }
  | { ok: false; resposta: NextResponse }

/**
 * Confere só a chave, sem exigir permissão. Serve ao endpoint que descreve a
 * própria credencial: uma chave que só escreve também precisa poder conferir
 * a si mesma.
 */
export async function exigirQualquerCredencial(
  requisicao: NextRequest,
): Promise<Autenticada> {
  const chave = chaveDoCabecalho(requisicao.headers.get('authorization'))
  const credencial = await autenticarChave(chave)

  if (credencial === null) {
    return { ok: false, resposta: semChave() }
  }

  void anotarUso(credencial.credencialId)
  return { ok: true, credencial }
}

function semChave(): NextResponse {
  return falhar(
    'nao_autenticado',
    'Chave ausente, inválida ou revogada. Envie o cabeçalho Authorization: Bearer <chave>.',
  )
}

/**
 * Confere a chave e a permissão exigida pela rota.
 *
 * A permissão é checada **aqui**, antes do domínio, e não dentro dele: a
 * sessão que a credencial carrega é de operador, então `exigirEquipe` deixaria
 * qualquer chave escrever. É esta função que separa a chave de leitura da
 * chave de escrita.
 */
export async function exigirCredencial(
  requisicao: NextRequest,
  permissao: PermissaoApi,
): Promise<Autenticada> {
  const chave = chaveDoCabecalho(requisicao.headers.get('authorization'))
  const credencial = await autenticarChave(chave)

  if (credencial === null) {
    return { ok: false, resposta: semChave() }
  }

  if (!podeNaApi(credencial, permissao)) {
    return {
      ok: false,
      resposta: falhar(
        'sem_permissao',
        `Esta chave não tem a permissão ${permissao}.`,
      ),
    }
  }

  // Fora do caminho da resposta: anotar o uso não pode atrasar a requisição.
  void anotarUso(credencial.credencialId)

  return { ok: true, credencial }
}

// ---------------------------------------------------------------------------
// Corpo da requisição
// ---------------------------------------------------------------------------

export type CorpoLido =
  | { ok: true; corpo: Record<string, unknown> }
  | { ok: false; resposta: NextResponse }

export async function lerCorpo(requisicao: NextRequest): Promise<CorpoLido> {
  let bruto: unknown
  try {
    bruto = await requisicao.json()
  } catch {
    return {
      ok: false,
      resposta: falhar('corpo_invalido', 'O corpo da requisição não é JSON válido.'),
    }
  }

  if (typeof bruto !== 'object' || bruto === null || Array.isArray(bruto)) {
    return {
      ok: false,
      resposta: falhar('corpo_invalido', 'O corpo da requisição deve ser um objeto JSON.'),
    }
  }

  return { ok: true, corpo: bruto as Record<string, unknown> }
}

/**
 * Traz o valor do JSON para a forma que os validadores do sistema esperam.
 *
 * Os mesmos `validarCliente`, `validarCaso` e `validarAndamento` que o painel
 * usa — de propósito. Se a API tivesse validação própria, um dia ela aceitaria
 * um CPF que a tela recusa, e o sistema passaria a ter duas opiniões sobre o
 * que é um cadastro válido.
 */
/**
 * O "quem fez" que vai para a auditoria (regra 6).
 *
 * Não é e-mail: o usuário da credencial não tem nenhum, de propósito. É o nome
 * da chave, que é o que alguém lendo o registro seis meses depois precisa ver
 * — "API · Site institucional" diz mais do que um id.
 */
export function autorDaCredencial(credencial: CredencialAutenticada): string {
  return `API · ${credencial.nome}`
}

export function comoTexto(valor: unknown): string {
  if (valor === undefined || valor === null) return ''
  if (typeof valor === 'string') return valor
  if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor)
  return ''
}
