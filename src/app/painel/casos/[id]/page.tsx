import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { EtiquetaDeSituacaoDoCaso } from '@/componentes/situacoes'
import { TopoDaPagina } from '@/componentes/topo-da-pagina'
import { obterCaso } from '@/lib/casos'
import { formatarData } from '@/lib/datas'
import { formatarDocumento } from '@/lib/documento'
import { formatarNumeroDeProcesso } from '@/lib/formatos'
import { exigirSessaoDaEquipe } from '@/lib/sessao'

export const metadata: Metadata = {
  title: 'Caso — E. Ferreira Advogados',
}

function Dado({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1.5 text-[12.5px] font-medium text-texto-2">{rotulo}</div>
      <div className="text-[13px]">{children}</div>
    </div>
  )
}

export default async function PaginaDoCaso({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const sessao = await exigirSessaoDaEquipe()
  const { id } = await params

  // Regra 2: `obterCaso` consulta pelo filtro da sessão. Um id de caso alheio
  // colado na URL não encontra nada — devolve 404, não o caso de outro.
  const caso = await obterCaso(sessao, id)
  if (caso === null) notFound()

  const titulo =
    caso.numeroProcesso === null
      ? caso.assunto
      : formatarNumeroDeProcesso(caso.numeroProcesso)

  return (
    <>
      <TopoDaPagina
        titulo={titulo}
        monoNoTitulo={caso.numeroProcesso !== null}
        subtitulo={
          <>
            {caso.assunto} ·{' '}
            <Link
              href={`/painel/clientes/${caso.cliente.id}`}
              className="underline decoration-borda underline-offset-2 hover:decoration-texto-2"
            >
              {caso.cliente.nome}
            </Link>
            {caso.vara !== null && <> · {caso.vara}</>}
          </>
        }
        acoes={
          <>
            <EtiquetaDeSituacaoDoCaso situacao={caso.situacao} />
            <Link
              href={`/painel/casos/${caso.id}/editar`}
              className="botao botao-secundario"
            >
              Editar
            </Link>
          </>
        }
      />

      <div className="flex-1 overflow-auto px-6 py-6">
        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <div className="cartao">
            <div className="cartao-cabecalho">
              <h2>Histórico do processo</h2>
            </div>
            <div className="px-[18px] py-10 text-center">
              <p className="mb-1 text-[13.5px] font-medium text-texto-2">
                Os andamentos entram na Sprint 2.
              </p>
              <p className="text-[12.5px] text-texto-3">
                O registro de andamento com data e histórico depende da lista de status
                do escritório (Anexo II, item 3.5), que ainda não chegou. Nada de lista
                inventada aqui.
              </p>
            </div>
          </div>

          <div>
            <div className="cartao mb-4">
              <div className="cartao-cabecalho">
                <h2>Dados do caso</h2>
              </div>
              <div className="cartao-corpo">
                <Dado rotulo="Número do processo">
                  {caso.numeroProcesso === null ? (
                    <span className="text-texto-3">
                      sem número — fase pré-processual
                    </span>
                  ) : (
                    <span className="mono font-semibold">
                      {formatarNumeroDeProcesso(caso.numeroProcesso)}
                    </span>
                  )}
                </Dado>
                <Dado rotulo="Assunto">{caso.assunto}</Dado>
                <Dado rotulo="Vara / Foro">
                  {caso.vara ?? <span className="text-texto-3">—</span>}
                </Dado>
                <Dado rotulo="Parte contrária">
                  {caso.parteContraria ?? <span className="text-texto-3">—</span>}
                </Dado>
                <Dado rotulo="Responsável">
                  {caso.responsavel?.nome ?? (
                    <span className="text-texto-3">sem responsável definido</span>
                  )}
                </Dado>
                <Dado rotulo="Aberto em">
                  <span className="mono">{formatarData(caso.criadoEm)}</span>
                </Dado>
              </div>
            </div>

            <div className="cartao mb-4">
              <div className="cartao-cabecalho">
                <h2>Cliente</h2>
              </div>
              <div className="cartao-corpo">
                <Dado rotulo="Nome">
                  <Link
                    href={`/painel/clientes/${caso.cliente.id}`}
                    className="underline decoration-borda underline-offset-2 hover:decoration-texto-2"
                  >
                    {caso.cliente.nome}
                  </Link>
                </Dado>
                <Dado rotulo="CPF / CNPJ">
                  <span className="mono">
                    {formatarDocumento(caso.cliente.documento)}
                  </span>
                </Dado>
              </div>
            </div>

            <div className="aviso aviso-atencao">
              <span aria-hidden="true">▲</span>
              <div>
                <b>Lançamento é manual.</b> A captura automática de movimentações nos
                tribunais está expressamente fora deste contrato — Anexo II, item 1.c.
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
