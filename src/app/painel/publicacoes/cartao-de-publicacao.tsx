'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { Etiqueta } from '@/componentes/etiqueta'
import { SeletorDeCaso, type CasoParaEscolha } from '@/componentes/seletor-de-caso'
import { ROTULO_DO_TIPO_DE_ATO } from '@/lib/analise-da-publicacao'
import { SENTINELA_STATUS_PERSONALIZADO } from '@/lib/andamentos'
import { dataParaDiaCivil, formatarData, formatarDataHora } from '@/lib/datas'
import { formatarNumeroDeProcesso } from '@/lib/formatos'
import type { LinhaDePublicacao } from '@/lib/publicacoes'
import {
  conferir,
  descartar,
  ligarAoCaso,
  reabrir,
  reanalisar,
  type EstadoDaPublicacao,
} from './acoes'

type Opcao = { id: string; nome: string }

function Botao({ rotulo, aguardando, classe }: { rotulo: string; aguardando: string; classe: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className={classe}>
      {pending ? aguardando : rotulo}
    </button>
  )
}

function Erro({ texto }: { texto: string | undefined }) {
  if (texto === undefined) return null
  return (
    <p className="dica dica-erro" role="alert">
      {texto}
    </p>
  )
}

function Aviso({ estado }: { estado: EstadoDaPublicacao }) {
  if (estado?.mensagem === undefined) return null
  return (
    <div className="aviso aviso-erro mb-3" role="alert">
      <span aria-hidden="true">▲</span>
      <div>{estado.mensagem}</div>
    </div>
  )
}

/** Etiqueta do prazo sugerido: vencido, vence em breve ou só a data. */
function EtiquetaDoPrazo({ prazo, hoje }: { prazo: Date | null; hoje: string }) {
  if (prazo === null) return <span className="text-texto-3">sem prazo identificado</span>
  const dia = dataParaDiaCivil(prazo)
  if (dia < hoje) return <Etiqueta tom="erro">{formatarData(prazo)} · vencido</Etiqueta>
  const tresDias = new Date(Date.parse(`${hoje}T12:00:00Z`) + 3 * 86_400_000).toISOString().slice(0, 10)
  if (dia <= tresDias) return <Etiqueta tom="atencao">{formatarData(prazo)} · vence em breve</Etiqueta>
  return <Etiqueta tom="info">{formatarData(prazo)}</Etiqueta>
}

function FormularioDeConferencia({
  publicacao,
  responsaveis,
  status,
}: {
  publicacao: LinhaDePublicacao
  responsaveis: readonly Opcao[]
  status: readonly Opcao[]
}) {
  const [estado, enviar] = useActionState(conferir.bind(null, publicacao.id), undefined)
  const erros = estado?.erros ?? {}
  const analise = publicacao.analise

  const [criarTarefa, setCriarTarefa] = useState(publicacao.prazoSugerido !== null)
  const [lancarAndamento, setLancarAndamento] = useState(false)
  const [statusId, setStatusId] = useState('')

  return (
    <form action={enviar} noValidate className="mt-3 rounded-md border border-borda p-3.5">
      <Aviso estado={estado} />

      <label className="flex items-center gap-2 text-[13px] font-medium">
        <input
          type="checkbox"
          name="criarTarefa"
          checked={criarTarefa}
          onChange={(e) => setCriarTarefa(e.target.checked)}
        />
        Criar tarefa no caso (vai para a Google Agenda)
      </label>

      {criarTarefa && (
        <div className="mt-2.5 grid gap-x-3.5 sm:grid-cols-2">
          <div className="mb-3 sm:col-span-2">
            <label className="campo-rotulo" htmlFor={`assunto-${publicacao.id}`}>
              Tarefa
            </label>
            <input
              id={`assunto-${publicacao.id}`}
              name="assunto"
              maxLength={180}
              className="campo-entrada"
              defaultValue={
                analise === null || analise.providencia.toLowerCase() === 'nenhuma'
                  ? 'Conferir e protocolar'
                  : `Conferir e protocolar: ${analise.providencia}`.slice(0, 180)
              }
            />
            <Erro texto={erros['assunto']} />
          </div>
          <div className="mb-3">
            <label className="campo-rotulo" htmlFor={`responsavel-${publicacao.id}`}>
              Responsável
            </label>
            <select
              id={`responsavel-${publicacao.id}`}
              name="responsavelId"
              className="campo-entrada"
              defaultValue={publicacao.caso?.responsavelId ?? ''}
            >
              <option value="">Escolha o responsável…</option>
              {responsaveis.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome}
                </option>
              ))}
            </select>
            <Erro texto={erros['responsavelId']} />
          </div>
          <div className="mb-3 flex gap-2.5">
            <div className="flex-1">
              <label className="campo-rotulo" htmlFor={`prazo-${publicacao.id}`}>
                Prazo (confira)
              </label>
              <input
                id={`prazo-${publicacao.id}`}
                type="date"
                name="prazoDeEntrega"
                className="campo-entrada"
                defaultValue={publicacao.prazoSugerido === null ? '' : dataParaDiaCivil(publicacao.prazoSugerido)}
              />
              <Erro texto={erros['prazoDeEntrega']} />
            </div>
            <div className="w-[110px]">
              <label className="campo-rotulo" htmlFor={`horario-${publicacao.id}`}>
                Horário
              </label>
              <input id={`horario-${publicacao.id}`} type="time" name="horario" className="campo-entrada" />
              <Erro texto={erros['horario']} />
            </div>
          </div>
        </div>
      )}

      <label className="mt-1 flex items-center gap-2 text-[13px] font-medium">
        <input
          type="checkbox"
          name="lancarAndamento"
          checked={lancarAndamento}
          onChange={(e) => setLancarAndamento(e.target.checked)}
        />
        Lançar andamento para o cliente ver
      </label>

      {lancarAndamento && (
        <div className="mt-2.5 grid gap-x-3.5 sm:grid-cols-2">
          <div className="mb-3">
            <label className="campo-rotulo" htmlFor={`data-${publicacao.id}`}>
              Data
            </label>
            <input
              id={`data-${publicacao.id}`}
              type="date"
              name="data"
              className="campo-entrada"
              defaultValue={dataParaDiaCivil(publicacao.disponibilizadaEm)}
            />
            <Erro texto={erros['data']} />
          </div>
          <div className="mb-3">
            <label className="campo-rotulo" htmlFor={`status-${publicacao.id}`}>
              Situação
            </label>
            <select
              id={`status-${publicacao.id}`}
              name="statusId"
              className="campo-entrada"
              value={statusId}
              onChange={(e) => setStatusId(e.target.value)}
            >
              <option value="">Escolha a situação…</option>
              {status.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
              <option value={SENTINELA_STATUS_PERSONALIZADO}>+ Personalizado…</option>
            </select>
            <Erro texto={erros['statusId']} />
            {statusId === SENTINELA_STATUS_PERSONALIZADO && (
              <>
                <input
                  name="statusPersonalizado"
                  maxLength={60}
                  placeholder="Situação personalizada"
                  className="campo-entrada mt-2"
                />
                <Erro texto={erros['statusPersonalizado']} />
              </>
            )}
          </div>
          <div className="mb-3 sm:col-span-2">
            <label className="campo-rotulo" htmlFor={`descricao-${publicacao.id}`}>
              O que o cliente vai ler
            </label>
            <textarea
              id={`descricao-${publicacao.id}`}
              name="descricao"
              rows={3}
              maxLength={2000}
              className="campo-entrada"
              defaultValue={analise?.textoParaCliente ?? ''}
            />
            <Erro texto={erros['descricao']} />
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Botao rotulo="Conferido" aguardando="Gravando…" classe="botao botao-secundario botao-pequeno" />
        <span className="text-[11.5px] text-texto-3">
          {criarTarefa || lancarAndamento ? '' : 'Sem tarefa nem andamento: só registra que foi visto.'}
        </span>
      </div>
    </form>
  )
}

function FormularioDeLigacao({ publicacaoId, casos }: { publicacaoId: string; casos: readonly CasoParaEscolha[] }) {
  const [estado, enviar] = useActionState(ligarAoCaso.bind(null, publicacaoId), undefined)
  return (
    <form action={enviar} className="mt-3 rounded-md border border-borda p-3.5">
      <Aviso estado={estado} />
      <label className="campo-rotulo" htmlFor={`caso-${publicacaoId}`}>
        Ligar a um caso cadastrado
      </label>
      <SeletorDeCaso id={`caso-${publicacaoId}`} name="casoId" casos={casos} opcaoEmBranco="Escolha o caso…" />
      <Erro texto={estado?.erros?.['casoId']} />
      <div className="mt-2.5">
        <Botao rotulo="Ligar ao caso" aguardando="Ligando…" classe="botao botao-secundario botao-pequeno" />
      </div>
    </form>
  )
}

function AcaoSimples({
  acao,
  rotulo,
  aguardando,
}: {
  acao: () => Promise<EstadoDaPublicacao>
  rotulo: string
  aguardando: string
}) {
  const [estado, enviar] = useActionState(async () => acao(), undefined)
  return (
    <form action={enviar} className="inline">
      <Botao rotulo={rotulo} aguardando={aguardando} classe="botao botao-fantasma botao-pequeno" />
      {estado?.mensagem !== undefined && (
        <span className="ml-2 text-[11.5px] text-erro" role="alert">
          {estado.mensagem}
        </span>
      )}
    </form>
  )
}

export function CartaoDePublicacao({
  publicacao,
  hoje,
  iaLigada,
  responsaveis,
  status,
  casos,
}: {
  publicacao: LinhaDePublicacao
  hoje: string
  iaLigada: boolean
  responsaveis: readonly Opcao[]
  status: readonly Opcao[]
  casos: readonly CasoParaEscolha[]
}) {
  const [verTexto, setVerTexto] = useState(false)
  const analise = publicacao.analise
  const pendente = publicacao.situacao === 'PENDENTE'

  return (
    <div className="cartao mb-3">
      <div className="cartao-cabecalho">
        <div className="min-w-0">
          <div className="mono text-[13px] font-semibold">{formatarNumeroDeProcesso(publicacao.numeroProcesso)}</div>
          <div className="mt-0.5 text-[11.5px] text-texto-3">
            {publicacao.siglaTribunal}
            {publicacao.orgao === null ? '' : ` · ${publicacao.orgao}`} · disponibilizada em{' '}
            {formatarData(publicacao.disponibilizadaEm)}
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {publicacao.tipoDocumento !== null && <Etiqueta tom="neutra">{publicacao.tipoDocumento}</Etiqueta>}
          {pendente && <EtiquetaDoPrazo prazo={publicacao.prazoSugerido} hoje={hoje} />}
        </div>
      </div>

      <div className="cartao-corpo">
        <div className="mb-2.5 text-[12.5px]">
          {publicacao.caso === null ? (
            <Etiqueta tom="atencao">Sem caso no portal</Etiqueta>
          ) : (
            <Link href={`/painel/casos/${publicacao.caso.id}`} className="font-medium underline-offset-2 hover:underline">
              {publicacao.caso.cliente.nome} — {publicacao.caso.assunto}
            </Link>
          )}
        </div>

        {analise !== null ? (
          <div className="rounded-md bg-fundo p-3 text-[12.5px]">
            <div className="mb-1 text-[10.5px] uppercase tracking-[0.08em] text-texto-3">
              Análise da IA · {ROTULO_DO_TIPO_DE_ATO[analise.tipo]} · confira antes de agir
            </div>
            <p className="mb-1.5">{analise.resumo}</p>
            <p>
              <span className="font-medium">Providência: </span>
              {analise.providencia}
              {analise.prazoEmDias !== null &&
                ` — ${analise.prazoEmDias} dia(s) ${analise.contagem === 'corridos' ? 'corridos' : 'úteis'}`}
            </p>
          </div>
        ) : !pendente ? null : (
          <p className="text-[12px] text-texto-3">
            {!iaLigada
              ? 'IA desligada: leia o inteiro teor e defina o prazo na conferência.'
              : publicacao.analiseErro !== null
                ? `A análise falhou (${publicacao.analiseErro}).`
                : 'Análise da IA ainda não feita — sai na próxima rodada.'}
          </p>
        )}

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <button type="button" className="botao botao-fantasma botao-pequeno" onClick={() => setVerTexto((v) => !v)}>
            {verTexto ? 'Esconder inteiro teor' : 'Ver inteiro teor'}
          </button>
          {publicacao.link !== null && (
            <a href={publicacao.link} target="_blank" rel="noreferrer noopener" className="botao botao-fantasma botao-pequeno">
              Abrir no tribunal ↗
            </a>
          )}
          {pendente && iaLigada && (
            <AcaoSimples acao={() => reanalisar(publicacao.id)} rotulo="Analisar de novo" aguardando="Analisando…" />
          )}
          {pendente && <AcaoSimples acao={() => descartar(publicacao.id)} rotulo="Descartar" aguardando="Descartando…" />}
          {publicacao.situacao === 'DESCARTADA' && (
            <AcaoSimples acao={() => reabrir(publicacao.id)} rotulo="Devolver à fila" aguardando="Devolvendo…" />
          )}
        </div>

        {verTexto && (
          <pre className="mt-2.5 max-h-[360px] overflow-auto whitespace-pre-wrap rounded-md border border-borda p-3 font-sans text-[12px] leading-relaxed">
            {publicacao.texto}
          </pre>
        )}

        {pendente && publicacao.caso !== null && (
          <FormularioDeConferencia publicacao={publicacao} responsaveis={responsaveis} status={status} />
        )}
        {pendente && publicacao.caso === null && <FormularioDeLigacao publicacaoId={publicacao.id} casos={casos} />}

        {!pendente && publicacao.conferidaEm !== null && (
          <p className="mt-2.5 text-[11.5px] text-texto-3">
            {publicacao.situacao === 'DESCARTADA' ? 'Descartada' : 'Conferida'} por{' '}
            {publicacao.conferidaPor?.nome ?? '—'} em {formatarDataHora(publicacao.conferidaEm)}
            {publicacao.eventoId !== null && ' · tarefa criada'}
            {publicacao.andamentoId !== null && ' · andamento lançado'}
          </p>
        )}
      </div>
    </div>
  )
}
