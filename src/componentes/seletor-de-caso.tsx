'use client'

import { formatarNumeroDeProcesso } from '@/lib/formatos'
import { SeletorComBusca } from './seletor-com-busca'

export type CasoParaEscolha = { id: string; assunto: string; numeroProcesso: string | null }

function rotuloDoCaso(caso: CasoParaEscolha): string {
  return caso.numeroProcesso === null
    ? `${caso.assunto} — sem número`
    : `${formatarNumeroDeProcesso(caso.numeroProcesso)} — ${caso.assunto}`
}

/**
 * Só decide como um caso aparece e como o texto digitado casa com ele.
 *
 * `opcaoEmBranco` é um item de verdade na lista (id `""`), não um placeholder
 * — "documento do cliente, sem caso específico" é uma escolha válida, tão
 * legítima quanto qualquer caso, e por isso continua aparecendo mesmo quando
 * ninguém digitou nada ainda.
 */
export function SeletorDeCaso({
  id,
  name,
  casos,
  opcaoEmBranco,
  valorInicial = '',
  aoEscolher,
}: {
  id: string
  name: string
  casos: readonly CasoParaEscolha[]
  opcaoEmBranco: string
  valorInicial?: string
  aoEscolher?: (casoId: string) => void
}) {
  const itens: readonly (CasoParaEscolha | { id: ''; assunto: string; numeroProcesso: null })[] =
    [{ id: '', assunto: opcaoEmBranco, numeroProcesso: null }, ...casos]

  return (
    <SeletorComBusca
      id={id}
      name={name}
      itens={itens}
      idDoItem={(caso) => caso.id}
      rotulo={(caso) => (caso.id === '' ? opcaoEmBranco : rotuloDoCaso(caso))}
      bate={(caso, termo) => {
        const rotulo = caso.id === '' ? opcaoEmBranco : rotuloDoCaso(caso)
        return rotulo.toLowerCase().includes(termo)
      }}
      valorInicial={valorInicial}
      aoEscolher={aoEscolher}
      placeholder="Busque pelo número do processo ou pelo assunto…"
    />
  )
}
