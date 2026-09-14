'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { ehTipoGeravel, gerarDocumento } from '@/lib/geracao'
import { texto } from '@/lib/formulario'
import { emailDaSessao, exigirSessaoDaEquipe } from '@/lib/sessao'

export type EstadoDaGeracao =
  | { mensagem?: string; faltando?: string[]; ondePreencher?: string }
  | undefined

export async function gerarEArquivar(
  clienteId: string,
  _estado: EstadoDaGeracao,
  dados: FormData,
): Promise<EstadoDaGeracao> {
  const sessao = await exigirSessaoDaEquipe()

  const tipo = texto(dados, 'tipo')
  if (!ehTipoGeravel(tipo)) {
    return { mensagem: 'Tipo de documento inválido.' }
  }

  const casoBruto = texto(dados, 'casoId').trim()
  const casoId = casoBruto === '' ? null : casoBruto

  const resultado = await gerarDocumento(
    sessao,
    clienteId,
    tipo,
    casoId,
    await emailDaSessao(sessao),
  )

  if (resultado.situacao === 'nao_encontrado') {
    return { mensagem: 'Cliente ou caso não encontrado.' }
  }

  if (resultado.situacao === 'caso_obrigatorio') {
    return {
      mensagem: 'O contrato é de um caso específico. Escolha o caso.',
    }
  }

  if (resultado.situacao === 'faltam_dados') {
    return {
      mensagem: 'O documento não foi gerado porque o cadastro está incompleto.',
      faltando: resultado.faltando,
      ondePreencher: resultado.ondePreencher,
    }
  }

  revalidatePath(`/painel/clientes/${clienteId}`)
  redirect(`/painel/clientes/${clienteId}`)
}
