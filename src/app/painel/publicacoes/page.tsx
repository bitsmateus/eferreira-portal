import type { Metadata } from 'next'
import Link from 'next/link'

import { TopoDaPagina } from '@/componentes/topo-da-pagina'
import { listarStatus } from '@/lib/andamentos'
import { listarResponsaveis } from '@/lib/casos'
import { diaEmSaoPaulo, formatarDataHora } from '@/lib/datas'
import { iaConfigurada } from '@/lib/ia'
import {
  LIMITE_DA_FILA,
  casosParaLigar,
  contarPublicacoes,
  lerFiltroDaFila,
  listarPublicacoes,
  ultimaConsulta,
  type FiltroDaFila,
} from '@/lib/publicacoes'
import { exigirSessaoDaEquipe } from '@/lib/sessao'

import { BotaoConsultar } from './botao-consultar'
import { CartaoDePublicacao } from './cartao-de-publicacao'

export const metadata: Metadata = {
  title: 'Publicações — E. Ferreira Advogados',
}

const VAZIO: Record<FiltroDaFila, string> = {
  pendentes: 'Nada para conferir. Tudo o que chegou do DJEN já foi tratado.',
  sem_caso: 'Nenhuma publicação sem caso no portal.',
  conferidas: 'Nenhuma publicação conferida ainda.',
  descartadas: 'Nenhuma publicação descartada.',
}

/**
 * A fila de conferência da esteira de acompanhamento (09/11/2026). Interna à
 * equipe — ver `src/lib/publicacoes.ts` e `docs/publicacoes.md`.
 */
export default async function PaginaDePublicacoes({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>
}) {
  const sessao = await exigirSessaoDaEquipe()
  const filtro = lerFiltroDaFila((await searchParams).filtro)

  const [publicacoes, contagem, consulta, responsaveis, status, casos] = await Promise.all([
    listarPublicacoes(sessao, filtro),
    contarPublicacoes(sessao),
    ultimaConsulta(sessao),
    listarResponsaveis(sessao),
    listarStatus(),
    filtro === 'sem_caso' ? casosParaLigar(sessao) : Promise.resolve([]),
  ])
  const hoje = diaEmSaoPaulo(new Date())
  const iaLigada = iaConfigurada()

  const abas: { filtro: FiltroDaFila; rotulo: string }[] = [
    { filtro: 'pendentes', rotulo: `Para conferir (${contagem.pendentes})` },
    { filtro: 'sem_caso', rotulo: `Sem caso (${contagem.semCaso})` },
    { filtro: 'conferidas', rotulo: 'Conferidas' },
    { filtro: 'descartadas', rotulo: 'Descartadas' },
  ]

  return (
    <>
      <TopoDaPagina
        titulo="Publicações"
        subtitulo="O que chegou do Diário de Justiça Eletrônico Nacional (DJEN) para a equipe conferir"
        acoes={<BotaoConsultar />}
      />

      <div className="flex-1 overflow-auto px-6 py-6">
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-texto-2">
          <span>
            {consulta === null
              ? 'Nenhuma consulta feita ainda.'
              : `Última consulta: ${formatarDataHora(consulta.iniciadaEm)} · ${consulta.novas} nova(s) de ${consulta.encontradas}`}
          </span>
          <span>{iaLigada ? 'Análise por IA ligada' : 'Análise por IA desligada'}</span>
          <span>Prazos são sugestões: feriados locais e suspensões do tribunal não entram na conta.</span>
        </div>

        {consulta?.erro != null && (
          <div className="aviso aviso-atencao mb-4" role="status">
            <span aria-hidden="true">▲</span>
            <div className="whitespace-pre-line">{consulta.erro}</div>
          </div>
        )}

        <nav className="mb-4 flex flex-wrap gap-1.5" aria-label="Filtro da fila">
          {abas.map((aba) => (
            <Link
              key={aba.filtro}
              href={aba.filtro === 'pendentes' ? '/painel/publicacoes' : `/painel/publicacoes?filtro=${aba.filtro}`}
              className={`botao botao-pequeno ${aba.filtro === filtro ? 'botao-secundario' : 'botao-fantasma'}`}
              aria-current={aba.filtro === filtro ? 'page' : undefined}
            >
              {aba.rotulo}
            </Link>
          ))}
        </nav>

        {publicacoes.length === 0 ? (
          <div className="cartao px-[18px] py-10 text-center text-[14px] text-texto-2">{VAZIO[filtro]}</div>
        ) : (
          <>
            {publicacoes.map((publicacao) => (
              <CartaoDePublicacao
                key={publicacao.id}
                publicacao={publicacao}
                hoje={hoje}
                iaLigada={iaLigada}
                responsaveis={responsaveis}
                status={status}
                casos={casos}
              />
            ))}
            {publicacoes.length === LIMITE_DA_FILA && (
              <p className="text-[12px] text-texto-3">Mostrando as {LIMITE_DA_FILA} primeiras.</p>
            )}
          </>
        )}
      </div>
    </>
  )
}
