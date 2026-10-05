'use server'

import { revalidatePath } from 'next/cache'

import {
  lancarAndamento,
  validarAndamento,
  type CamposDeAndamento,
} from '@/lib/andamentos'
import {
  criarEvento,
  definirCumprimentoDoEvento,
  excluirEvento,
  validarEvento,
  type CamposDeEvento,
} from '@/lib/eventos'
import { texto, type ErrosDeCampo } from '@/lib/formulario'
import { emailDaSessao, exigirSessaoDaEquipe } from '@/lib/sessao'

export type EstadoDoAndamento =
  | { erros?: ErrosDeCampo; mensagem?: string; sucesso?: boolean }
  | undefined

export async function registrarAndamento(
  casoId: string,
  _estado: EstadoDoAndamento,
  dados: FormData,
): Promise<EstadoDoAndamento> {
  const sessao = await exigirSessaoDaEquipe()

  const campos: CamposDeAndamento = {
    data: texto(dados, 'data'),
    statusId: texto(dados, 'statusId'),
    statusPersonalizado: texto(dados, 'statusPersonalizado'),
    descricao: texto(dados, 'descricao'),
    encerraOCaso: texto(dados, 'encerraOCaso'),
  }

  const conferido = validarAndamento(campos)
  if (!conferido.ok) return { erros: conferido.erros }

  const resultado = await lancarAndamento(
    sessao,
    casoId,
    conferido.dados,
    await emailDaSessao(sessao),
  )

  if (resultado.situacao === 'caso_nao_encontrado') {
    return { mensagem: 'Caso não encontrado.' }
  }

  if (resultado.situacao === 'status_invalido') {
    return {
      erros: { statusId: 'Situação inválida. Escolha uma da lista.' },
    }
  }

  // Fica na mesma página: quem lança andamento costuma lançar outro em
  // seguida, e a linha do tempo logo abaixo já mostra o que acabou de entrar.
  revalidatePath(`/painel/casos/${casoId}`)
  revalidatePath('/painel')
  revalidatePath('/painel/casos')
  revalidatePath('/painel/clientes')

  return { sucesso: true }
}

// ---------------------------------------------------------------------------
// Eventos do caso — prazos e tarefas internas da equipe (05/10/2026). Ver o
// comentário grande em `src/lib/eventos.ts` sobre por que isto existe.
// ---------------------------------------------------------------------------

export type EstadoDoEvento =
  | { erros?: ErrosDeCampo; mensagem?: string; sucesso?: boolean }
  | undefined

export async function registrarEvento(
  casoId: string,
  _estado: EstadoDoEvento,
  dados: FormData,
): Promise<EstadoDoEvento> {
  const sessao = await exigirSessaoDaEquipe()

  const campos: CamposDeEvento = {
    responsavelId: texto(dados, 'responsavelId'),
    assunto: texto(dados, 'assunto'),
    prazoDeEntrega: texto(dados, 'prazoDeEntrega'),
  }

  const conferido = validarEvento(campos)
  if (!conferido.ok) return { erros: conferido.erros }

  const resultado = await criarEvento(
    sessao,
    casoId,
    conferido.dados,
    await emailDaSessao(sessao),
  )

  if (resultado.situacao === 'caso_nao_encontrado') {
    return { mensagem: 'Caso não encontrado.' }
  }

  if (resultado.situacao === 'responsavel_invalido') {
    return {
      erros: { responsavelId: 'Responsável inválido. Escolha um da lista.' },
    }
  }

  revalidatePath(`/painel/casos/${casoId}`)

  return { sucesso: true }
}

export type EstadoDeAcaoDeEvento = { erro?: string } | undefined

/** Marca ou desmarca o evento como cumprido — o botão de cada linha da lista. */
export async function concluirEvento(
  casoId: string,
  eventoId: string,
  cumprido: boolean,
): Promise<EstadoDeAcaoDeEvento> {
  const sessao = await exigirSessaoDaEquipe()

  const resultado = await definirCumprimentoDoEvento(
    sessao,
    eventoId,
    cumprido,
    await emailDaSessao(sessao),
  )

  if (resultado.situacao === 'nao_encontrado') {
    return { erro: 'Evento não encontrado.' }
  }

  revalidatePath(`/painel/casos/${casoId}`)
  return undefined
}

export async function excluirEventoDoCaso(
  casoId: string,
  eventoId: string,
): Promise<EstadoDeAcaoDeEvento> {
  const sessao = await exigirSessaoDaEquipe()

  const resultado = await excluirEvento(sessao, eventoId, await emailDaSessao(sessao))

  if (resultado.situacao === 'nao_encontrado') {
    return { erro: 'Evento não encontrado.' }
  }

  revalidatePath(`/painel/casos/${casoId}`)
  return undefined
}
