import { describe, expect, it } from 'vitest'
import {
  MINUTOS_DE_BLOQUEIO,
  TENTATIVAS_ATE_BLOQUEAR,
  type EstadoDeTentativas,
  estaBloqueado,
  minutosRestantesDeBloqueio,
  registrarFalha,
  registrarSucesso,
} from '@/lib/bloqueio'

const AGORA = new Date('2026-08-31T12:00:00.000Z')
const limpo: EstadoDeTentativas = { tentativasFalhas: 0, bloqueadoAte: null }

function falharVezes(quantidade: number, agora: Date = AGORA): EstadoDeTentativas {
  let estado = limpo
  for (let i = 0; i < quantidade; i += 1) {
    estado = registrarFalha(estado, agora)
  }
  return estado
}

describe('registrarFalha', () => {
  it('conta as tentativas sem bloquear até a quarta', () => {
    for (let tentativas = 1; tentativas < TENTATIVAS_ATE_BLOQUEAR; tentativas += 1) {
      const estado = falharVezes(tentativas)
      expect(estado.tentativasFalhas).toBe(tentativas)
      expect(estado.bloqueadoAte).toBeNull()
    }
  })

  it('bloqueia na quinta tentativa errada', () => {
    const estado = falharVezes(TENTATIVAS_ATE_BLOQUEAR)
    expect(estado.tentativasFalhas).toBe(TENTATIVAS_ATE_BLOQUEAR)
    expect(estado.bloqueadoAte).not.toBeNull()
  })

  it('bloqueia por exatamente 15 minutos', () => {
    const estado = falharVezes(TENTATIVAS_ATE_BLOQUEAR)
    const esperado = AGORA.getTime() + MINUTOS_DE_BLOQUEIO * 60_000
    expect(estado.bloqueadoAte?.getTime()).toBe(esperado)
  })

  it('recomeça a contagem depois que o bloqueio expira', () => {
    const bloqueado = falharVezes(TENTATIVAS_ATE_BLOQUEAR)
    const depoisDoBloqueio = new Date(AGORA.getTime() + 16 * 60_000)

    const novo = registrarFalha(bloqueado, depoisDoBloqueio)
    expect(novo.tentativasFalhas).toBe(1)
    expect(novo.bloqueadoAte).toBeNull()
  })
})

describe('estaBloqueado', () => {
  it('é falso sem bloqueio registrado', () => {
    expect(estaBloqueado(limpo, AGORA)).toBe(false)
  })

  it('é verdadeiro dentro da janela', () => {
    const estado = falharVezes(TENTATIVAS_ATE_BLOQUEAR)
    const daquiA14Minutos = new Date(AGORA.getTime() + 14 * 60_000)
    expect(estaBloqueado(estado, daquiA14Minutos)).toBe(true)
  })

  it('é falso depois da janela', () => {
    const estado = falharVezes(TENTATIVAS_ATE_BLOQUEAR)
    const daquiA15Minutos = new Date(AGORA.getTime() + 15 * 60_000)
    expect(estaBloqueado(estado, daquiA15Minutos)).toBe(false)
  })
})

describe('minutosRestantesDeBloqueio', () => {
  it('devolve zero quando não há bloqueio', () => {
    expect(minutosRestantesDeBloqueio(limpo, AGORA)).toBe(0)
  })

  it('arredonda para cima os minutos que faltam', () => {
    const estado = falharVezes(TENTATIVAS_ATE_BLOQUEAR)
    const daquiA10MinutosEMeio = new Date(AGORA.getTime() + 10.5 * 60_000)
    expect(minutosRestantesDeBloqueio(estado, daquiA10MinutosEMeio)).toBe(5)
  })
})

describe('registrarSucesso', () => {
  it('zera a contagem e o bloqueio', () => {
    expect(registrarSucesso()).toEqual({ tentativasFalhas: 0, bloqueadoAte: null })
  })
})
