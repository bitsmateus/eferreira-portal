/**
 * Datas — regra 11: guardar em UTC, exibir e calcular em America/Sao_Paulo.
 *
 * Nada neste projeto formata data com `toLocaleDateString()` sem fuso: o
 * servidor pode estar em qualquer lugar e a data do andamento é prova de
 * diligência. O fuso é sempre explícito.
 */

export const FUSO = 'America/Sao_Paulo'

const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const

function partesEmSaoPaulo(
  data: Date,
): { dia: string; mes: string; ano: string; hora: string; minuto: string } {
  const formatador = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const encontradas: Record<string, string> = {}
  for (const parte of formatador.formatToParts(data)) {
    encontradas[parte.type] = parte.value
  }

  return {
    dia: encontradas['day'] ?? '',
    mes: encontradas['month'] ?? '',
    ano: encontradas['year'] ?? '',
    // Em pt-BR a meia-noite sai como "24" em alguns runtimes; normalizamos.
    hora: (encontradas['hour'] ?? '') === '24' ? '00' : (encontradas['hour'] ?? ''),
    minuto: encontradas['minute'] ?? '',
  }
}

/** 31/08/2026 — formato das tabelas do painel. */
export function formatarData(data: Date): string {
  const { dia, mes, ano } = partesEmSaoPaulo(data)
  return `${dia}/${mes}/${ano}`
}

/** 31/08/2026, 09:12 — formato do registro de auditoria e do último acesso. */
export function formatarDataHora(data: Date): string {
  const { dia, mes, ano, hora, minuto } = partesEmSaoPaulo(data)
  return `${dia}/${mes}/${ano}, ${hora}:${minuto}`
}

/** 31 de agosto de 2026 — formato da linha do tempo na área do cliente. */
export function formatarDataExtenso(data: Date): string {
  const { dia, mes, ano } = partesEmSaoPaulo(data)
  const indice = Number(mes) - 1
  const nomeDoMes = MESES[indice] ?? ''
  return `${Number(dia)} de ${nomeDoMes} de ${ano}`
}

/** 2026-08-31 — chave estável para agrupamento, no fuso de São Paulo. */
export function diaEmSaoPaulo(data: Date): string {
  const { dia, mes, ano } = partesEmSaoPaulo(data)
  return `${ano}-${mes}-${dia}`
}

/** Segunda-feira, 31 de agosto de 2026 — subtítulo do painel, como no protótipo. */
export function formatarDiaPorExtensoComSemana(data: Date): string {
  const semana = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO,
    weekday: 'long',
  }).format(data)
  const capitalizada = semana.charAt(0).toUpperCase() + semana.slice(1)
  return `${capitalizada}, ${formatarDataExtenso(data)}`
}
