'use server'

import { headers } from 'next/headers'

import { MINUTOS_DE_VALIDADE } from '@/lib/redefinicao'
import {
  confirmarRedefinicao,
  pedirRedefinicao,
  validarPedido,
  validarRedefinicao,
} from '@/lib/redefinicao-de-senha'
import { texto } from '@/lib/formulario'
import { ESTADO_INICIAL, type EstadoDaRecuperacao } from './estado'

/**
 * O mesmo texto para todo mundo, pelo mesmo motivo de `AVISO_NEUTRO` em
 * `src/app/consultar/acoes.ts`: uma frase afirmativa entregaria quais e-mails
 * têm acesso ao painel.
 */
const AVISO_NEUTRO =
  `Se este e-mail tiver acesso ao painel, um código para redefinir a senha ` +
  `foi enviado para ele. Ele vale por ${MINUTOS_DE_VALIDADE} minutos.`

async function origemDaRequisicao() {
  const cabecalhos = await headers()
  return {
    enderecoIp: cabecalhos.get('x-forwarded-for'),
    agenteUsuario: cabecalhos.get('user-agent'),
  }
}

export async function recuperarSenha(
  estadoAnterior: EstadoDaRecuperacao,
  dados: FormData,
): Promise<EstadoDaRecuperacao> {
  const acao = texto(dados, 'acao')

  if (acao === 'trocar') return ESTADO_INICIAL

  if (acao === 'pedir' || acao === 'reenviar') {
    const conferido = validarPedido({ email: texto(dados, 'email') })

    if (!conferido.ok) {
      return { ...estadoAnterior, erros: conferido.erros, aviso: null }
    }

    const { email } = conferido.dados

    // O envio (ou o não-envio) acontece aqui dentro e não muda a resposta.
    await pedirRedefinicao(email, await origemDaRequisicao())

    return {
      passo: 'codigo',
      email,
      erros: {},
      aviso: AVISO_NEUTRO,
      pedidoEm: Date.now(),
    }
  }

  const conferido = validarRedefinicao({
    email: texto(dados, 'email'),
    codigo: texto(dados, 'codigo'),
    senha: texto(dados, 'senha'),
    confirmacao: texto(dados, 'confirmacao'),
  })

  if (!conferido.ok) {
    return {
      ...estadoAnterior,
      passo: 'codigo',
      erros: conferido.erros,
      aviso: null,
    }
  }

  const { email, codigo, senha } = conferido.dados
  const resultado = await confirmarRedefinicao(
    email,
    codigo,
    senha,
    await origemDaRequisicao(),
  )

  if (resultado.situacao !== 'redefinida') {
    return {
      ...estadoAnterior,
      passo: 'codigo',
      email,
      erros: {
        codigo:
          'Código incorreto ou vencido. Peça um novo código — o anterior ' +
          'deixa de valer assim que outro é enviado.',
      },
      aviso: null,
    }
  }

  return { passo: 'concluida', email, erros: {}, aviso: null, pedidoEm: null }
}
