/**
 * Link "Adicionar ao Google Agenda" — não precisa de credencial nenhuma: abre a
 * tela de novo evento do Google já preenchida, na agenda de quem clicou. Sem
 * imports de servidor, para o componente de lista (cliente) poder usá-lo.
 */

import { diaEmSaoPaulo } from '@/lib/datas'

export const DURACAO_PADRAO_EM_MINUTOS = 60

/** '2026-10-20' + '14:30' → '20261020T143000' (hora de parede de São Paulo). */
function paraGoogle(dia: string, horario: string): string {
  return `${dia.replaceAll('-', '')}T${horario.replace(':', '')}00`
}

/** Soma minutos a "HH:MM" sem passar da meia-noite (o evento termina às 23:59). */
export function somarMinutos(horario: string, minutos: number): string {
  const [h = '0', m = '0'] = horario.split(':')
  const total = Math.min(Number(h) * 60 + Number(m) + minutos, 23 * 60 + 59)
  const hh = String(Math.floor(total / 60)).padStart(2, '0')
  const mm = String(total % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

export function linkParaGoogleAgenda(evento: {
  assunto: string
  prazoDeEntrega: Date
  horario: string | null
  responsavelNome: string
}): string {
  const dia = diaEmSaoPaulo(evento.prazoDeEntrega)

  let datas: string
  if (evento.horario === null) {
    // Dia inteiro: o Google espera o dia seguinte como fim (exclusivo).
    const seguinte = new Date(evento.prazoDeEntrega.getTime() + 24 * 60 * 60 * 1000)
    datas = `${dia.replaceAll('-', '')}/${diaEmSaoPaulo(seguinte).replaceAll('-', '')}`
  } else {
    const fim = somarMinutos(evento.horario, DURACAO_PADRAO_EM_MINUTOS)
    datas = `${paraGoogle(dia, evento.horario)}/${paraGoogle(dia, fim)}`
  }

  const parametros = new URLSearchParams({
    action: 'TEMPLATE',
    text: evento.assunto,
    dates: datas,
    ctz: 'America/Sao_Paulo',
    details: `Responsável: ${evento.responsavelNome}`,
  })
  return `https://calendar.google.com/calendar/render?${parametros.toString()}`
}
