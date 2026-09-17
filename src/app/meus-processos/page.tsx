import { SituacaoCaso } from '@prisma/client'

import { Etiqueta } from '@/componentes/etiqueta'
import { EtiquetaDeSituacaoDoCaso } from '@/componentes/situacoes'
import { meusCasos, meusDocumentos } from '@/lib/area-do-cliente'
import { ROTULO_DO_TIPO } from '@/lib/arquivos'
import { formatarData, formatarDataExtenso } from '@/lib/datas'
import { formatarNumeroDeProcesso, formatarTamanho } from '@/lib/formatos'
import { exigirSessaoDeCliente } from '@/lib/sessao'

/** Rótulo curto do ícone, a partir do tipo de conteúdo. */
function selo(tipoConteudo: string): string {
  if (tipoConteudo === 'application/pdf') return 'PDF'
  if (tipoConteudo.startsWith('image/')) return 'IMG'
  if (tipoConteudo.includes('word')) return 'DOC'
  return 'ARQ'
}

/**
 * "Cliente — meus processos" do protótipo aprovado.
 *
 * Nenhuma consulta desta página recebe um identificador: `meusCasos` e
 * `meusDocumentos` só enxergam o cliente da sessão. Não existe aqui uma URL
 * como `/meus-processos?cliente=...` para alguém tentar trocar.
 */
export default async function PaginaDosMeusProcessos() {
  const sessao = await exigirSessaoDeCliente()

  const [casos, documentos] = await Promise.all([
    meusCasos(sessao),
    meusDocumentos(sessao),
  ])

  return (
    <div className="mx-auto w-full max-w-[940px] flex-1 px-5 pb-12 pt-7 sm:px-6">
      <h1 className="mb-1 font-serif text-[27px] font-semibold">Seus processos</h1>
      <p className="mb-6 text-[13px] text-texto-2">
        Acompanhe abaixo o andamento de cada caso. As informações são atualizadas
        pela equipe do escritório.
      </p>

      {casos.length === 0 ? (
        <div className="cartao">
          <div className="px-[18px] py-12 text-center">
            <p className="mb-1 text-[14px] font-medium text-texto-2">
              Nenhum processo cadastrado ainda.
            </p>
            <p className="text-[12.5px] text-texto-3">
              Assim que o escritório registrar o seu caso, ele aparece aqui.
            </p>
          </div>
        </div>
      ) : (
        casos.map((caso) => {
          const ultimo = caso.andamentos[0]
          const arquivado = caso.situacao === SituacaoCaso.ARQUIVADO

          return (
            <div key={caso.id} className="cartao mb-4">
              <div className="flex flex-wrap items-start gap-3 border-b border-borda px-[18px] py-3.5">
                <div className="min-w-0">
                  <div className="mono text-[13.5px] font-semibold">
                    {caso.numeroProcesso === null ? (
                      <span className="font-normal text-texto-3">
                        ainda sem número de processo
                      </span>
                    ) : (
                      formatarNumeroDeProcesso(caso.numeroProcesso)
                    )}
                  </div>
                  <div className="mt-0.5 text-[12px] text-texto-2">
                    {caso.assunto}
                    {caso.vara !== null && caso.vara !== '' && <> · {caso.vara}</>}
                  </div>
                </div>
                <div className="ml-auto">
                  <EtiquetaDeSituacaoDoCaso situacao={caso.situacao} />
                </div>
              </div>

              <div className="px-[18px] py-4">
                {ultimo === undefined ? (
                  <p className="py-5 text-center text-[12.5px] text-texto-3">
                    Ainda não há andamentos registrados neste processo.
                  </p>
                ) : (
                  <>
                    <div
                      className={`aviso mb-5 ${arquivado ? 'aviso-info' : 'aviso-ok'}`}
                    >
                      <span aria-hidden="true">▲</span>
                      <div>
                        <b>
                          {ultimo.status?.nome ?? 'Último andamento'} em{' '}
                          {formatarData(ultimo.data)}.
                        </b>{' '}
                        {ultimo.descricao}
                      </div>
                    </div>

                    <ol className="relative ml-1.5 border-l border-borda pl-5">
                      {caso.andamentos.map((andamento, indice) => (
                        <li key={andamento.id} className="relative pb-6 last:pb-0">
                          <span
                            aria-hidden="true"
                            className={[
                              'absolute -left-[27px] top-1 h-2.5 w-2.5 rounded-full border-2 border-superficie',
                              indice === 0 ? 'bg-grafite-700' : 'bg-prata-300',
                            ].join(' ')}
                          />
                          <div className="text-[11.5px] text-texto-3">
                            {formatarDataExtenso(andamento.data)}
                          </div>
                          <div className="mt-0.5 text-[13.5px] font-semibold">
                            {andamento.status?.nome ?? 'Andamento'}
                          </div>
                          <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-texto-2">
                            {andamento.descricao}
                          </p>
                        </li>
                      ))}
                    </ol>
                  </>
                )}
              </div>
            </div>
          )
        })
      )}

      <div className="cartao mt-6">
        <div className="cartao-cabecalho">
          <h2>Seus documentos</h2>
          <span className="ml-auto text-[12px] text-texto-2">
            {documentos.length === 1
              ? '1 documento'
              : `${documentos.length} documentos`}
          </span>
        </div>

        {documentos.length === 0 ? (
          <div className="px-[18px] py-9 text-center">
            <p className="text-[12.5px] text-texto-3">
              Quando o escritório anexar contrato, procuração ou qualquer outro
              documento seu, ele aparece aqui para baixar.
            </p>
          </div>
        ) : (
          <div className="px-[18px] py-1.5">
            {documentos.map((documento) => (
              <div
                key={documento.id}
                className="flex flex-wrap items-center gap-3 border-b border-prata-100 py-3 last:border-b-0"
              >
                <div className="flex h-9 w-9 flex-none items-center justify-center rounded-md bg-prata-100 text-[10px] font-semibold tracking-wide text-texto-2">
                  {selo(documento.tipoConteudo)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">
                    {documento.nome}
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-texto-3">
                    {ROTULO_DO_TIPO[documento.tipo]} ·{' '}
                    {documento.assinadoEm === null ? (
                      <span className="mono">{formatarData(documento.criadoEm)}</span>
                    ) : (
                      <>
                        assinado em{' '}
                        <span className="mono">
                          {formatarData(documento.assinadoEm)}
                        </span>
                      </>
                    )}{' '}
                    · {formatarTamanho(documento.tamanhoBytes)}
                    {documento.caso !== null && (
                      <>
                        {' · '}
                        {documento.caso.numeroProcesso === null
                          ? documento.caso.assunto
                          : formatarNumeroDeProcesso(documento.caso.numeroProcesso)}
                      </>
                    )}
                  </div>
                </div>

                <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                  {documento.assinadoEm !== null && (
                    <Etiqueta tom="ok">Assinado</Etiqueta>
                  )}
                  {/*
                    Nenhum link aponta para o arquivo: esta rota autoriza pela
                    sessão, registra o acesso e só então redireciona para uma
                    URL temporária (regra 5).
                  */}
                  <a
                    href={`/meus-processos/documentos/${documento.id}/arquivo`}
                    target="_blank"
                    rel="noreferrer"
                    className="botao botao-secundario botao-pequeno"
                  >
                    Abrir
                  </a>
                  <a
                    href={`/meus-processos/documentos/${documento.id}/arquivo?como=anexo`}
                    className="botao botao-fantasma botao-pequeno"
                  >
                    Baixar
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="mt-6 text-center text-[12px] text-texto-3">
        Dúvidas sobre seu processo? Fale com o escritório pelos canais habituais.
      </p>
    </div>
  )
}
