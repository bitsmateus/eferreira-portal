/**
 * As regras do que se aceita anexar — tipo, tamanho e rótulos.
 *
 * Mora separado de `documentos.ts` de propósito: a tela de anexo precisa
 * destas constantes, e `documentos.ts` fala com o banco e com o object
 * storage. Sem esta separação, código de servidor iria parar no pacote que o
 * navegador baixa.
 *
 * Aqui não pode entrar nada de servidor: nem Prisma, nem `node:`, nem sessão.
 */

import { TipoDocumento } from '@prisma/client'

/**
 * Tipos aceitos, por tipo de conteúdo. Lista fechada: o que não está aqui não
 * sobe. A extensão serve para nomear o arquivo quando ele chega sem nome.
 */
export const TIPOS_ACEITOS: Readonly<Record<string, string>> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
}

export const EXTENSOES_ACEITAS = [
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.heic',
  '.doc',
  '.docx',
] as const

/** 25 MB. Acompanha o limite de corpo das ações em next.config.ts. */
export const TAMANHO_MAXIMO_BYTES = 25 * 1024 * 1024

export const ROTULO_DO_TIPO: Record<TipoDocumento, string> = {
  CONTRATO: 'Contrato',
  PROCURACAO: 'Procuração',
  DECLARACAO: 'Declaração',
  ANEXO: 'Anexo',
}
