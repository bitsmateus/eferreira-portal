'use server'

import { revalidatePath } from 'next/cache'

import { conferirAssinatura, enviarParaAssinatura } from '@/lib/assinaturas'
import { texto } from '@/lib/formulario'
import { emailDaSessao, exigirSessaoDaEquipe } from '@/lib/sessao'

export type EstadoDaAssinatura =
  | { mensagem?: string; erro?: string; faltando?: string[]; ondePreencher?: string }
  | undefined

/**
 * O passo que gasta um crédito do escritório e manda e-mail de verdade.
 *
 * A confirmação vem no corpo do formulário e é exigida aqui, e não só na tela:
 * é o mesmo cuidado da revogação de acesso. Um POST solto nesta ação não pode
 * disparar um envio.
 */
export async function enviarDocumentoParaAssinatura(
  documentoId: string,
  _estado: EstadoDaAssinatura,
  dados: FormData,
): Promise<EstadoDaAssinatura> {
  const sessao = await exigirSessaoDaEquipe()

  if (texto(dados, 'confirmacao') !== 'enviar') {
    return { erro: 'Confirme o envio para continuar.' }
  }

  const resultado = await enviarParaAssinatura(
    sessao,
    documentoId,
    await emailDaSessao(sessao),
  )

  if (resultado.situacao === 'enviado') {
    revalidatePath(`/painel/documentos/${documentoId}/assinatura`)
    return { mensagem: 'Enviado. O e-mail de assinatura já saiu.' }
  }

  if (resultado.situacao === 'parou_no_cofre') {
    revalidatePath(`/painel/documentos/${documentoId}/assinatura`)
    return {
      erro:
        'O documento subiu para o cofre, mas a D4Sign recusou o envio: ' +
        `${resultado.motivo} Nenhum e-mail saiu. Dá para tentar de novo — a ` +
        'segunda tentativa reaproveita o que já subiu.',
    }
  }

  if (resultado.situacao === 'sem_email') {
    return {
      erro: 'Falta e-mail de quem assina.',
      faltando: resultado.faltando,
      ondePreencher: resultado.ondePreencher,
    }
  }

  const RECADO: Record<string, string> = {
    nao_encontrado: 'Documento não encontrado.',
    sem_integracao: 'Esta instalação não tem a assinatura eletrônica configurada.',
    sem_cofre: 'O cofre do D4Sign não está definido nesta instalação.',
    tipo_nao_assinavel: 'Este documento não é do tipo que vai para assinatura.',
    ja_assinado: 'Este documento já está assinado.',
    ja_enviado: 'Este documento já foi enviado para assinatura.',
    sem_creditos: 'A conta do escritório está sem créditos de assinatura.',
  }

  return { erro: RECADO[resultado.situacao] ?? 'Não foi possível enviar.' }
}

/** Pergunta à D4Sign se já assinaram. Só leitura: não gasta crédito. */
export async function conferirAssinaturaDoEnvio(
  envioId: string,
  documentoId: string,
  clienteId: string,
  _estado: EstadoDaAssinatura,
  dados: FormData,
): Promise<EstadoDaAssinatura> {
  const sessao = await exigirSessaoDaEquipe()

  if (texto(dados, 'confirmacao') !== 'conferir') {
    return { erro: 'Pedido inválido.' }
  }

  const resultado = await conferirAssinatura(
    sessao,
    envioId,
    await emailDaSessao(sessao),
  )

  revalidatePath(`/painel/documentos/${documentoId}/assinatura`)
  revalidatePath(`/painel/clientes/${clienteId}`)

  if (resultado.situacao === 'assinado') {
    return {
      mensagem: resultado.acessoLiberado
        ? 'Assinado. O PDF está na pasta do cliente e o acesso ao portal foi liberado.'
        : 'Assinado. O PDF assinado está na pasta do cliente.',
    }
  }

  if (resultado.situacao === 'aguardando') {
    return { mensagem: 'Ainda não assinaram. Nada mudou.' }
  }

  if (resultado.situacao === 'cancelado') {
    return { erro: 'O documento foi cancelado na D4Sign.' }
  }

  if (resultado.situacao === 'desconhecida') {
    return {
      erro:
        'A D4Sign respondeu uma situação que este sistema não conhece: ' +
        `"${resultado.situacaoNaD4Sign}". Confira no painel da D4Sign.`,
    }
  }

  if (resultado.situacao === 'sem_integracao') {
    return { erro: 'Esta instalação não tem a assinatura eletrônica configurada.' }
  }

  return { erro: 'Envio não encontrado.' }
}
