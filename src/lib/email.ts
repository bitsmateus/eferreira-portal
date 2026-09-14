/**
 * Envio de e-mail por SMTP.
 *
 * O escritório tem servidor SMTP próprio (confirmado em 14/09/2026), e é por
 * ele que sai o código de acesso do cliente — Anexo II, item 3.6.
 *
 * Regra 8: nada de credencial no repositório. Servidor, usuário e senha vêm de
 * variável de ambiente e ficam marcados como secretos no EasyPanel.
 *
 * Princípio da stack: nada proprietário. SMTP é padrão aberto; trocar de
 * provedor é mudar quatro variáveis, não reescrever código.
 */

import { createTransport, type Transporter } from 'nodemailer'

export type Mensagem = {
  para: string
  assunto: string
  texto: string
  html: string
}

export type ResultadoDeEnvio =
  | { situacao: 'enviado' }
  /** Sem SMTP configurado: em desenvolvimento, o e-mail vai para o terminal. */
  | { situacao: 'impresso_no_terminal' }
  | { situacao: 'falhou'; erro: unknown }

function variavel(nome: string): string {
  return (process.env[nome] ?? '').trim()
}

export type ConfiguracaoSmtp = {
  servidor: string
  porta: number
  seguro: boolean
  usuario: string
  senha: string
  remetente: string
}

/**
 * Lê a configuração do ambiente, ou devolve null se ela não estiver completa.
 * Null não é erro: em desenvolvimento é o estado normal, e o código vai para o
 * terminal em vez do e-mail.
 */
export function configuracaoSmtp(): ConfiguracaoSmtp | null {
  const servidor = variavel('SMTP_SERVIDOR')
  const usuario = variavel('SMTP_USUARIO')
  const senha = variavel('SMTP_SENHA')
  const remetente = variavel('EMAIL_REMETENTE')

  if (servidor === '' || usuario === '' || senha === '' || remetente === '') {
    return null
  }

  const porta = Number(variavel('SMTP_PORTA') || '587')

  return {
    servidor,
    porta: Number.isFinite(porta) && porta > 0 ? porta : 587,
    // 465 é TLS implícito; 587 sobe para TLS com STARTTLS.
    seguro: variavel('SMTP_SEGURO') === 'true' || porta === 465,
    usuario,
    senha,
    remetente,
  }
}

/**
 * Um transporte só para todo o processo. Abrir conexão SMTP a cada e-mail é
 * lento e, em servidor com limite de conexões, é um jeito de ser bloqueado.
 */
let transporte: Transporter | null = null

function obterTransporte(configuracao: ConfiguracaoSmtp): Transporter {
  if (transporte === null) {
    transporte = createTransport({
      host: configuracao.servidor,
      port: configuracao.porta,
      secure: configuracao.seguro,
      auth: { user: configuracao.usuario, pass: configuracao.senha },
      pool: true,
    })
  }
  return transporte
}

/** Fecha o transporte. Só os testes e o desligamento do processo usam. */
export function fecharTransporte(): void {
  transporte?.close()
  transporte = null
}

/**
 * Manda a mensagem. NUNCA lança: quem chama decide o que fazer, e no caso do
 * código de acesso a decisão é sempre a mesma resposta na tela — ver o
 * comentário sobre enumeração em `src/lib/acesso-do-cliente.ts`.
 */
export async function enviarEmail(mensagem: Mensagem): Promise<ResultadoDeEnvio> {
  const configuracao = configuracaoSmtp()

  if (configuracao === null) {
    if (process.env.NODE_ENV === 'production') {
      // Em produção isto é falha de implantação, não modo de desenvolvimento.
      console.error(
        '[e-mail] SMTP não configurado. O cliente não recebeu:',
        mensagem.assunto,
      )
      return { situacao: 'falhou', erro: new Error('SMTP não configurado.') }
    }

    console.info(
      [
        '',
        '─────────── e-mail que sairia por SMTP ───────────',
        `Para:    ${mensagem.para}`,
        `Assunto: ${mensagem.assunto}`,
        '',
        mensagem.texto,
        '──────────────────────────────────────────────────',
        '',
      ].join('\n'),
    )
    return { situacao: 'impresso_no_terminal' }
  }

  try {
    await obterTransporte(configuracao).sendMail({
      from: configuracao.remetente,
      to: mensagem.para,
      subject: mensagem.assunto,
      text: mensagem.texto,
      html: mensagem.html,
    })
    return { situacao: 'enviado' }
  } catch (erro) {
    // O endereço fica de fora do log: e-mail de cliente em log de servidor é
    // dado pessoal circulando onde não precisa (LGPD).
    console.error('[e-mail] falha no envio:', erro)
    return { situacao: 'falhou', erro }
  }
}
