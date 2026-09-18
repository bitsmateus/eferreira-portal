import type { Metadata } from 'next'
import Link from 'next/link'
import { TipoDocumento } from '@prisma/client'

import { Etiqueta } from '@/componentes/etiqueta'
import { TopoDaPagina } from '@/componentes/topo-da-pagina'
import { enviosRecentes } from '@/lib/assinaturas'
import { formatarData } from '@/lib/datas'
import {
  LIMITE_DA_LISTA_DE_DOCUMENTOS,
  algumFiltroDeDocumentoAtivo,
  lerFiltrosDeDocumento,
  listarTodosOsDocumentos,
  situacaoDeAssinaturaDoDocumento,
  type SituacaoDeAssinatura,
} from '@/lib/documentos'
import { formatarDocumento } from '@/lib/documento'
import { ROTULO_DO_TIPO } from '@/lib/arquivos'
import { formatarNumeroDeProcesso } from '@/lib/formatos'
import { exigirSessaoDaEquipe } from '@/lib/sessao'

export const metadata: Metadata = {
  title: 'Documentos — E. Ferreira Advogados',
}

const ROTULO_DA_SITUACAO: Record<SituacaoDeAssinatura, string> = {
  assinado: 'Assinado',
  aguardando: 'Aguardando assinatura',
  nao_enviado: 'Não enviado',
}

const TOM_DA_SITUACAO: Record<SituacaoDeAssinatura, 'ok' | 'info' | 'neutra'> = {
  assinado: 'ok',
  aguardando: 'info',
  nao_enviado: 'neutra',
}

type Consulta = {
  busca?: string
  tipo?: string
  situacao?: string
}

export default async function PaginaDeDocumentos({
  searchParams,
}: {
  searchParams: Promise<Consulta>
}) {
  const sessao = await exigirSessaoDaEquipe()

  const consulta = await searchParams
  const termo = consulta.busca ?? ''
  const filtros = lerFiltrosDeDocumento(consulta)
  const filtrando = termo !== '' || algumFiltroDeDocumentoAtivo(filtros)

  // A situação de assinatura é calculada em memória (não é coluna do banco),
  // então o filtro de tipo/busca vai para o Prisma e o de situação é
  // aplicado depois de já saber o envio de cada documento — ver o comentário
  // de `ListaDeDocumentosGeral` em src/lib/documentos.ts.
  const [lista, envios] = await Promise.all([
    listarTodosOsDocumentos(sessao, termo, filtros),
    enviosRecentes(sessao),
  ])

  const comSituacao = lista.linhas.map((documento) => ({
    documento,
    situacao: situacaoDeAssinaturaDoDocumento(documento, envios.get(documento.id) ?? null),
  }))

  const filtrados =
    filtros.situacao === ''
      ? comSituacao
      : comSituacao.filter((linha) => linha.situacao === filtros.situacao)

  return (
    <>
      <TopoDaPagina
        titulo="Documentos"
        subtitulo="Contrato, procuração, declaração e anexo de todos os clientes, num lugar só"
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
                  placeholder="Cliente, CPF/CNPJ ou nome do arquivo…"
                  className="campo-entrada"
                />
              </div>

              <div className="w-[170px]">
                <label className="campo-rotulo" htmlFor="tipo">
                  Tipo
                </label>
                <select
                  id="tipo"
                  name="tipo"
                  defaultValue={filtros.tipo}
                  className="campo-entrada"
                >
                  <option value="">Todos</option>
                  {Object.values(TipoDocumento).map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {ROTULO_DO_TIPO[tipo]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-[190px]">
                <label className="campo-rotulo" htmlFor="situacao">
                  Assinatura
                </label>
                <select
                  id="situacao"
                  name="situacao"
                  defaultValue={filtros.situacao}
                  className="campo-entrada"
                >
                  <option value="">Todas</option>
                  <option value="aguardando">Aguardando assinatura</option>
                  <option value="assinado">Assinado</option>
                  <option value="nao_enviado">Não enviado</option>
                </select>
              </div>

              <button type="submit" className="botao botao-secundario">
                Filtrar
              </button>
              {filtrando && (
                <Link href="/painel/documentos" className="botao botao-fantasma">
                  Limpar
                </Link>
              )}
            </form>
          </div>
        </div>

        {filtrados.length === 0 ? (
          <div className="cartao px-[18px] py-10 text-center">
            <p className="mb-1 text-[14px] font-medium text-texto-2">
              {filtrando
                ? 'Nenhum documento com estes filtros.'
                : 'Nenhum documento ainda.'}
            </p>
            {filtrando && (
              <p className="text-[12.5px] text-texto-3">
                <Link
                  href="/painel/documentos"
                  className="text-info underline underline-offset-2"
                >
                  Limpar os filtros
                </Link>
                .
              </p>
            )}
          </div>
        ) : (
          <div className="cartao">
            <div className="rolagem-lateral">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Documento</th>
                    <th>Tipo</th>
                    <th>Data</th>
                    <th>Assinatura</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map(({ documento, situacao }) => (
                    <tr key={documento.id} className="relative hover:bg-prata-100/60">
                      <td className="font-semibold">
                        <Link
                          href={`/painel/clientes/${documento.cliente.id}`}
                          className="after:absolute after:inset-0 after:content-['']"
                        >
                          {documento.cliente.nome}
                        </Link>
                        <div className="mono text-[11.5px] font-normal text-texto-3">
                          {formatarDocumento(documento.cliente.documento)}
                        </div>
                      </td>
                      <td className="max-w-[260px] truncate text-[12.5px]">
                        {documento.nome}
                        {documento.caso !== null && (
                          <div className="text-[11.5px] text-texto-3">
                            {documento.caso.numeroProcesso === null
                              ? documento.caso.assunto
                              : formatarNumeroDeProcesso(documento.caso.numeroProcesso)}
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap text-[12px] text-texto-2">
                        {ROTULO_DO_TIPO[documento.tipo]}
                      </td>
                      <td className="mono whitespace-nowrap text-[12px] text-texto-2">
                        {formatarData(documento.criadoEm)}
                      </td>
                      <td>
                        <Etiqueta tom={TOM_DA_SITUACAO[situacao]}>
                          {ROTULO_DA_SITUACAO[situacao]}
                        </Etiqueta>
                      </td>
                      <td className="relative z-10 text-right">
                        <Link
                          href={`/painel/documentos/${documento.id}/arquivo`}
                          target="_blank"
                          className="botao botao-secundario botao-pequeno"
                        >
                          Abrir
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {lista.truncada && (
          <div className="aviso aviso-atencao mt-4">
            <span aria-hidden="true">▲</span>
            <div>
              <b>A lista está cortada.</b> Mostrando os primeiros{' '}
              {LIMITE_DA_LISTA_DE_DOCUMENTOS} documentos que batem com a busca e o tipo,
              do mais recente para o mais antigo. Use a busca para chegar ao que não
              aparece aqui.
            </div>
          </div>
        )}
      </div>
    </>
  )
}
