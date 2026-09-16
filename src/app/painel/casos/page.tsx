import type { Metadata } from 'next'
import Link from 'next/link'
import { SituacaoCaso } from '@prisma/client'

import { ROTULO_DA_SITUACAO } from '@/componentes/situacoes'
import { EtiquetaDeSituacaoDoCaso } from '@/componentes/situacoes'
import { MenuDoCaso } from '@/componentes/menu-do-caso'
import { TopoDaPagina } from '@/componentes/topo-da-pagina'
import {
  LIMITE_DA_LISTA,
  algumFiltroDeCasoAtivo,
  contarCasos,
  lerFiltrosDeCaso,
  listarCasos,
  listarResponsaveis,
} from '@/lib/casos'
import { formatarData } from '@/lib/datas'
import { formatarDocumento } from '@/lib/documento'
import { formatarNumeroDeProcesso } from '@/lib/formatos'
import { exigirSessaoDaEquipe } from '@/lib/sessao'

export const metadata: Metadata = {
  title: 'Casos — E. Ferreira Advogados',
}

type Consulta = {
  busca?: string
  situacao?: string
  responsavel?: string
  numero?: string
}

export default async function PaginaDeCasos({
  searchParams,
}: {
  searchParams: Promise<Consulta>
}) {
  const sessao = await exigirSessaoDaEquipe()

  const consulta = await searchParams
  const termo = consulta.busca ?? ''
  const filtros = lerFiltrosDeCaso(consulta)
  const filtrando = termo !== '' || algumFiltroDeCasoAtivo(filtros)

  const [lista, total, responsaveis] = await Promise.all([
    listarCasos(sessao, termo, filtros),
    contarCasos(sessao),
    listarResponsaveis(sessao),
  ])

  const casos = lista.linhas

  return (
    <>
      <TopoDaPagina
        titulo="Casos"
        subtitulo={
          total === 1
            ? '1 caso · cada um vinculado a um cliente'
            : `${total} casos · cada um vinculado a um cliente`
        }
        acoes={
          <Link href="/painel/casos/novo" className="botao">
            + Novo caso
          </Link>
        }
      />

      <div className="flex-1 overflow-auto px-6 py-6">
        <div className="cartao mb-4">
          <div className="px-4 py-3.5">
            <form className="flex flex-wrap items-end gap-2.5" method="get">
              <div className="min-w-[220px] flex-1">
                <label className="campo-rotulo" htmlFor="busca">
                  Buscar
                </label>
                <input
                  id="busca"
                  type="search"
                  name="busca"
                  defaultValue={termo}
                  placeholder="Número do processo, assunto ou cliente…"
                  className="campo-entrada"
                />
              </div>

              <div className="w-[170px]">
                <label className="campo-rotulo" htmlFor="situacao">
                  Situação
                </label>
                <select
                  id="situacao"
                  name="situacao"
                  defaultValue={filtros.situacao}
                  className="campo-entrada"
                >
                  <option value="">Todas</option>
                  {Object.values(SituacaoCaso).map((situacao) => (
                    <option key={situacao} value={situacao}>
                      {ROTULO_DA_SITUACAO[situacao]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-[200px]">
                <label className="campo-rotulo" htmlFor="responsavel">
                  Responsável
                </label>
                <select
                  id="responsavel"
                  name="responsavel"
                  defaultValue={filtros.responsavel}
                  className="campo-entrada"
                >
                  <option value="">Todos</option>
                  <option value="sem">Sem responsável</option>
                  {responsaveis.map((pessoa) => (
                    <option key={pessoa.id} value={pessoa.id}>
                      {pessoa.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-[180px]">
                <label className="campo-rotulo" htmlFor="numero">
                  Número do processo
                </label>
                <select
                  id="numero"
                  name="numero"
                  defaultValue={filtros.numero}
                  className="campo-entrada"
                >
                  <option value="">Todos</option>
                  <option value="com">Com número</option>
                  <option value="sem">Sem número — pré-processual</option>
                </select>
              </div>

              <button type="submit" className="botao botao-secundario">
                Filtrar
              </button>
              {filtrando && (
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
              {filtrando
                ? 'Nenhum caso com estes filtros.'
                : 'Nenhum caso cadastrado ainda.'}
            </p>
            <p className="text-[12.5px] text-texto-3">
              {filtrando ? (
                <Link
                  href="/painel/casos"
                  className="text-info underline underline-offset-2"
                >
                  Limpar os filtros
                </Link>
              ) : (
                <>
                  Todo caso pertence a um cliente —{' '}
                  <Link
                    href="/painel/casos/novo"
                    className="text-info underline underline-offset-2"
                  >
                    cadastrar o primeiro
                  </Link>
                  .
                </>
              )}
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
                      // Mesma ideia da lista de clientes: a linha inteira abre
                      // o caso, por um link esticado, e o link do cliente sobe
                      // acima dele para continuar levando à ficha do cliente.
                      <tr key={caso.id} className="relative hover:bg-prata-100/60">
                        <td className="mono whitespace-nowrap font-semibold">
                          <Link
                            href={`/painel/casos/${caso.id}`}
                            className="after:absolute after:inset-0 after:content-['']"
                          >
                            {caso.numeroProcesso === null ? (
                              <span className="font-normal text-texto-3">
                                sem número ainda
                              </span>
                            ) : (
                              formatarNumeroDeProcesso(caso.numeroProcesso)
                            )}
                          </Link>
                        </td>
                        <td>{caso.assunto}</td>
                        <td className="relative z-10">
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
                        <td className="relative z-10 text-right">
                          <MenuDoCaso
                            casoId={caso.id}
                            titulo={
                              caso.numeroProcesso === null
                                ? caso.assunto
                                : formatarNumeroDeProcesso(caso.numeroProcesso)
                            }
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {lista.truncada && (
          <div className="aviso aviso-atencao mt-4">
            <span aria-hidden="true">▲</span>
            <div>
              <b>A lista está cortada.</b> Mostrando os {LIMITE_DA_LISTA} casos mais
              recentes de {total}. Use a busca ou os filtros para chegar aos demais.
            </div>
          </div>
        )}
      </div>
    </>
  )
}
