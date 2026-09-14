/**
 * O texto dos e-mails que o sistema manda. Separado do envio para poder ser
 * lido, revisado pelo escritório e testado sem SMTP.
 *
 * Regra 10 não se aplica aqui: isto não é peça jurídica, é aviso operacional.
 * Ainda assim, o tom é o do protótipo — direto, sem jargão e sem promessa.
 */

import { ESCRITORIO } from '@/lib/escritorio'
import type { Mensagem } from '@/lib/email'

function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * O e-mail com o código de entrada.
 *
 * Repare no que ele NÃO diz: nada sobre processo, número, assunto ou parte
 * contrária. Caixa de e-mail é lugar que outras pessoas leem, e o conteúdo do
 * caso só aparece depois que o código foi conferido.
 */
export function mensagemDeCodigo(
  para: string,
  nome: string,
  codigo: string,
  minutosDeValidade: number,
): Mensagem {
  const assunto = `Seu código de acesso: ${codigo}`

  const texto = [
    `${nome},`,
    '',
    `Seu código para entrar no Portal do Cliente é ${codigo}.`,
    '',
    `Ele vale por ${minutosDeValidade} minutos e serve uma vez só.`,
    '',
    'Se não foi você que pediu, ignore este e-mail — sem o código ninguém',
    'entra — e avise o escritório.',
    '',
    `${ESCRITORIO.razaoSocial}`,
    `${ESCRITORIO.telefone} · ${ESCRITORIO.email}`,
  ].join('\n')

  const html = [
    '<div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;padding:28px 24px;color:#1E1E1E">',
    `<p style="margin:0 0 18px;font-size:15px">${escapar(nome)},</p>`,
    '<p style="margin:0 0 6px;font-size:15px">Seu código para entrar no Portal do Cliente:</p>',
    `<p style="margin:0 0 6px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:34px;letter-spacing:.22em;font-weight:600">${escapar(codigo)}</p>`,
    `<p style="margin:0 0 22px;font-size:13px;color:#5A5A5A">Vale por ${minutosDeValidade} minutos e serve uma vez só.</p>`,
    '<p style="margin:0 0 22px;font-size:13px;color:#5A5A5A">Se não foi você que pediu, ignore este e-mail — sem o código ninguém entra — e avise o escritório.</p>',
    '<hr style="border:0;border-top:1px solid #DCDCDC;margin:0 0 14px">',
    `<p style="margin:0;font-size:12px;color:#7A7A7A">${escapar(ESCRITORIO.razaoSocial)}<br>${escapar(ESCRITORIO.telefone)} · ${escapar(ESCRITORIO.email)}</p>`,
    '</div>',
  ].join('')

  return { para, assunto, texto, html }
}
