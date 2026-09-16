'use server'

import { revalidatePath } from 'next/cache'

import { excluirDocumento } from '@/lib/documentos'
import { texto } from '@/lib/formulario'
import { emailDaSessao, exigirSessaoDaEquipe } from '@/lib/sessao'

export type EstadoDaExclusaoDeDocumento = { erro?: string } | undefined

const RECADO: Record<string, string> = {
  nao_encontrado: 'Documento não encontrado.',
  assinado:
    'Este documento já está assinado — ele é a prova, e prova apagada não volta.',
  enviado_para_assinatura:
    'Este documento já tem um envio de assinatura eletrônica registrado. Apagá-lo ' +
    'destruiria esse registro — para quem foi, quando, e o que aconteceu — mesmo ' +
    'que ninguém tenha assinado ainda.',
}

/**
 * Apaga um documento da pasta do cliente.
 *
 * A confirmação viaja no corpo do formulário e é exigida aqui, não só na
 * tela: um POST solto nesta ação não pode apagar documento de ninguém.
 *
 * `clienteId` e `casoId` são só para revalidar as telas certas depois —
 * quem decide se ESTE documento pode ser tocado é `excluirDocumento`, pelo
 * filtro da sessão.
 */
export async function excluirDocumentoDaPasta(
  documentoId: string,
  clienteId: string,
  casoId: string | null,
  _estado: EstadoDaExclusaoDeDocumento,
  dados: FormData,
): Promise<EstadoDaExclusaoDeDocumento> {
  const sessao = await exigirSessaoDaEquipe()

  if (texto(dados, 'confirmacao') !== 'excluir') {
    return { erro: 'Exclusão não confirmada.' }
  }

  const resultado = await excluirDocumento(
    sessao,
    documentoId,
    await emailDaSessao(sessao),
  )

  if (resultado.situacao !== 'excluido') {
    return { erro: RECADO[resultado.situacao] ?? 'Não foi possível excluir.' }
  }

  revalidatePath(`/painel/clientes/${clienteId}`)
  if (casoId !== null) revalidatePath(`/painel/casos/${casoId}`)
  return undefined
}
