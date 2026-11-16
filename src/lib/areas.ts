/**
 * As oito áreas do escritório, uma por agente de IA (pasta "Agentes" enviada
 * pelo Dr. Sergio em 16/11/2026). Sem nada de servidor: o formulário do caso
 * e a tela de Publicações importam daqui.
 *
 * A ordem é a das pastas do escritório (1.Trabalhista … 8.Familia).
 */

import { AreaDoCaso } from '@prisma/client'

export const AREAS: readonly AreaDoCaso[] = [
  AreaDoCaso.TRABALHISTA,
  AreaDoCaso.CONSUMIDOR,
  AreaDoCaso.SAUDE,
  AreaDoCaso.BANCARIO,
  AreaDoCaso.TRANSITO,
  AreaDoCaso.EXECUCOES,
  AreaDoCaso.CIVEL_EMPRESARIAL,
  AreaDoCaso.FAMILIA,
]

export const ROTULO_DA_AREA: Record<AreaDoCaso, string> = {
  TRABALHISTA: 'Trabalhista',
  CONSUMIDOR: 'Consumidor',
  SAUDE: 'Saúde e pessoa com deficiência',
  BANCARIO: 'Bancário e revisionais',
  TRANSITO: 'Trânsito (DETRAN)',
  EXECUCOES: 'Execuções e cobranças',
  CIVEL_EMPRESARIAL: 'Cível e empresarial',
  FAMILIA: 'Família',
}

/** A pasta de cada agente em `src/agentes/`. */
export const PASTA_DA_AREA: Record<AreaDoCaso, string> = {
  TRABALHISTA: 'trabalhista',
  CONSUMIDOR: 'consumidor',
  SAUDE: 'saude',
  BANCARIO: 'bancario',
  TRANSITO: 'transito',
  EXECUCOES: 'execucoes',
  CIVEL_EMPRESARIAL: 'civel-empresarial',
  FAMILIA: 'familia',
}

/** `null` quando o texto não é uma área conhecida — nunca confia no navegador (regra 2). */
export function lerArea(valor: string | null | undefined): AreaDoCaso | null {
  return (AREAS as readonly string[]).includes(valor ?? '') ? (valor as AreaDoCaso) : null
}
