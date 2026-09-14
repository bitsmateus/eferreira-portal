'use server'

import { revalidatePath } from 'next/cache'

import {
  criarCredencial,
  revogarCredencial,
  validarCredencial,
} from '@/lib/credenciais'
import { texto, type ErrosDeCampo } from '@/lib/formulario'
import { emailDaSessao, exigirSessaoDaEquipe } from '@/lib/sessao'

export type EstadoDaCredencial =
  | {
      erros?: ErrosDeCampo
      mensagem?: string
      /**
       * A chave inteira, devolvida uma única vez. Ela não volta nunca mais —
       * nem daqui, nem do banco, onde só existe o hash.
       */
      chave?: string
    }
  | undefined

export async function gerarCredencial(
  _estado: EstadoDaCredencial,
  dados: FormData,
): Promise<EstadoDaCredencial> {
  // A sessão é de equipe aqui, e `criarCredencial` exige administrador logo
  // adiante — a decisão de perfil fica no domínio, não na tela.
  const sessao = await exigirSessaoDaEquipe()

  const conferido = validarCredencial({
    nome: texto(dados, 'nome'),
    permissoes: dados.getAll('permissoes').map(String),
  })

  if (!conferido.ok) return { erros: conferido.erros }

  const resultado = await criarCredencial(
    sessao,
    conferido.dados,
    await emailDaSessao(sessao),
  )

  revalidatePath('/painel/api')
  return { chave: resultado.chave }
}

export async function revogar(
  credencialId: string,
  _estado: EstadoDaCredencial,
  dados: FormData,
): Promise<EstadoDaCredencial> {
  const sessao = await exigirSessaoDaEquipe()

  // A tela pede confirmação antes; o campo é a confirmação viajando junto.
  // Revogar por clique perdido derruba uma integração em produção.
  if (texto(dados, 'confirmacao') !== 'revogar') {
    return { mensagem: 'Revogação não confirmada.' }
  }

  const resultado = await revogarCredencial(
    sessao,
    credencialId,
    await emailDaSessao(sessao),
  )

  if (resultado.situacao === 'nao_encontrada') {
    return { mensagem: 'Credencial não encontrada.' }
  }

  revalidatePath('/painel/api')
  return undefined
}
