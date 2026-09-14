'use server'

import { AuthError } from 'next-auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { signIn } from '@/auth'
import { MINUTOS_DE_VALIDADE } from '@/lib/acesso'
import {
  pedirCodigo,
  validarConferencia,
  validarPedido,
} from '@/lib/acesso-do-cliente'
import { formatarDocumento } from '@/lib/documento'
import { texto } from '@/lib/formulario'
import { ESTADO_INICIAL, type EstadoDaConsulta } from './estado'

/**
 * O mesmo texto para todo mundo. Ele fala no condicional de propósito: "se
 * estiver cadastrado". Uma frase afirmativa ("enviamos para o seu e-mail")
 * responderia, para qualquer um, se aquele CPF é cliente deste escritório.
 */
const AVISO_NEUTRO =
  `Se o CPF ou CNPJ estiver cadastrado e o contrato já tiver sido assinado, ` +
  `um código foi enviado para o e-mail do cadastro. Ele vale por ` +
  `${MINUTOS_DE_VALIDADE} minutos.`

async function origemDaRequisicao() {
  const cabecalhos = await headers()
  return {
    enderecoIp: cabecalhos.get('x-forwarded-for'),
    agenteUsuario: cabecalhos.get('user-agent'),
  }
}

export async function consultar(
  estadoAnterior: EstadoDaConsulta,
  dados: FormData,
): Promise<EstadoDaConsulta> {
  const acao = texto(dados, 'acao')

  if (acao === 'trocar') return ESTADO_INICIAL

  if (acao === 'pedir' || acao === 'reenviar') {
    const conferido = validarPedido({ documento: texto(dados, 'documento') })

    if (!conferido.ok) {
      return { ...estadoAnterior, erros: conferido.erros, aviso: null }
    }

    const { documento } = conferido.dados

    // O envio (ou o não-envio) acontece aqui dentro e não muda a resposta.
    await pedirCodigo(documento, await origemDaRequisicao())

    return {
      passo: 'codigo',
      documento,
      documentoFormatado: formatarDocumento(documento),
      erros: {},
      aviso: AVISO_NEUTRO,
      pedidoEm: Date.now(),
    }
  }

  const conferido = validarConferencia({
    documento: texto(dados, 'documento'),
    codigo: texto(dados, 'codigo'),
  })

  if (!conferido.ok) {
    return { ...estadoAnterior, erros: conferido.erros, aviso: null }
  }

  const { documento, codigo } = conferido.dados
  const origem = await origemDaRequisicao()

  try {
    await signIn('codigo-do-cliente', {
      documento,
      codigo,
      enderecoIp: origem.enderecoIp ?? '',
      agenteUsuario: origem.agenteUsuario ?? '',
      redirect: false,
    })
  } catch (erro) {
    if (erro instanceof AuthError) {
      return {
        ...estadoAnterior,
        passo: 'codigo',
        documento,
        documentoFormatado: formatarDocumento(documento),
        erros: {
          codigo: `Código incorreto ou vencido. Peça um novo código — o ` +
            `anterior deixa de valer assim que outro é enviado.`,
        },
        aviso: null,
      }
    }
    throw erro
  }

  redirect('/meus-processos')
}
