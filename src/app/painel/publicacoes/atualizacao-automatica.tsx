'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

const INTERVALO_MS = 5_000
const LIMITE_MS = 3 * 60_000

/**
 * A análise da IA roda depois da resposta (`after`), então a tela não fica
 * sabendo quando ela termina. Enquanto `ativa`, a página se recarrega sozinha
 * a cada poucos segundos — e desiste depois de três minutos, para uma
 * análise que nunca termina não deixar a aba recarregando para sempre.
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
