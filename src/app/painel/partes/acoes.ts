'use server'

import { revalidatePath } from 'next/cache'

import { criarParte, excluirParte, validarParte, type CamposDeParte } from '@/lib/partes'
import { texto, type ErrosDeCampo } from '@/lib/formulario'
import { emailDaSessao, exigirSessaoDaEquipe } from '@/lib/sessao'

export type EstadoDaParte = { erros?: ErrosDeCampo; mensagem?: string } | undefined

function lerCampos(dados: FormData): CamposDeParte {
  return {
    nome: texto(dados, 'nome'),
    email: texto(dados, 'email'),
    telefone: texto(dados, 'telefone'),
    papel: texto(dados, 'papel'),
    observacoes: texto(dados, 'observacoes'),
  }
}

export async function cadastrarParte(
  _estado: EstadoDaParte,
  dados: FormData,
): Promise<EstadoDaParte> {
  const sessao = await exigirSessaoDaEquipe()

  const conferido = validarParte(lerCampos(dados))
  if (!conferido.ok) return { erros: conferido.erros }

  await criarParte(sessao, conferido.dados, await emailDaSessao(sessao))

  revalidatePath('/painel/partes')
  return undefined
}

export async function excluirParteDaLista(
  parteId: string,
  _estado: EstadoDaParte,
  dados: FormData,
): Promise<EstadoDaParte> {
  const sessao = await exigirSessaoDaEquipe()

  // Mesmo cuidado de excluirCliente/excluirCaso: a confirmação viaja no
  // corpo do formulário, não só na tela — um POST solto não apaga nada.
  if (texto(dados, 'confirmacao') !== 'excluir') {
    return { mensagem: 'Exclusão não confirmada.' }
  }

  const excluida = await excluirParte(sessao, parteId, await emailDaSessao(sessao))
  if (!excluida) return { mensagem: 'Parte não encontrada.' }

  revalidatePath('/painel/partes')
  return undefined
}
