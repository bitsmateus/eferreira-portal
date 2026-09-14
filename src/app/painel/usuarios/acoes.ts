'use server'

import { revalidatePath } from 'next/cache'
import { SituacaoUsuario } from '@prisma/client'

import {
  alterarSituacaoDoUsuario,
  atualizarUsuario,
  criarUsuario,
  redefinirSenha,
  validarUsuario,
  type CamposDeUsuario,
} from '@/lib/usuarios'
import { texto, type ErrosDeCampo } from '@/lib/formulario'
import { emailDaSessao, exigirSessaoDaEquipe } from '@/lib/sessao'

/**
 * `senha` é a senha gerada pelo sistema, devolvida uma única vez — na criação
 * e na redefinição. Como em `credenciais.ts`, ela não é guardada em lugar
 * nenhum além do hash: se esta tela fechar sem copiar, é preciso redefinir de
 * novo.
 */
export type EstadoDoUsuario =
  | {
      erros?: ErrosDeCampo
      mensagem?: string
      senha?: string
    }
  | undefined

function lerCampos(dados: FormData): CamposDeUsuario {
  return {
    nome: texto(dados, 'nome'),
    email: texto(dados, 'email'),
    perfil: texto(dados, 'perfil'),
  }
}

export async function cadastrarUsuario(
  _estado: EstadoDoUsuario,
  dados: FormData,
): Promise<EstadoDoUsuario> {
  // A sessão é de equipe aqui, e `criarUsuario` exige administrador logo
  // adiante — a decisão de perfil fica no domínio, não na tela.
  const sessao = await exigirSessaoDaEquipe()

  const conferido = validarUsuario(lerCampos(dados))
  if (!conferido.ok) return { erros: conferido.erros }

  const resultado = await criarUsuario(sessao, conferido.dados, await emailDaSessao(sessao))

  if (resultado.situacao === 'email_em_uso') {
    return { erros: { email: 'Este e-mail já tem cadastro na equipe.' } }
  }

  revalidatePath('/painel/usuarios')
  return { senha: resultado.senha }
}

export async function salvarEdicaoDeUsuario(
  id: string,
  _estado: EstadoDoUsuario,
  dados: FormData,
): Promise<EstadoDoUsuario> {
  const sessao = await exigirSessaoDaEquipe()

  const conferido = validarUsuario(lerCampos(dados))
  if (!conferido.ok) return { erros: conferido.erros }

  const resultado = await atualizarUsuario(sessao, id, conferido.dados, await emailDaSessao(sessao))

  if (resultado.situacao === 'nao_encontrado') {
    return { mensagem: 'Usuário não encontrado.' }
  }
  if (resultado.situacao === 'email_em_uso') {
    return { erros: { email: 'Este e-mail já tem cadastro na equipe.' } }
  }
  if (resultado.situacao === 'ultimo_administrador') {
    return {
      mensagem:
        'Este é o único administrador ativo. Promova outro colega a administrador antes de tirar este perfil.',
    }
  }

  revalidatePath('/painel/usuarios')
  return undefined
}

export async function redefinirSenhaDoUsuario(
  id: string,
  _estado: EstadoDoUsuario,
  dados: FormData,
): Promise<EstadoDoUsuario> {
  const sessao = await exigirSessaoDaEquipe()

  // Mesma confirmação de dois passos das outras ações que cortam ou trocam
  // acesso: um clique perdido aqui derruba a senha de um colega sem aviso.
  if (texto(dados, 'confirmacao') !== 'redefinir') {
    return { mensagem: 'Redefinição não confirmada.' }
  }

  const resultado = await redefinirSenha(sessao, id, await emailDaSessao(sessao))
  if (resultado.situacao === 'nao_encontrado') {
    return { mensagem: 'Usuário não encontrado.' }
  }

  revalidatePath('/painel/usuarios')
  return { senha: resultado.senha }
}

export type EstadoDaSituacao = { erro?: string } | undefined

export async function desativarUsuario(
  id: string,
  _estado: EstadoDaSituacao,
  dados: FormData,
): Promise<EstadoDaSituacao> {
  const sessao = await exigirSessaoDaEquipe()

  // A tela pede confirmação antes; o campo é a confirmação viajando junto —
  // mesmo padrão de `revogar` em painel/api/acoes.ts.
  if (texto(dados, 'confirmacao') !== 'desativar') {
    return { erro: 'Desativação não confirmada.' }
  }

  const resultado = await alterarSituacaoDoUsuario(
    sessao,
    id,
    SituacaoUsuario.INATIVO,
    await emailDaSessao(sessao),
  )

  if (resultado.situacao === 'nao_encontrado') return { erro: 'Usuário não encontrado.' }
  if (resultado.situacao === 'ultimo_administrador') {
    return {
      erro: 'Este é o único administrador ativo. Não é possível desativá-lo.',
    }
  }

  revalidatePath('/painel/usuarios')
  return undefined
}

export async function reativarUsuario(id: string): Promise<EstadoDaSituacao> {
  const sessao = await exigirSessaoDaEquipe()

  const resultado = await alterarSituacaoDoUsuario(
    sessao,
    id,
    SituacaoUsuario.ATIVO,
    await emailDaSessao(sessao),
  )
  if (resultado.situacao === 'nao_encontrado') return { erro: 'Usuário não encontrado.' }

  revalidatePath('/painel/usuarios')
  return undefined
}
