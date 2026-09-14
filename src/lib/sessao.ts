/**
 * A ponte entre o cookie de sessão e a autorização.
 *
 * Regra 2: é aqui — e só aqui — que a sessão do servidor vira `SessaoServidor`.
 * Nenhuma outra parte do código monta esse objeto à mão a partir de um `id`
 * recebido do navegador.
 */

import { PerfilUsuario, SituacaoUsuario } from '@prisma/client'

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

export type SessaoDeCliente = SessaoServidor & { clienteId: string; nome: string }

/**
 * Sessão de cliente, conferida contra o BANCO a cada requisição.
 *
 * O cookie é assinado, mas o que está escrito nele é uma fotografia do momento
 * em que o cliente entrou. Se o escritório revogar o acesso no minuto seguinte,
 * a fotografia continua dizendo "contrato assinado" por até oito horas. Regra 3
 * não admite isso: quem perdeu o acesso perde agora.
 *
 * Por isso as três condições são relidas do banco — usuário ativo, vínculo com
 * cliente e contrato assinado. Custa uma consulta por página; um cliente
 * enxergando o que não devia custa muito mais.
 */
export async function exigirSessaoDeCliente(): Promise<SessaoDeCliente> {
  const sessao = await exigirSessao()

  if (sessao.perfil !== PerfilUsuario.CLIENTE) {
    throw new SemAutorizacao('Esta área é a do cliente.')
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: sessao.usuarioId },
    select: {
      situacao: true,
      perfil: true,
      clienteId: true,
      cliente: { select: { id: true, nome: true, contratoAssinadoEm: true } },
    },
  })

  if (
    usuario === null ||
    usuario.perfil !== PerfilUsuario.CLIENTE ||
    usuario.situacao !== SituacaoUsuario.ATIVO ||
    usuario.cliente === null
  ) {
    throw new SemAutorizacao('Acesso encerrado. Entre de novo para consultar.')
  }

  // Anexo I, 1.d, conferido na fonte e não no cookie.
  if (usuario.cliente.contratoAssinadoEm === null) {
    throw new SemAutorizacao(
      'O acesso do cliente só é liberado após a assinatura do contrato.',
    )
  }

  return {
    usuarioId: sessao.usuarioId,
    perfil: PerfilUsuario.CLIENTE,
    clienteId: usuario.cliente.id,
    contratoAssinado: true,
    nome: usuario.cliente.nome,
  }
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
