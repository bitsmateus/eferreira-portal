/**
 * A tela do envio para assinatura eletrônica.
 *
 * Ela existe por um motivo só: **o envio custa e não se desfaz.** Cada um
 * consome um crédito do escritório e manda e-mail de verdade para o cliente.
 * Então antes do botão aparecem, à vista, as três coisas que alguém quer
 * conferir e depois não consegue mais: qual documento, para quais endereços, e
 * quantos créditos ainda restam.
 *
 * Depois do envio, é esta mesma tela que pergunta à D4Sign se já assinaram —
 * consulta de leitura, que não custa nada.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SituacaoDoEnvio } from '@prisma/client'

import { Etiqueta } from '@/componentes/etiqueta'
import { TopoDaPagina } from '@/componentes/topo-da-pagina'
import { ROTULO_DO_TIPO } from '@/lib/arquivos'
import {
  ROTULO_DO_PAPEL,
  envioDoDocumento,
  prepararEnvio,
  type EnvioEmAndamento,
  type ParteQueAssina,
} from '@/lib/assinaturas'
import { filtroDeDocumentos } from '@/lib/autorizacao'
import { formatarDataHora } from '@/lib/datas'
import { prisma } from '@/lib/prisma'
import { exigirSessaoDaEquipe } from '@/lib/sessao'
import { BotaoDeConferencia, ConfirmacaoDeEnvio } from './formulario'

export const metadata: Metadata = {
  title: 'Assinatura eletrônica — E. Ferreira Advogados',
}

const ROTULO_DA_SITUACAO: Record<SituacaoDoEnvio, string> = {
  NO_COFRE: 'No cofre, não enviado',
  AGUARDANDO: 'Aguardando assinatura',
  ASSINADO: 'Assinado',
  CANCELADO: 'Cancelado na D4Sign',
}

const TOM_DA_SITUACAO: Record<
  SituacaoDoEnvio,
  'ok' | 'atencao' | 'erro' | 'info' | 'neutra'
> = {
  NO_COFRE: 'atencao',
  AGUARDANDO: 'info',
  ASSINADO: 'ok',
  CANCELADO: 'erro',
}

function ListaDeSignatarios({ partes }: { partes: readonly ParteQueAssina[] }) {
  return (
    <ul className="mb-4">
      {partes.map((parte) => (
        <li
          key={`${parte.papel}-${parte.email ?? ''}`}
          className="flex flex-wrap items-baseline gap-x-2 border-b border-prata-100 py-2.5 last:border-b-0"
        >
          <span className="text-[13px] font-medium">{parte.nome}</span>
          <span className="text-[11.5px] text-texto-3">
            {ROTULO_DO_PAPEL[parte.papel]}
          </span>
          <span className="mono ml-auto text-[12.5px] text-texto-2">
            {parte.email ?? '— sem e-mail —'}
          </span>
        </li>
      ))}
    </ul>
  )
}

function SituacaoDoEnvioNaTela({
  envio,
  clienteId,
}: {
  envio: EnvioEmAndamento
  clienteId: string
}) {
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <Etiqueta tom={TOM_DA_SITUACAO[envio.situacao]}>
          {ROTULO_DA_SITUACAO[envio.situacao]}
        </Etiqueta>
        {envio.enviadoEm !== null && (
          <span className="text-[12px] text-texto-2">
            enviado em <span className="mono">{formatarDataHora(envio.enviadoEm)}</span>
          </span>
        )}
      </div>

      {envio.partes.length > 0 && <ListaDeSignatarios partes={envio.partes} />}

      {envio.conferidoEm !== null && (
        <p className="mb-3 text-[12px] text-texto-3">
          Última conferência em{' '}
          <span className="mono">{formatarDataHora(envio.conferidoEm)}</span>
          {envio.situacaoNaD4Sign !== null && <> · D4Sign: {envio.situacaoNaD4Sign}</>}
        </p>
      )}

      {envio.situacao === SituacaoDoEnvio.ASSINADO &&
      envio.documentoAssinadoId !== null ? (
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/painel/documentos/${envio.documentoAssinadoId}/arquivo`}
            target="_blank"
            rel="noreferrer"
            className="botao"
          >
            Abrir o documento assinado
          </a>
          <Link href={`/painel/clientes/${clienteId}`} className="botao botao-secundario">
            Voltar à ficha
          </Link>
        </div>
      ) : (
        <>
          <p className="mb-3 text-[12.5px] leading-relaxed text-texto-2">
            O portal pergunta à D4Sign se o documento já foi assinado. É consulta de
            leitura — não consome crédito e não manda e-mail nenhum. Quando estiver
            assinado, o PDF volta sozinho para a pasta do cliente.
          </p>
          <BotaoDeConferencia
            envioId={envio.id}
            documentoId={envio.documentoId}
            clienteId={clienteId}
          />
        </>
      )}
    </>
  )
}

export default async function PaginaDaAssinatura({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const sessao = await exigirSessaoDaEquipe()
  const { id } = await params

  // Regra 2: o id vem da URL e quem decide se ele pode ser lido é o filtro
  // montado a partir da sessão. Este findFirst é só o cabeçalho da tela — a
  // decisão de verdade está em `prepararEnvio`.
  const documento = await prisma.documento.findFirst({
    where: filtroDeDocumentos(sessao, { id }),
    select: {
      id: true,
      nome: true,
      tipo: true,
      clienteId: true,
      assinadoEm: true,
      cliente: { select: { nome: true } },
    },
  })
  if (documento === null) notFound()

  const preparo = await prepararEnvio(sessao, documento.id)
  const envio = await envioDoDocumento(sessao, documento.id)

  const topo = (
    <TopoDaPagina
      titulo="Assinatura eletrônica"
      subtitulo={
        <>
          {ROTULO_DO_TIPO[documento.tipo]} de {documento.cliente.nome} ·{' '}
          {documento.nome}
        </>
      }
      acoes={
        <Link
          href={`/painel/clientes/${documento.clienteId}`}
          className="botao botao-secundario"
        >
          Voltar à ficha
        </Link>
      }
    />
  )

  function Cartao({ children }: { children: React.ReactNode }) {
    return (
      <div className="flex-1 overflow-auto px-6 py-6">
        <div className="max-w-[640px]">
          <div className="cartao">
            <div className="cartao-cabecalho">
              <h2>Envio para assinatura</h2>
            </div>
            <div className="cartao-corpo">{children}</div>
          </div>
        </div>
      </div>
    )
  }

  if (preparo.situacao === 'sem_integracao' || preparo.situacao === 'sem_cofre') {
    return (
      <>
        {topo}
        <Cartao>
          <div className="aviso aviso-atencao" role="alert">
            <span aria-hidden="true">▲</span>
            <div>
              {preparo.situacao === 'sem_integracao'
                ? 'Esta instalação não tem a assinatura eletrônica configurada.'
                : 'O cofre da D4Sign não está definido nesta instalação.'}{' '}
              Faltam variáveis de ambiente — ver{' '}
              <span className="mono">docs/assinatura-eletronica.md</span>. Enquanto
              isso, a data do contrato assinado continua sendo informada na ficha do
              cliente.
            </div>
          </div>
        </Cartao>
      </>
    )
  }

  if (preparo.situacao === 'tipo_nao_assinavel') {
    return (
      <>
        {topo}
        <Cartao>
          <div className="aviso aviso-info">
            <span aria-hidden="true">●</span>
            <div>
              Este documento não vai para assinatura: ou é um anexo que o escritório
              recebeu, ou é o próprio PDF que já voltou assinado.
            </div>
          </div>
        </Cartao>
      </>
    )
  }

  if (preparo.situacao === 'nao_encontrado') notFound()

  if (preparo.situacao === 'ja_enviado' || preparo.situacao === 'ja_assinado') {
    return (
      <>
        {topo}
        <Cartao>
          {envio === null ? (
            <div className="aviso aviso-ok">
              <span aria-hidden="true">●</span>
              <div>
                Este documento já consta como assinado. A data foi informada na ficha
                do cliente, não pela D4Sign.
              </div>
            </div>
          ) : (
            <SituacaoDoEnvioNaTela envio={envio} clienteId={documento.clienteId} />
          )}
        </Cartao>
      </>
    )
  }

  if (preparo.situacao === 'sem_email') {
    return (
      <>
        {topo}
        <Cartao>
          <div className="aviso aviso-erro" role="alert">
            <span aria-hidden="true">▲</span>
            <div>
              Não dá para enviar sem o e-mail de quem assina. Falta o endereço de:
              <ul className="mt-1.5 list-disc pl-4">
                {preparo.faltando.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="mt-2">
                <Link
                  href={preparo.ondePreencher}
                  className="underline underline-offset-2"
                >
                  Preencher o cadastro
                </Link>
              </p>
            </div>
          </div>
        </Cartao>
      </>
    )
  }

  if (preparo.situacao === 'sem_creditos') {
    return (
      <>
        {topo}
        <Cartao>
          <div className="aviso aviso-erro" role="alert">
            <span aria-hidden="true">▲</span>
            <div>
              A conta da D4Sign do escritório está sem créditos. Cada assinatura
              consome um, e a recarga é feita no painel da própria D4Sign — é custo
              de terceiro, da Cláusula 6ª do contrato.
            </div>
          </div>
        </Cartao>
      </>
    )
  }

  return (
    <>
      {topo}
      <Cartao>
        {preparo.retomavel !== null && (
          <div className="aviso aviso-atencao mb-4">
            <span aria-hidden="true">▲</span>
            <div>
              Uma tentativa anterior subiu este PDF para o cofre do escritório e
              parou antes do envio — nenhum e-mail saiu e nenhum crédito foi gasto.
              Tentar de novo reaproveita o documento que já está lá, em vez de subir
              outra cópia.
            </div>
          </div>
        )}

        {/*
          Conferir o PDF antes de gastar o crédito.
          A tela dizia o NOME do arquivo e não dava como abri-lo — e é o último
          momento em que dá para descobrir que se gerou o documento do caso
          errado. Depois do envio o crédito foi e o cliente já recebeu.
        */}
        <a
          href={`/painel/documentos/${documento.id}/arquivo`}
          target="_blank"
          rel="noreferrer"
          className="botao botao-secundario botao-pequeno mb-4 inline-flex"
        >
          Conferir o documento antes de enviar
        </a>

        <p className="mb-3 text-[12.5px] leading-relaxed text-texto-2">
          Quem recebe o e-mail de assinatura:
        </p>

        <ListaDeSignatarios partes={preparo.partes} />

        <p className="mb-4 text-[12px] leading-relaxed text-texto-3">
          {preparo.creditosRestantes === null ? (
            <>
              Não foi possível consultar o saldo da conta da D4Sign agora. O envio
              continua possível, mas sem saber quantos créditos restam.
            </>
          ) : (
            <>
              A conta do escritório tem{' '}
              <strong className="text-texto-1">
                {preparo.creditosRestantes}{' '}
                {preparo.creditosRestantes === 1 ? 'crédito' : 'créditos'}
              </strong>{' '}
              — este envio gasta um.
            </>
          )}{' '}
          As testemunhas do contrato não entram na assinatura eletrônica; elas
          continuam no papel.
        </p>

        <ConfirmacaoDeEnvio
          documentoId={documento.id}
          quantasPartes={preparo.partes.length}
          retomando={preparo.retomavel !== null}
        />
      </Cartao>
    </>
  )
}
