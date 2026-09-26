'use server'

import { revalidatePath } from 'next/cache'

import {
  alterarSituacaoDoAdvogado,
  atualizarAdvogado,
  criarAdvogado,
  tornarAdvogadoPadrao,
  validarAdvogado,
  type CamposDeAdvogado,
} from '@/lib/advogados'
import { texto, type ErrosDeCampo } from '@/lib/formulario'
import { emailDaSessao, exigirSessaoDaEquipe } from '@/lib/sessao'

export type EstadoDoAdvogado =
  | { erros?: ErrosDeCampo; mensagem?: string; sucesso?: boolean }
  | undefined

function lerCampos(dados: FormData): CamposDeAdvogado {
  return {
    nome: texto(dados, 'nome'),
    genero: texto(dados, 'genero'),
    nacionalidade: texto(dados, 'nacionalidade'),
    estadoCivil: texto(dados, 'estadoCivil'),
    oab: texto(dados, 'oab'),
    oabUf: texto(dados, 'oabUf'),
  }
}

export async function cadastrarAdvogado(
  _estado: EstadoDoAdvogado,
  dados: FormData,
): Promise<EstadoDoAdvogado> {
  const sessao = await exigirSessaoDaEquipe()

  const conferido = validarAdvogado(lerCampos(dados))
  if (!conferido.ok) return { erros: conferido.erros }

  const resultado = await criarAdvogado(sessao, conferido.dados, await emailDaSessao(sessao))
  if (resultado.situacao === 'repetido') {
    return { erros: { oab: 'Já existe um advogado com esta OAB.' } }
  }

  revalidatePath('/painel/advogados')
  return { sucesso: true }
}

export async function salvarEdicaoDeAdvogado(
  id: string,
  _estado: EstadoDoAdvogado,
  dados: FormData,
): Promise<EstadoDoAdvogado> {
  const sessao = await exigirSessaoDaEquipe()

  const conferido = validarAdvogado(lerCampos(dados))
  if (!conferido.ok) return { erros: conferido.erros }

  const resultado = await atualizarAdvogado(sessao, id, conferido.dados, await emailDaSessao(sessao))
  if (resultado.situacao === 'nao_encontrado') return { mensagem: 'Advogado não encontrado.' }
  if (resultado.situacao === 'repetido') {
    return { erros: { oab: 'Já existe outro advogado com esta OAB.' } }
  }

  revalidatePath('/painel/advogados')
  return { sucesso: true }
}

export async function desativarAdvogado(id: string): Promise<EstadoDoAdvogado> {
  const sessao = await exigirSessaoDaEquipe()

  const resultado = await alterarSituacaoDoAdvogado(sessao, id, false, await emailDaSessao(sessao))
  if (resultado.situacao === 'ultimo_ativo') {
    return { mensagem: 'É o único advogado ativo. Cadastre outro antes de desativar este.' }
  }
  if (resultado.situacao === 'nao_encontrado') return { mensagem: 'Advogado não encontrado.' }

  revalidatePath('/painel/advogados')
  return { sucesso: true }
}

export async function reativarAdvogado(id: string): Promise<EstadoDoAdvogado> {
  const sessao = await exigirSessaoDaEquipe()

  const resultado = await alterarSituacaoDoAdvogado(sessao, id, true, await emailDaSessao(sessao))
  if (resultado.situacao === 'nao_encontrado') return { mensagem: 'Advogado não encontrado.' }

  revalidatePath('/painel/advogados')
  return { sucesso: true }
}

export async function definirComoPadrao(id: string): Promise<EstadoDoAdvogado> {
  const sessao = await exigirSessaoDaEquipe()

  const resultado = await tornarAdvogadoPadrao(sessao, id, await emailDaSessao(sessao))
  if (resultado.situacao === 'nao_encontrado') return { mensagem: 'Advogado não encontrado.' }

  revalidatePath('/painel/advogados')
  return { sucesso: true }
}
