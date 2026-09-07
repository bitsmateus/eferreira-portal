/**
 * A ponte entre o cookie de sessão e a autorização.
 *
 * Regra 2: é aqui — e só aqui — que a sessão do servidor vira `SessaoServidor`.
 * Nenhuma outra parte do código monta esse objeto à mão a partir de um `id`
 * recebido do navegador.
 */

import { auth } from '@/auth'
import { SemAutorizacao, type SessaoServidor, exigirEquipe } from '@/lib/autorizacao'
import { prisma } from '@/lib/prisma'

/** Devolve a sessão do servidor, ou null se não houver ninguém autenticado. */
export async function sessaoDoServidor(): Promise<SessaoServidor | null> {
  const sessao = await auth()
  const usuario = sessao?.user

  if (usuario === undefined || usuario.id === '') return null

  return {
    usuarioId: usuario.id,
    perfil: usuario.perfil,
    clienteId: usuario.clienteId,
    contratoAssinado: usuario.contratoAssinado,
  }
}

/** Como acima, mas lança em vez de devolver null. Use nas páginas protegidas. */
export async function exigirSessao(): Promise<SessaoServidor> {
  const sessao = await sessaoDoServidor()
  if (sessao === null) {
    throw new SemAutorizacao('É preciso entrar para acessar esta página.')
  }
  return sessao
}

/** Sessão de alguém da equipe do escritório (operador ou administrador). */
export async function exigirSessaoDaEquipe(): Promise<SessaoServidor> {
  const sessao = await exigirSessao()
  exigirEquipe(sessao)
  return sessao
}

/**
 * O e-mail de quem está agindo, para o registro de auditoria (regra 6).
 * Guardado em texto junto do id, para o registro sobreviver à exclusão do
 * usuário.
 */
export async function emailDaSessao(sessao: SessaoServidor): Promise<string | null> {
  const usuario = await prisma.usuario.findUnique({
    where: { id: sessao.usuarioId },
    select: { email: true },
  })
  return usuario?.email ?? null
}
