/**
 * A pasta única do cliente — Anexo I, 4.a.
 *
 * Os arquivos saem por `/painel/documentos/[id]/arquivo`, que autoriza,
 * registra o acesso e redireciona para um link temporário. Nenhum caminho
 * daqui aponta para o arquivo em si (regra 5).
 */

import Link from 'next/link'
import { OrigemDoDocumento, SituacaoDoEnvio, TipoDocumento } from '@prisma/client'

import { Etiqueta } from '@/componentes/etiqueta'
import { ExcluirDocumentoBotao } from '@/componentes/excluir-documento-botao'
import type { EnvioEmAndamento } from '@/lib/assinaturas'
import { formatarData } from '@/lib/datas'
import { ROTULO_DO_TIPO } from '@/lib/arquivos'
import type { LinhaDeDocumento } from '@/lib/documentos'
import { formatarNumeroDeProcesso, formatarTamanho } from '@/lib/formatos'

/**
 * O que a pasta mostra sobre a assinatura eletrônica de cada documento.
 *
 * NO_COFRE aparece como "não enviado", e não como erro: aquele PDF está no
 * cofre do escritório sem ter saído, e quem abrir a tela pode tentar de novo.
 * Esconder isso deixaria um documento solto no cofre sem ninguém saber.
 */
const ETIQUETA_DO_ENVIO: Record<
  SituacaoDoEnvio,
  { tom: 'ok' | 'atencao' | 'erro' | 'info'; texto: string }
> = {
  NO_COFRE: { tom: 'atencao', texto: 'Não enviado' },
  AGUARDANDO: { tom: 'info', texto: 'Aguardando assinatura' },
  ASSINADO: { tom: 'ok', texto: 'Assinado' },
  CANCELADO: { tom: 'erro', texto: 'Cancelado' },
}

/**
 * O PDF que já voltou assinado não se manda assinar de novo.
 *
 * Anexo TAMBÉM vai para assinatura desde 17/09/2026 — pedido do escritório
 * para termo de acordo e outros documentos avulsos, com signatários
 * escolhidos na hora do envio (ver `partes.ts` e a tela de assinatura). O
 * parâmetro `tipo` fica só para não quebrar quem já chama esta função com
 * ele — hoje ela não distingue mais por tipo.
 */
function vaiParaAssinatura(_tipo: TipoDocumento, assinadoEm: Date | null): boolean {
  return assinadoEm === null
}

/** Rótulo curto do ícone, a partir do tipo de conteúdo. */
function selo(tipoConteudo: string): string {
  if (tipoConteudo === 'application/pdf') return 'PDF'
  if (tipoConteudo.startsWith('image/')) return 'IMG'
  if (tipoConteudo.includes('word')) return 'DOC'
  return 'ARQ'
}

export function PastaDoCliente({
  clienteId,
  documentos,
  /** O envio para assinatura de cada documento, por id do documento. */
  envios,
  /** Na ficha do caso a pasta mostra só o que é daquele caso. */
  titulo = 'Pasta do cliente',
  mostrarVinculo = true,
}: {
  clienteId: string
  documentos: readonly LinhaDeDocumento[]
  envios?: ReadonlyMap<string, EnvioEmAndamento>
  titulo?: string
  mostrarVinculo?: boolean
}) {
  return (
    <div className="cartao">
      <div className="cartao-cabecalho">
        <h2>{titulo}</h2>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[12px] text-texto-2">
            {documentos.length === 1
              ? '1 documento'
              : `${documentos.length} documentos`}
          </span>
          <Link
            href={`/painel/clientes/${clienteId}/anexar`}
            className="botao botao-pequeno"
          >
            + Anexar
          </Link>
        </div>
      </div>

      {documentos.length === 0 ? (
        <div className="px-[18px] py-9 text-center">
          <p className="mb-1 text-[13.5px] font-medium text-texto-2">
            A pasta está vazia.
          </p>
          <p className="text-[12.5px] text-texto-3">
            É aqui que contrato, procuração, declaração e os documentos de cada caso
            ficam reunidos —{' '}
            <Link
              href={`/painel/clientes/${clienteId}/anexar`}
              className="text-info underline underline-offset-2"
            >
              anexar o primeiro
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="px-[18px] py-1.5">
          {documentos.map((documento) => {
            const envio = envios?.get(documento.id) ?? null
            const etiquetaDoEnvio =
              envio === null || documento.assinadoEm !== null
                ? null
                : ETIQUETA_DO_ENVIO[envio.situacao]

            return (
            <div
              key={documento.id}
              className="flex flex-wrap items-center gap-3 border-b border-prata-100 py-3 last:border-b-0"
            >
              <div className="flex h-9 w-9 flex-none items-center justify-center rounded-md bg-prata-100 text-[10px] font-semibold tracking-wide text-texto-2">
                {selo(documento.tipoConteudo)}
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">{documento.nome}</div>
                <div className="mt-0.5 text-[11.5px] text-texto-3">
                  {ROTULO_DO_TIPO[documento.tipo]} ·{' '}
                  <span className="mono">{formatarData(documento.criadoEm)}</span> ·{' '}
                  {formatarTamanho(documento.tamanhoBytes)}
                  {documento.origem === OrigemDoDocumento.ASSINADO_NA_D4SIGN ? (
                    <> · recebido da assinatura eletrônica</>
                  ) : (
                    documento.enviadoPor !== null && (
                      <>
                        {' · '}
                        {documento.origem === OrigemDoDocumento.GERADO
                          ? 'gerado por'
                          : 'anexado por'}{' '}
                        {documento.enviadoPor.nome}
                      </>
                    )
                  )}
                  {mostrarVinculo && documento.caso !== null && (
                    <>
                      {' · '}
                      <Link
                        href={`/painel/casos/${documento.caso.id}`}
                        className="underline decoration-borda underline-offset-2 hover:decoration-texto-2"
                      >
                        {documento.caso.numeroProcesso === null
                          ? documento.caso.assunto
                          : formatarNumeroDeProcesso(documento.caso.numeroProcesso)}
                      </Link>
                    </>
                  )}
                </div>
              </div>

              <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                {documento.assinadoEm !== null && (
                  <Etiqueta tom="ok">Assinado</Etiqueta>
                )}
                {etiquetaDoEnvio !== null && (
                  <Etiqueta tom={etiquetaDoEnvio.tom}>{etiquetaDoEnvio.texto}</Etiqueta>
                )}
                {vaiParaAssinatura(documento.tipo, documento.assinadoEm) && (
                  <Link
                    href={`/painel/documentos/${documento.id}/assinatura`}
                    className="botao botao-secundario botao-pequeno"
                  >
                    {envio === null ? 'Assinar' : 'Ver assinatura'}
                  </Link>
                )}
                <a
                  href={`/painel/documentos/${documento.id}/arquivo`}
                  target="_blank"
                  rel="noreferrer"
                  className="botao botao-secundario botao-pequeno"
                >
                  Abrir
                </a>
                <a
                  href={`/painel/documentos/${documento.id}/arquivo?como=anexo`}
                  className="botao botao-fantasma botao-pequeno"
                >
                  Baixar
                </a>
                {/*
                  Só oferece o botão a quem PODE ser excluído — assinado ou já
                  enviado para assinatura não aparece com a opção, em vez de
                  um botão fadado a ser recusado pelo servidor.
                */}
                {documento.assinadoEm === null && envio === null && (
                  <ExcluirDocumentoBotao
                    documentoId={documento.id}
                    clienteId={clienteId}
                    casoId={documento.casoId}
                    nome={documento.nome}
                  />
                )}
              </div>
            </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
