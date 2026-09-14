/**
 * Os rótulos das permissões da API, sem nada em volta.
 *
 * Separados de `src/lib/credenciais.ts` pelo mesmo motivo de `arquivos.ts` e
 * `acesso.ts`: aquele arquivo fala com o banco, e a tela que desenha as caixas
 * de seleção não pode arrastar o Prisma para o pacote do navegador.
 */

import type { PermissaoApi } from '@prisma/client'

export const ROTULO_DA_PERMISSAO: Record<PermissaoApi, string> = {
  CONSULTAR: 'Consultar andamentos',
  ESCREVER: 'Cadastrar e atualizar',
}

export const DESCRICAO_DA_PERMISSAO: Record<PermissaoApi, string> = {
  CONSULTAR: 'Ler cliente, casos e andamentos a partir do CPF ou CNPJ.',
  ESCREVER: 'Criar e alterar clientes, casos e andamentos.',
}

/** Na ordem em que aparecem na tela — da menos para a mais poderosa. */
export const PERMISSOES_DA_API: readonly PermissaoApi[] = ['CONSULTAR', 'ESCREVER']

/**
 * O que a credencial mostra de si mesma na lista.
 *
 * Mora aqui, e não junto das consultas, para que a tela possa usar o tipo sem
 * importar o arquivo que abre conexão com o banco.
 */
export type LinhaDeCredencial = {
  id: string
  nome: string
  mascarada: string
  prefixo: string
  ehDeProducao: boolean
  permissoes: PermissaoApi[]
  ativa: boolean
  criadoEm: Date
  ultimoUsoEm: Date | null
  revogadoEm: Date | null
  criadaPor: string | null
}
