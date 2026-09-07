/**
 * Bloqueio por tentativas — protótipo, tela "Entrar — operador":
 * "Após 5 tentativas erradas, o acesso é bloqueado por 15 minutos."
 *
 * A regra vive aqui, pura, para poder ser testada sem banco. Quem persiste o
 * resultado é o `authorize` do Auth.js.
 */

export const TENTATIVAS_ATE_BLOQUEAR = 5
export const MINUTOS_DE_BLOQUEIO = 15

export type EstadoDeTentativas = {
  tentativasFalhas: number
  bloqueadoAte: Date | null
}

/** Verdadeiro enquanto o bloqueio estiver valendo. */
export function estaBloqueado(
  estado: EstadoDeTentativas,
  agora: Date = new Date(),
): boolean {
  if (estado.bloqueadoAte === null) return false
  return estado.bloqueadoAte.getTime() > agora.getTime()
}

/** Minutos que ainda faltam para o desbloqueio, arredondados para cima. */
export function minutosRestantesDeBloqueio(
  estado: EstadoDeTentativas,
  agora: Date = new Date(),
): number {
  if (!estaBloqueado(estado, agora)) return 0
  const restanteMs = (estado.bloqueadoAte as Date).getTime() - agora.getTime()
  return Math.ceil(restanteMs / 60_000)
}

/** Novo estado após uma tentativa errada. Na quinta, bloqueia por 15 minutos. */
export function registrarFalha(
  estado: EstadoDeTentativas,
  agora: Date = new Date(),
): EstadoDeTentativas {
  // Se o bloqueio anterior já expirou, a contagem recomeça.
  const base = estado.bloqueadoAte !== null && !estaBloqueado(estado, agora) ? 0 : estado.tentativasFalhas
  const tentativasFalhas = base + 1

  if (tentativasFalhas >= TENTATIVAS_ATE_BLOQUEAR) {
    return {
      tentativasFalhas,
      bloqueadoAte: new Date(agora.getTime() + MINUTOS_DE_BLOQUEIO * 60_000),
    }
  }

  return { tentativasFalhas, bloqueadoAte: null }
}

/** Estado após um acesso bem-sucedido: contagem zerada. */
export function registrarSucesso(): EstadoDeTentativas {
  return { tentativasFalhas: 0, bloqueadoAte: null }
}
