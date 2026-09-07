'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  atualizarCaso,
  criarCaso,
  validarCaso,
  type CamposDeCaso,
} from '@/lib/casos'
import { texto, type ErrosDeCampo } from '@/lib/formulario'
import { emailDaSessao, exigirSessaoDaEquipe } from '@/lib/sessao'

export type EstadoDoCaso =
  | {
      erros?: ErrosDeCampo
      mensagem?: string
      /** Caso que já usa a numeração informada. */
      conflito?: { id: string }
    }
  | undefined

function lerCampos(dados: FormData): CamposDeCaso {
  return {
    numeroProcesso: texto(dados, 'numeroProcesso'),
    assunto: texto(dados, 'assunto'),
    vara: texto(dados, 'vara'),
    parteContraria: texto(dados, 'parteContraria'),
    situacao: texto(dados, 'situacao'),
    responsavelId: texto(dados, 'responsavelId'),
  }
}

export async function cadastrarCaso(
  clienteId: string,
  _estado: EstadoDoCaso,
  dados: FormData,
): Promise<EstadoDoCaso> {
  const sessao = await exigirSessaoDaEquipe()

  const conferido = validarCaso(lerCampos(dados))
  if (!conferido.ok) return { erros: conferido.erros }

  const resultado = await criarCaso(
    sessao,
    clienteId,
    conferido.dados,
    await emailDaSessao(sessao),
  )

  if (resultado.situacao === 'cliente_nao_encontrado') {
    return { mensagem: 'Cliente não encontrado.' }
  }

  if (resultado.situacao === 'responsavel_invalido') {
    return {
      erros: {
        responsavelId:
          'Responsável inválido. Escolha um operador ou administrador ativo.',
      },
    }
  }

  if (resultado.situacao === 'numero_repetido') {
    return {
      erros: {
        numeroProcesso: 'Já existe um caso com este número de processo.',
      },
      conflito: { id: resultado.casoId },
    }
  }

  revalidatePath('/painel/casos')
  revalidatePath(`/painel/clientes/${clienteId}`)
  redirect(`/painel/casos/${resultado.casoId}`)
}

export async function salvarEdicaoDeCaso(
  id: string,
  _estado: EstadoDoCaso,
  dados: FormData,
): Promise<EstadoDoCaso> {
  const sessao = await exigirSessaoDaEquipe()

  const conferido = validarCaso(lerCampos(dados))
  if (!conferido.ok) return { erros: conferido.erros }

  const resultado = await atualizarCaso(
    sessao,
    id,
    conferido.dados,
    await emailDaSessao(sessao),
  )

  if (resultado.situacao === 'nao_encontrado') {
    return { mensagem: 'Caso não encontrado.' }
  }

  if (resultado.situacao === 'responsavel_invalido') {
    return {
      erros: {
        responsavelId:
          'Responsável inválido. Escolha um operador ou administrador ativo.',
      },
    }
  }

  if (resultado.situacao === 'numero_repetido') {
    return {
      erros: {
        numeroProcesso: 'Já existe um caso com este número de processo.',
      },
      conflito: { id: resultado.casoId },
    }
  }

  revalidatePath('/painel/casos')
  revalidatePath(`/painel/casos/${id}`)
  redirect(`/painel/casos/${id}`)
}
