import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { SeletorDeCaso } from '@/componentes/seletor-de-caso'
import { TopoDaPagina } from '@/componentes/topo-da-pagina'
import { ROTULO_DO_TIPO } from '@/lib/arquivos'
import { obterCliente } from '@/lib/clientes'
import { formatarDocumento } from '@/lib/documento'
import {
  TIPOS_GERAVEIS,
  ehTipoGeravel,
  exigeCaso,
  montarPrevia,
  type TipoGeravel,
} from '@/lib/geracao'
import { exigirSessaoDaEquipe } from '@/lib/sessao'
import { FormularioDeGeracao } from './formulario'

export const metadata: Metadata = {
  title: 'Gerar documento — E. Ferreira Advogados',
}

export default async function PaginaDeGeracao({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tipo?: string; casoId?: string }>
}) {
  const sessao = await exigirSessaoDaEquipe()
  const { id } = await params
  const { tipo: tipoBruto, casoId: casoBruto } = await searchParams

  const cliente = await obterCliente(sessao, id)
  if (cliente === null) notFound()

  const naQuery = tipoBruto ?? ''
  const tipo: TipoGeravel | null = ehTipoGeravel(naQuery) ? naQuery : null
  const casoId = casoBruto === undefined || casoBruto === '' ? null : casoBruto

  // A prévia é montada pelo mesmo caminho que a geração usa, então o que
  // aparece aqui é o que sai no PDF — não há um "renderizador de prévia"
  // separado que possa divergir.
  const previa =
    tipo === null ? null : await montarPrevia(sessao, cliente.id, tipo, casoId)

  // A prévia é o PDF de verdade, gerado pela mesma função e pelo mesmo
  // Chromium — inclusive as quebras de página. Se um dia aparecer um segundo
  // caminho que desenha o documento de outro jeito, ele vai mentir; não crie.
  const enderecoDaPrevia =
    previa?.situacao === 'pronto'
      ? `/painel/clientes/${cliente.id}/gerar/previa?tipo=${tipo}&casoId=${casoId ?? ''}`
      : null

  return (
    <>
      <TopoDaPagina
        titulo="Gerar documento"
        subtitulo={
          <>
            {cliente.nome} ·{' '}
            <span className="mono">{formatarDocumento(cliente.documento)}</span>
          </>
        }
        acoes={
          <Link
            href={`/painel/clientes/${cliente.id}`}
            className="botao botao-secundario"
          >
            Voltar à ficha
          </Link>
        }
      />

      <div className="flex-1 overflow-auto px-6 py-6">
        {/*
          `min-w-0` nos dois filhos do grid — mesma armadilha do
          `min-height: auto` do flexbox, no eixo horizontal. Sem isto, o
          iframe da prévia (que tem largura própria fixa) empurraria a coluna
          da direita além do espaço disponível.
        */}
        <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          <div className="min-w-0">
            <div className="cartao mb-4">
              <div className="cartao-cabecalho">
                <h2>O que gerar</h2>
              </div>
              <div className="cartao-corpo">
                <form method="get" className="mb-4">
                  <div className="mb-[15px]">
                    <label className="campo-rotulo" htmlFor="tipo">
                      Documento
                    </label>
                    <select
                      id="tipo"
                      name="tipo"
                      className="campo-entrada"
                      defaultValue={tipo ?? ''}
                    >
                      <option value="">Escolha o documento…</option>
                      {TIPOS_GERAVEIS.map((geravel) => (
                        <option key={geravel} value={geravel}>
                          {ROTULO_DO_TIPO[geravel]}
                          {exigeCaso(geravel) ? ' (precisa de um caso)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-[15px]">
                    <label className="campo-rotulo" htmlFor="casoId">
                      Caso
                    </label>
                    <SeletorDeCaso
                      id="casoId"
                      name="casoId"
                      casos={cliente.casos}
                      opcaoEmBranco="Nenhum — documento do cliente"
                      valorInicial={casoId ?? ''}
                    />
                    <p className="dica">
                      O contrato cita o processo e os honorários, então precisa de um
                      caso. Procuração e declaração são do cliente.
                    </p>
                  </div>

                  <button type="submit" className="botao botao-secundario">
                    Ver prévia
                  </button>
                </form>

                {previa?.situacao === 'pronto' && tipo !== null && (
                  <>
                    <div className="my-4 border-t border-borda" />
                    <FormularioDeGeracao
                      clienteId={cliente.id}
                      tipo={tipo}
                      casoId={casoId}
                    />
                  </>
                )}
              </div>
            </div>

            {previa?.situacao === 'faltam_dados' && (
              <div className="aviso aviso-erro">
                <span aria-hidden="true">▲</span>
                <div>
                  <b>Falta preencher antes de gerar:</b>
                  <ul className="mt-1.5 list-disc pl-4">
                    {previa.faltando.map((campo) => (
                      <li key={campo}>{campo}</li>
                    ))}
                  </ul>
                  <Link
                    href={previa.ondePreencher}
                    className="mt-2 inline-block underline underline-offset-2"
                  >
                    Completar o cadastro
                  </Link>
                </div>
              </div>
            )}

            {previa?.situacao === 'caso_obrigatorio' && (
              <div className="aviso aviso-atencao">
                <span aria-hidden="true">▲</span>
                <div>
                  <b>Escolha um caso.</b> O contrato descreve o objeto e os honorários
                  de um processo específico.
                </div>
              </div>
            )}

            <div className="aviso aviso-info mt-4">
              <span aria-hidden="true">▲</span>
              <div>
                <b>O texto é do escritório.</b> Os modelos vêm dos arquivos enviados
                pela E. Ferreira e não são alterados pelo sistema — só os dados do
                cliente e do caso são preenchidos.
              </div>
            </div>
          </div>

          <div className="cartao min-w-0">
            <div className="cartao-cabecalho">
              <h2>Prévia</h2>
              {previa?.situacao === 'pronto' && (
                <span className="ml-auto text-[12px] text-texto-2">
                  é o PDF, não um desenho dele
                </span>
              )}
            </div>

            {enderecoDaPrevia !== null ? (
              // O visualizador de PDF do próprio navegador. Mostra a
              // paginação, o papel timbrado repetido em cada folha e as
              // quebras exatamente como vão sair — porque é o arquivo.
              <iframe
                title="Prévia do documento"
                src={enderecoDaPrevia}
                className="h-[80vh] w-full border-0 bg-prata-100"
              />
            ) : (
              <div className="px-[18px] py-16 text-center">
                <p className="mb-1 text-[13.5px] font-medium text-texto-2">
                  Escolha o documento para ver a prévia.
                </p>
                <p className="text-[12.5px] text-texto-3">
                  Nada é gravado enquanto você não mandar gerar.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
