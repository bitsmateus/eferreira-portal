/**
 * O que a conta do D4Sign tem — `npm run d4sign:conta`.
 *
 * Duas perguntas que aparecem sempre e não têm resposta no painel do portal:
 *
 *   1. em qual cofre os documentos do portal devem ser criados?
 *      (é o `D4SIGN_COFRE` do `.env`, e o UUID não se adivinha)
 *   2. quantos envios ainda cabem?
 *      (cada assinatura consome um crédito da conta do escritório)
 *
 * Só leitura: nada aqui manda e-mail nem gasta crédito.
 */

import 'dotenv/config'
import { configuracaoD4Sign, listarCofres, saldo } from '../src/lib/d4sign'

async function principal(): Promise<void> {
  const configuracao = configuracaoD4Sign()

  if (configuracao === null) {
    console.error('D4Sign não configurado.\n')
    console.error('Preencha no .env: D4SIGN_TOKEN_API e D4SIGN_CRYPT_KEY.')
    console.error('Ver .env.example.')
    process.exitCode = 1
    return
  }

  const ambiente = configuracao.url.includes('sandbox') ? 'SANDBOX' : 'PRODUÇÃO'
  console.log(`Ambiente: ${ambiente}  (${configuracao.url})`)

  const conta = await saldo(configuracao)
  console.log(`Créditos: ${conta.usados} usados de ${conta.creditos}`)
  console.log(`Restam:   ${conta.restantes} envio(s)\n`)

  if (ambiente === 'PRODUÇÃO') {
    console.log('ATENÇÃO: em produção não há ensaio. Todo envio consome um')
    console.log('crédito e manda e-mail de verdade para quem estiver na lista.\n')
  }

  const cofres = await listarCofres(configuracao)
  console.log(`Cofres (${cofres.length}):\n`)

  const escolhido = configuracao.cofre
  for (const cofre of cofres) {
    const marca = cofre.uuid === escolhido ? ' ←  D4SIGN_COFRE' : ''
    console.log(`  ${cofre.uuid}  ${cofre.nome}${marca}`)
  }

  if (escolhido === '') {
    console.log('\nD4SIGN_COFRE está vazio. Copie o UUID do cofre escolhido')
    console.log('para o .env antes de enviar qualquer documento.')
  } else if (!cofres.some((cofre) => cofre.uuid === escolhido)) {
    console.log('\nATENÇÃO: o D4SIGN_COFRE do .env não está na lista acima.')
    console.log('Ou o cofre foi apagado, ou a credencial é de outra conta.')
  }
}

void principal()
