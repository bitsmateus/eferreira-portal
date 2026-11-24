/**
 * Qual plataforma de assinatura eletrônica recebe os envios NOVOS.
 *
 *   ASSINATURA_PROVEDOR=zapsign   envios novos vão pela ZapSign
 *   ASSINATURA_PROVEDOR=d4sign    envios novos vão pela D4Sign (padrão)
 *
 * Isto decide só o envio. O que já foi enviado termina onde começou:
 * `EnvioParaAssinatura.provedor`. Virar a chave é mudar a variável no
 * EasyPanel, sem nova versão — e voltar atrás também.
 */

import { ProvedorAssinatura } from '@prisma/client'

import { configuracaoD4Sign } from '@/lib/d4sign'
import { zapsignAtiva } from '@/lib/zapsign'

export function provedorEscolhido(
  valor: string | undefined = process.env['ASSINATURA_PROVEDOR'],
): ProvedorAssinatura {
  return (valor ?? '').trim().toLowerCase() === 'zapsign'
    ? ProvedorAssinatura.ZAPSIGN
    : ProvedorAssinatura.D4SIGN
}

export const NOME_DO_PROVEDOR: Record<ProvedorAssinatura, string> = {
  D4SIGN: 'D4Sign',
  ZAPSIGN: 'ZapSign',
}

/**
 * A ZapSign está pronta para receber envios: escolhida e com chave. É também
 * a condição para oferecer o reenvio do que ficou pendente na D4Sign —
 * antes disso, nada lá é tocado.
 */
export function zapsignLigada(): boolean {
  return provedorEscolhido() === ProvedorAssinatura.ZAPSIGN && zapsignAtiva()
}

/** A plataforma deste provedor tem credencial nesta instalação? */
export function provedorConfigurado(provedor: ProvedorAssinatura): boolean {
  return provedor === ProvedorAssinatura.ZAPSIGN ? zapsignAtiva() : configuracaoD4Sign() !== null
}
