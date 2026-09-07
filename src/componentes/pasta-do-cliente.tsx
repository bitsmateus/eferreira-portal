/**
 * A pasta única do cliente — Anexo I, 4.a.
 *
 * Os arquivos saem por `/painel/documentos/[id]/arquivo`, que autoriza,
 * registra o acesso e redireciona para um link temporário. Nenhum caminho
 * daqui aponta para o arquivo em si (regra 5).
 */

import Link from 'next/link'

import { Etiqueta } from '@/componentes/etiqueta'
import { formatarData } from '@/lib/datas'
import { ROTULO_DO_TIPO } from '@/lib/arquivos'
import type { LinhaDeDocumento } from '@/lib/documentos'
import { formatarNumeroDeProcesso, formatarTamanho } from '@/lib/formatos'

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
  /** Na ficha do caso a pasta mostra só o que é daquele caso. */
  titulo = 'Pasta do cliente',
  mostrarVinculo = true,
}: {
  clienteId: string
  documentos: readonly LinhaDeDocumento[]
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
          {documentos.map((documento) => (
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
                  {documento.enviadoPor !== null && (
                    <> · anexado por {documento.enviadoPor.nome}</>
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

              <div className="ml-auto flex items-center gap-2">
                {documento.assinadoEm !== null && (
                  <Etiqueta tom="ok">Assinado</Etiqueta>
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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
