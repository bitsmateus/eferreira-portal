'use server'

import { revalidatePath } from 'next/cache'

import {
  conferirAssinatura,
  enviarParaAssinatura,
  lerAvulsos,
  prepararEnvio,
  type SignatarioAvulso,
} from '@/lib/assinaturas'
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
 *
 * `avulsosJson` só existe no formulário de documento ANEXO — os demais tipos
 * nunca mandam este campo, e `lerAvulsos('')` devolve lista vazia, que
 * `enviarParaAssinatura` ignora para quem não é anexo.
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

  const avulsos = lerAvulsos(texto(dados, 'avulsosJson'))

  const resultado = await enviarParaAssinatura(
    sessao,
    documentoId,
    await emailDaSessao(sessao),
    avulsos,
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
    sem_signatarios: 'Escolha ao menos uma pessoa para assinar.',
  }

  return { erro: RECADO[resultado.situacao] ?? 'Não foi possível enviar.' }
}

// ---------------------------------------------------------------------------
// Só para documento ANEXO: revisar quem vai assinar antes do envio
// ---------------------------------------------------------------------------

export type EstadoDoPreparoDeAnexo =
  | { situacao: 'erro'; mensagem: string }
  | {
      situacao: 'pronto'
      partes: { papel: string; nome: string; email: string | null }[]
      creditosRestantes: number | null
      retomando: boolean
    }
  | undefined

const RECADO_DO_PREPARO: Record<string, string> = {
  nao_encontrado: 'Documento não encontrado.',
  sem_integracao: 'Esta instalação não tem a assinatura eletrônica configurada.',
  sem_cofre: 'O cofre do D4Sign não está definido nesta instalação.',
  tipo_nao_assinavel: 'Este documento não é do tipo que vai para assinatura.',
  ja_assinado: 'Este documento já está assinado.',
  sem_creditos: 'A conta do escritório está sem créditos de assinatura.',
  sem_signatarios: 'Escolha ao menos uma pessoa para assinar.',
}

/**
 * Monta a prévia de quem vai assinar um documento AVULSO, sem gastar crédito
 * e sem mandar nada — é o que a tela mostra antes do botão final de envio,
 * depois que a pessoa escolheu (ou digitou) os signatários.
 */
export async function prepararEnvioDeAnexo(
  documentoId: string,
  _estado: EstadoDoPreparoDeAnexo,
  dados: FormData,
): Promise<EstadoDoPreparoDeAnexo> {
  const sessao = await exigirSessaoDaEquipe()

  const avulsos: SignatarioAvulso[] = lerAvulsos(texto(dados, 'avulsosJson'))
  if (avulsos.length === 0) {
    return { situacao: 'erro', mensagem: 'Escolha ou adicione ao menos um signatário.' }
  }

  const preparo = await prepararEnvio(sessao, documentoId, avulsos)

  if (preparo.situacao === 'ja_enviado') {
    return { situacao: 'erro', mensagem: 'Este documento já foi enviado para assinatura.' }
  }
  if (preparo.situacao === 'sem_email') {
    return { situacao: 'erro', mensagem: 'Falta o e-mail de quem vai assinar.' }
  }
  if (preparo.situacao !== 'pronto') {
    return {
      situacao: 'erro',
      mensagem: RECADO_DO_PREPARO[preparo.situacao] ?? 'Não foi possível preparar o envio.',
    }
  }

  return {
    situacao: 'pronto',
    partes: preparo.partes,
    creditosRestantes: preparo.creditosRestantes,
    retomando: preparo.retomavel !== null,
  }
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
