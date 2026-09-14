/**
 * A linha do tempo do processo — Anexo I, item 2.4: data e histórico das
 * atualizações, com autor identificado (regra 6).
 *
 * É o mesmo conteúdo que o cliente lê na consulta dele. O que está escrito
 * aqui na descrição é o que ele vai ver, palavra por palavra.
 */

import Link from 'next/link'

import { formatarData, formatarDataHora } from '@/lib/datas'
import type { LinhaDeAndamento } from '@/lib/andamentos'
import { formatarNumeroDeProcesso } from '@/lib/formatos'

export function LinhaDoTempo({
  andamentos,
  /** No painel, cada item mostra de qual caso veio. Na ficha do caso, não. */
  mostrarCaso = false,
}: {
  andamentos: readonly LinhaDeAndamento[]
  mostrarCaso?: boolean
}) {
  if (andamentos.length === 0) {
    return (
      <div className="px-[18px] py-9 text-center">
        <p className="mb-1 text-[13.5px] font-medium text-texto-2">
          Nenhum andamento lançado.
        </p>
        <p className="text-[12.5px] text-texto-3">
          O primeiro andamento é o que o cliente vê quando consulta o processo.
        </p>
      </div>
    )
  }

  return (
    <ol className="relative ml-1.5 border-l border-borda pl-5">
      {andamentos.map((andamento, indice) => (
        <li key={andamento.id} className="relative pb-6 last:pb-0">
          <span
            aria-hidden="true"
            className={[
              'absolute -left-[27px] top-1 h-2.5 w-2.5 rounded-full border-2 border-superficie',
              indice === 0 ? 'bg-grafite-700' : 'bg-prata-300',
            ].join(' ')}
          />

          <div className="mono text-[11.5px] text-texto-3">
            {formatarData(andamento.data)}
          </div>

          <div className="mt-0.5 text-[13.5px] font-semibold">
            {andamento.status?.nome ?? 'Sem situação'}
          </div>

          <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-texto-2">
            {andamento.descricao}
          </p>

          <div className="mt-1.5 text-[11.5px] text-texto-3">
            Lançado por {andamento.autor.nome} em{' '}
            <span className="mono">{formatarDataHora(andamento.criadoEm)}</span>
            {mostrarCaso && (
              <>
                {' · '}
                <Link
                  href={`/painel/casos/${andamento.caso.id}`}
                  className="underline decoration-borda underline-offset-2 hover:decoration-texto-2"
                >
                  {andamento.caso.numeroProcesso === null
                    ? andamento.caso.assunto
                    : formatarNumeroDeProcesso(andamento.caso.numeroProcesso)}
                </Link>
                {' · '}
                <Link
                  href={`/painel/clientes/${andamento.caso.cliente.id}`}
                  className="underline decoration-borda underline-offset-2 hover:decoration-texto-2"
                >
                  {andamento.caso.cliente.nome}
                </Link>
              </>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
