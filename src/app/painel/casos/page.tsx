import type { Metadata } from 'next'
import Link from 'next/link'

import { EtiquetaDeSituacaoDoCaso } from '@/componentes/situacoes'
import { TopoDaPagina } from '@/componentes/topo-da-pagina'
import { contarCasos, listarCasos } from '@/lib/casos'
import { formatarData } from '@/lib/datas'
import { formatarDocumento } from '@/lib/documento'
import { formatarNumeroDeProcesso } from '@/lib/formatos'
import { exigirSessaoDaEquipe } from '@/lib/sessao'

export const metadata: Metadata = {
  title: 'Casos — E. Ferreira Advogados',
}

export default async function PaginaDeCasos({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string }>
}) {
  const sessao = await exigirSessaoDaEquipe()

  const { busca } = await searchParams
  const termo = busca ?? ''

  const [casos, total] = await Promise.all([
    listarCasos(sessao, termo),
    contarCasos(sessao),
  ])

  return (
    <>
      <TopoDaPagina
        titulo="Casos"
        subtitulo={
          total === 1
            ? '1 caso · cada um vinculado a um cliente'
            : `${total} casos · cada um vinculado a um cliente`
        }
      />

      <div className="flex-1 overflow-auto px-6 py-6">
        <div className="cartao mb-4">
          <div className="px-4 py-3.5">
            <form className="flex flex-wrap gap-2.5" method="get">
              <input
                type="search"
                name="busca"
                defaultValue={termo}
                aria-label="Buscar caso"
                placeholder="Buscar por número do processo, assunto ou cliente…"
                className="campo-entrada min-w-0 flex-1"
              />
              <button type="submit" className="botao botao-secundario">
                Buscar
              </button>
              {termo !== '' && (
                <Link href="/painel/casos" className="botao botao-fantasma">
                  Limpar
                </Link>
              )}
            </form>
          </div>
        </div>

        {casos.length === 0 ? (
          <div className="cartao px-[18px] py-10 text-center">
            <p className="mb-1 text-[14px] font-medium text-texto-2">
              {termo === ''
                ? 'Nenhum caso cadastrado ainda.'
                : 'Nenhum caso encontrado para esta busca.'}
            </p>
            <p className="text-[12.5px] text-texto-3">
              O caso nasce na ficha do cliente —{' '}
              <Link
                href="/painel/clientes"
                className="text-info underline underline-offset-2"
              >
                abrir a lista de clientes
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="cartao">
            <div className="rolagem-lateral">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Número do processo</th>
                    <th>Assunto</th>
                    <th>Cliente</th>
                    <th>Situação</th>
                    <th>Último andamento</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {casos.map((caso) => {
                    const ultimo = caso.andamentos[0]
                    return (
                      <tr key={caso.id}>
                        <td className="mono whitespace-nowrap font-semibold">
                          {caso.numeroProcesso === null ? (
                            <span className="font-normal text-texto-3">
                              sem número ainda
                            </span>
                          ) : (
                            formatarNumeroDeProcesso(caso.numeroProcesso)
                          )}
                        </td>
                        <td>{caso.assunto}</td>
                        <td>
                          <Link
                            href={`/painel/clientes/${caso.cliente.id}`}
                            className="underline decoration-borda underline-offset-2 hover:decoration-texto-2"
                          >
                            {caso.cliente.nome}
                          </Link>
                          <div className="mono text-[11.5px] text-texto-3">
                            {formatarDocumento(caso.cliente.documento)}
                          </div>
                        </td>
                        <td>
                          <EtiquetaDeSituacaoDoCaso situacao={caso.situacao} />
                        </td>
                        <td className="text-[12px] text-texto-2">
                          {ultimo === undefined ? '—' : formatarData(ultimo.data)}
                        </td>
                        <td className="text-right">
                          <Link
                            href={`/painel/casos/${caso.id}`}
                            className="botao botao-secundario botao-pequeno"
                          >
                            Abrir
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
