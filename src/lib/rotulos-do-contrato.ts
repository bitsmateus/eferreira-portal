/**
 * Rótulos das escolhas do contrato — sem nada de servidor, para o formulário
 * do caso ('use client') mostrá-los sem arrastar Prisma e sessão para o pacote
 * do navegador (mesma separação de `rotulos-de-assinatura.ts`).
 */

import { NaturezaDoHonorarioPersonalizado, TipoDeObjeto } from '@prisma/client'

/** Os títulos são os das variações de "Objeto do contrato.docx" (21/09/2026). */
export const ROTULO_DO_TIPO_DE_OBJETO: Record<TipoDeObjeto, string> = {
  CONSUMIDOR_PLANO_DE_SAUDE: 'Consumidor — plano de saúde',
  TRABALHISTA: 'Trabalhista — reclamação ou defesa',
  CIVEL: 'Cível — propositura ou defesa',
  REVISIONAL: 'Revisional — revisão e discussão contratual',
  PERSONALIZADO: 'Personalizado — diferentes casos',
}

/** O que o operador deve escrever na descrição, conforme o tipo (o colchete do escritório). */
export const DICA_DA_DESCRICAO_DO_OBJETO: Record<TipoDeObjeto, string> = {
  CONSUMIDOR_PLANO_DE_SAUDE:
    'Descreva a demanda, identificando a operadora, o beneficiário e o cancelamento ou a negativa questionada.',
  TRABALHISTA:
    'Descreva a demanda, indicando se a atuação será em favor do reclamante ou do reclamado, a parte contrária e o número do processo, se existente.',
  CIVEL:
    'Descreva a demanda ou controvérsia, identificando a pretensão ou a defesa contratada, as partes envolvidas e o número do processo, se existente.',
  REVISIONAL:
    'Identifique o contrato, a parte contrária, as questões contratuais a serem discutidas e o número do processo, se existente.',
  PERSONALIZADO:
    'Descreva cada caso e os serviços contratados, identificando a finalidade da atuação, as partes envolvidas e os números dos procedimentos ou processos, se existentes.',
}

export const ROTULO_DA_NATUREZA_DO_PERSONALIZADO: Record<
  NaturezaDoHonorarioPersonalizado,
  string
> = {
  CUMULATIVA: 'Cumulativa',
  SUBSTITUTIVA: 'Substitutiva',
  COMPENSAVEL: 'Compensável',
}
