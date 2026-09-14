/**
 * Prova das credenciais de SMTP — `npm run email:teste`.
 *
 * Existe porque a falha de e-mail é silenciosa de propósito: a tela de entrada
 * do cliente responde sempre a mesma coisa, exista o cadastro ou não, e o mesmo
 * vale se o servidor de e-mail recusar a conexão. É a resposta certa para quem
 * está do outro lado — e péssima para quem está configurando, que fica sem
 * saber se o código não chegou porque o CPF não é cliente ou porque a senha
 * está errada.
 *
 * Este script tira a dúvida: usa exatamente a mesma configuração e o mesmo
 * transporte da aplicação, e diz em português o que o servidor respondeu.
 *
 * Nenhum segredo aparece na saída (regra 8): só o servidor, a porta e o
 * usuário, que já estão no `.env.example`.
 */

import 'dotenv/config'
import { configuracaoSmtp, enviarEmail, fecharTransporte } from '../src/lib/email'
import { mensagemDeCodigo } from '../src/lib/mensagens'
import { MINUTOS_DE_VALIDADE } from '../src/lib/acesso'

/**
 * Traduz a recusa do servidor. O Google, em especial, responde a senha comum
 * com o mesmo erro de senha errada — e quem não souber disso vai reconferir a
 * senha certa a tarde inteira.
 */
function explicar(erro: unknown): string[] {
  const texto = erro instanceof Error ? erro.message : String(erro)
  const codigo = (erro as { code?: string } | null)?.code ?? ''

  if (texto.includes('535') || texto.includes('Username and Password not accepted')) {
    return [
      'O servidor recusou usuário e senha.',
      '',
      'Se a conta é Gmail ou Google Workspace, quase sempre é isto: o Google',
      'não aceita a senha normal da conta no SMTP. É preciso',
      '',
      '  1. ativar a verificação em duas etapas na conta;',
      '  2. gerar uma SENHA DE APP em myaccount.google.com/apppasswords;',
      '  3. pôr essa senha de dezesseis caracteres em SMTP_SENHA.',
      '',
      'Com a senha comum a resposta é sempre esta, e nenhuma outra',
      'configuração resolve.',
    ]
  }

  if (codigo === 'ETIMEDOUT' || codigo === 'ESOCKET' || texto.includes('ECONNREFUSED')) {
    return [
      'Não foi possível chegar ao servidor.',
      '',
      'Confira SMTP_SERVIDOR e SMTP_PORTA. Em 465 o SMTP_SEGURO precisa ser',
      '"true"; em 587, "false". Alguns provedores e redes bloqueiam a saída',
      'nessas portas — vale testar de outra conexão.',
    ]
  }

  if (texto.includes('Invalid login') || texto.includes('BadCredentials')) {
    return ['O servidor recusou o login. Confira SMTP_USUARIO e SMTP_SENHA.']
  }

  return ['O servidor respondeu:', '', texto]
}

async function principal(): Promise<void> {
  const configuracao = configuracaoSmtp()

  if (configuracao === null) {
    console.error('SMTP não configurado.\n')
    console.error('Preencha no .env: SMTP_SERVIDOR, SMTP_USUARIO, SMTP_SENHA e')
    console.error('EMAIL_REMETENTE. Ver .env.example.')
    process.exitCode = 1
    return
  }

  const destino = (process.env['EMAIL_DE_TESTE'] ?? '').trim() || configuracao.usuario

  console.log('Servidor:', `${configuracao.servidor}:${configuracao.porta}`)
  console.log('Seguro:  ', configuracao.seguro ? 'TLS implícito' : 'STARTTLS')
  console.log('Usuário: ', configuracao.usuario)
  console.log('Enviando para:', destino, '\n')

  // O mesmo e-mail que o cliente recebe, com um código de mentira. Assim o
  // teste prova o caminho inteiro: transporte, remetente e a mensagem em si.
  const resultado = await enviarEmail(
    mensagemDeCodigo(destino, 'Teste de configuração', '000000', MINUTOS_DE_VALIDADE),
  )

  if (resultado.situacao === 'enviado') {
    console.log('Enviado. Confira a caixa de entrada — e o spam.')
    console.log('')
    console.log('Se cair no spam, o remetente precisa de SPF e DKIM no domínio.')
    console.log('Código de acesso no spam é cliente que não entra.')
  } else if (resultado.situacao === 'impresso_no_terminal') {
    console.log('Sem SMTP configurado: a mensagem saiu no terminal, acima.')
  } else {
    console.error('Falhou.\n')
    for (const linha of explicar(resultado.erro)) console.error(linha)
    process.exitCode = 1
  }

  fecharTransporte()
}

void principal()
