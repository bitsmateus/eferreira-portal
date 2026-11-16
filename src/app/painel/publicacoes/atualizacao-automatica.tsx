'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

const INTERVALO_MS = 5_000
// A minuta com pesquisa na web leva minutos (16/11/2026): o teto acompanha
// `MINUTA_TRAVADA_MS` (src/lib/minuta.ts), depois do qual o pedido é dado por perdido.
const LIMITE_MS = 20 * 60_000

/**
 * A análise e a minuta da IA rodam depois da resposta (`after`), então a tela
 * não fica sabendo quando terminam. Enquanto `ativa`, a página se recarrega
 * sozinha a cada poucos segundos — e desiste depois de vinte minutos, para um
 * pedido que nunca termina não deixar a aba recarregando para sempre.
 * `chave` reinicia a contagem (ex.: a cada clique em "Consultar agora").
 */
export function useAtualizacaoAutomatica(ativa: boolean, chave: unknown = null): void {
  const router = useRouter()
  useEffect(() => {
    if (!ativa) return
    const inicio = Date.now()
    const relogio = window.setInterval(() => {
      if (Date.now() - inicio > LIMITE_MS) {
        window.clearInterval(relogio)
        return
      }
      router.refresh()
    }, INTERVALO_MS)
    return () => window.clearInterval(relogio)
  }, [ativa, chave, router])
}

/** Para a página: recarrega enquanto houver publicação esperando a primeira análise. */
export function AtualizacaoAutomatica({ ativa }: { ativa: boolean }) {
  useAtualizacaoAutomatica(ativa)
  return null
}
