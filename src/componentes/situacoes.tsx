/**
 * As duas situações que aparecem em várias telas, desenhadas em um lugar só —
 * com os mesmos rótulos do protótipo aprovado.
 */

import { SituacaoCaso } from '@prisma/client'

import { Etiqueta } from '@/componentes/etiqueta'
import { ROTULO_DA_SITUACAO } from '@/lib/situacao-do-caso'

/**
 * Acesso do cliente (Anexo I, 1.d).
 *
 * "Sem e-mail" vem antes de tudo, e em vermelho: o código de entrada do
 * cliente vai por e-mail, então cadastro sem e-mail nunca vira consulta.
 * O protótipo mostra isso na lista, não escondido em uma aba.
 */
export function EtiquetaDeAcesso({
  acessoLiberado,
  temEmail,
}: {
  acessoLiberado: boolean
  temEmail: boolean
}) {
  if (!temEmail) return <Etiqueta tom="erro">Sem e-mail</Etiqueta>
  if (acessoLiberado) return <Etiqueta tom="ok">Liberado</Etiqueta>
  return <Etiqueta tom="atencao">Aguardando assinatura</Etiqueta>
}

export function EtiquetaDeSituacaoDoCaso({ situacao }: { situacao: SituacaoCaso }) {
  return situacao === SituacaoCaso.EM_ANDAMENTO ? (
    <Etiqueta tom="info">Em andamento</Etiqueta>
  ) : (
    <Etiqueta tom="neutra">Arquivado</Etiqueta>
  )
}

export { ROTULO_DA_SITUACAO }
