/**
 * Os agentes de IA do escritório, um por área (16/11/2026).
 *
 * Cada pasta de `src/agentes/` tem dois arquivos que vieram da pasta "Agentes"
 * do Dropbox do Dr. Sergio:
 *
 *  - `instrucoes.txt`: o agente, transcrito sem mudar uma palavra (regra 10).
 *    Os oito têm o mesmo núcleo (operação, protocolo de convencimento,
 *    pesquisa, rastreabilidade, prazos) e diferem a partir de "ESCOPO
 *    ESPECIALIZADO".
 *  - `modelo.txt`: a petição de exemplo da área, em texto, com os dados
 *    pessoais trocados por marcadores entre colchetes ("[NOME DO AUTOR]",
 *    "[CPF]"…). Pedido do escritório: "faça você mesmo". O original, com os
 *    dados reais, não entra no repositório — e não vai à IA a cada minuta.
 *
 * A análise da publicação usa só a parte especializada (mais barata); a
 * minuta usa o agente inteiro e o modelo.
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { AreaDoCaso } from '@prisma/client'

import { PASTA_DA_AREA } from '@/lib/areas'

const PASTA_AGENTES = join(process.cwd(), 'src', 'agentes')
const MARCA_DA_ESPECIALIZACAO = 'ESCOPO ESPECIALIZADO'

export type Agente = {
  /** O texto inteiro do agente — o "sistema" da minuta. */
  instrucoes: string
  /** De "ESCOPO ESPECIALIZADO" até o fim — o que muda de uma área para outra. */
  especializacao: string
  /** A petição de referência, já sem dados pessoais. */
  modelo: string
}

/** Tira BOM e fim de linha do Windows, que os arquivos trazem do Word. */
export function normalizarTexto(texto: string): string {
  return texto.replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim()
}

/** A parte do agente que é da área. Sem a marca, devolve o texto inteiro. Exportado para teste. */
export function especializacaoDoAgente(instrucoes: string): string {
  const inicio = instrucoes.indexOf(MARCA_DA_ESPECIALIZACAO)
  return inicio === -1 ? instrucoes : instrucoes.slice(inicio)
}

const cache = new Map<AreaDoCaso, Agente>()

export async function lerAgente(area: AreaDoCaso): Promise<Agente> {
  const guardado = cache.get(area)
  if (guardado !== undefined) return guardado

  const pasta = join(PASTA_AGENTES, PASTA_DA_AREA[area])
  const [instrucoes, modelo] = await Promise.all([
    readFile(join(pasta, 'instrucoes.txt'), 'utf8').then(normalizarTexto),
    readFile(join(pasta, 'modelo.txt'), 'utf8').then(normalizarTexto),
  ])
  const agente = { instrucoes, especializacao: especializacaoDoAgente(instrucoes), modelo }
  cache.set(area, agente)
  return agente
}
