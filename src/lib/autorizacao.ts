/**
 * Autorização — o coração do sistema.
 *
 * Regra 2: nenhuma decisão de acesso depende do que o navegador manda.
 * Regra 3: isolamento por cliente é o requisito número um.
 *
 * Toda consulta ao banco que toque cliente, caso, andamento ou documento passa
 * por um dos filtros abaixo. O filtro é construído a partir da sessão do
 * servidor e nunca a partir de um `id` recebido do cliente. Critérios extras
 * vindos da interface (busca, paginação, "abrir o caso X") entram sob `AND`
 * junto da restrição da sessão — por construção eles só conseguem ESTREITAR o
 * resultado, nunca ampliá-lo.
 */

import type { Prisma } from '@prisma/client'
import { PerfilUsuario } from '@prisma/client'

/** Lançada quando o pedido não pode ser atendido para esta sessão. */
export class SemAutorizacao extends Error {
  constructor(motivo: string) {
    super(motivo)
    this.name = 'SemAutorizacao'
  }
}

/**
 * O recorte da sessão que a autorização usa. Montado no servidor a partir do
 * cookie de sessão e do banco — nunca de query string, corpo ou cabeçalho.
 */
export type SessaoServidor = {
  usuarioId: string
  perfil: PerfilUsuario
  /** Preenchido apenas no perfil CLIENTE. */
  clienteId: string | null
  /** Anexo I, 1.d: o cliente só entra depois da assinatura do contrato. */
  contratoAssinado: boolean
}

/** Operador e administrador são a equipe do escritório. */
export function ehEquipe(sessao: SessaoServidor): boolean {
  return (
    sessao.perfil === PerfilUsuario.OPERADOR ||
    sessao.perfil === PerfilUsuario.ADMINISTRADOR
  )
}

/**
 * Devolve o id do cliente que esta sessão pode enxergar, ou lança.
 * É aqui que o Anexo I, 1.d é aplicado, em um lugar só.
 */
function clienteDaSessao(sessao: SessaoServidor): string {
  if (sessao.perfil !== PerfilUsuario.CLIENTE) {
    throw new SemAutorizacao('Perfil sem vínculo com cliente.')
  }
  if (sessao.clienteId === null || sessao.clienteId === '') {
    throw new SemAutorizacao('Sessão de cliente sem cliente vinculado.')
  }
  if (!sessao.contratoAssinado) {
    throw new SemAutorizacao(
      'O acesso do cliente só é liberado após a assinatura do contrato.',
    )
  }
  return sessao.clienteId
}

function combinar<F extends object>(restricao: F, extra: F | undefined): F {
  return (extra === undefined ? { AND: [restricao] } : { AND: [restricao, extra] }) as F
}

// ---------------------------------------------------------------------------
// Filtros
// ---------------------------------------------------------------------------

export function filtroDeClientes(
  sessao: SessaoServidor,
  extra?: Prisma.ClienteWhereInput,
): Prisma.ClienteWhereInput {
  const restricao: Prisma.ClienteWhereInput = ehEquipe(sessao)
    ? {}
    : { id: clienteDaSessao(sessao) }
  return combinar(restricao, extra)
}

export function filtroDeCasos(
  sessao: SessaoServidor,
  extra?: Prisma.CasoWhereInput,
): Prisma.CasoWhereInput {
  const restricao: Prisma.CasoWhereInput = ehEquipe(sessao)
    ? {}
    : { clienteId: clienteDaSessao(sessao) }
  return combinar(restricao, extra)
}

export function filtroDeAndamentos(
  sessao: SessaoServidor,
  extra?: Prisma.AndamentoWhereInput,
): Prisma.AndamentoWhereInput {
  const restricao: Prisma.AndamentoWhereInput = ehEquipe(sessao)
    ? {}
    : { caso: { clienteId: clienteDaSessao(sessao) } }
  return combinar(restricao, extra)
}

export function filtroDeDocumentos(
  sessao: SessaoServidor,
  extra?: Prisma.DocumentoWhereInput,
): Prisma.DocumentoWhereInput {
  const restricao: Prisma.DocumentoWhereInput = ehEquipe(sessao)
    ? {}
    : { clienteId: clienteDaSessao(sessao) }
  return combinar(restricao, extra)
}

// ---------------------------------------------------------------------------
// Exigências de perfil
// ---------------------------------------------------------------------------

export function exigirEquipe(sessao: SessaoServidor): void {
  if (!ehEquipe(sessao)) {
    throw new SemAutorizacao('Esta área é restrita à equipe do escritório.')
  }
}

export function exigirAdministrador(sessao: SessaoServidor): void {
  if (sessao.perfil !== PerfilUsuario.ADMINISTRADOR) {
    throw new SemAutorizacao(
      'Somente o administrador pode gerir usuários e credenciais da API.',
    )
  }
}
