'use server'

import { revalidatePath } from 'next/cache'

import {
  desvincularRepresentante,
  vincularRepresentante,
} from '@/lib/clientes'
import { texto, type ErrosDeCampo } from '@/lib/formulario'
import { emailDaSessao, exigirSessaoDaEquipe } from '@/lib/sessao'

export type EstadoDoRepresentante =
  | { erros?: ErrosDeCampo; mensagem?: string; sucesso?: boolean }
  | undefined

export async function vincularSocio(
  pessoaJuridicaId: string,
  _estado: EstadoDoRepresentante,
  dados: FormData,
): Promise<EstadoDoRepresentante> {
  const sessao = await exigirSessaoDaEquipe()

  const documento = texto(dados, 'documento')
  const qualificacao = texto(dados, 'qualificacao').trim()

  const resultado = await vincularRepresentante(
    sessao,
    pessoaJuridicaId,
    documento,
    qualificacao === '' ? null : qualificacao,
    await emailDaSessao(sessao),
  )

  if (resultado.situacao === 'nao_e_pessoa_fisica') {
    return {
      erros: {
        documento:
          'Informe o CPF do sócio. O representante legal é sempre pessoa física.',
      },
    }
  }

  if (resultado.situacao === 'empresa_nao_encontrada') {
    return { mensagem: 'Empresa não encontrada.' }
  }

  // Não cadastra a pessoa por conta própria: o sócio é um cliente como
  // qualquer outro e passa pelas mesmas exigências de qualificação.
  if (resultado.situacao === 'pessoa_nao_encontrada') {
    return {
      erros: {
        documento:
          'Não há cliente pessoa física com este CPF. Cadastre-o primeiro — o sócio é um cadastro de cliente como outro qualquer.',
      },
    }
  }

  if (resultado.situacao === 'ja_vinculado') {
    return { erros: { documento: `${resultado.nome} já é representante desta empresa.` } }
  }

  revalidatePath(`/painel/clientes/${pessoaJuridicaId}`)
  return { sucesso: true }
}

export async function desvincularSocio(
  pessoaJuridicaId: string,
  pessoaFisicaId: string,
): Promise<void> {
  const sessao = await exigirSessaoDaEquipe()

  await desvincularRepresentante(
    sessao,
    pessoaJuridicaId,
    pessoaFisicaId,
    await emailDaSessao(sessao),
  )

  revalidatePath(`/painel/clientes/${pessoaJuridicaId}`)
}
