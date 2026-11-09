'use server'

import { after } from 'next/server'
import { revalidatePath } from 'next/cache'

import { validarAndamento } from '@/lib/andamentos'
import { validarEvento } from '@/lib/eventos'
import { texto, type ErrosDeCampo } from '@/lib/formulario'
import {
  analisarPendentes,
  conferirPublicacao,
  descartarPublicacao,
  executarConsulta,
  ligarPublicacaoAoCaso,
  reabrirPublicacao,
  reanalisarPublicacao,
  type ResultadoDaFila,
} from '@/lib/publicacoes'
import { emailDaSessao, exigirSessaoDaEquipe } from '@/lib/sessao'

export type EstadoDaPublicacao =
  | { erros?: ErrosDeCampo; mensagem?: string; sucesso?: boolean }
  | undefined

const MENSAGEM: Record<Exclude<ResultadoDaFila['situacao'], 'ok'>, string> = {
  nao_encontrada: 'Publicação não encontrada.',
  caso_nao_encontrado: 'Caso não encontrado.',
  ja_conferida: 'Esta publicação já foi tratada por outra pessoa. Atualize a página.',
  sem_caso: 'Ligue a publicação a um caso antes de criar tarefa ou andamento.',
  responsavel_invalido: 'O responsável escolhido não está ativo na equipe.',
  status_invalido: 'Situação do andamento inválida. Escolha uma da lista.',
}

function atualizarTelas(): void {
  revalidatePath('/painel/publicacoes')
  revalidatePath('/painel')
}

function resposta(resultado: ResultadoDaFila): EstadoDaPublicacao {
  if (resultado.situacao !== 'ok') return { mensagem: MENSAGEM[resultado.situacao] }
  atualizarTelas()
  return { sucesso: true }
}

export async function conferir(
  publicacaoId: string,
  _estado: EstadoDaPublicacao,
  dados: FormData,
): Promise<EstadoDaPublicacao> {
  const sessao = await exigirSessaoDaEquipe()

  const criarTarefa = texto(dados, 'criarTarefa') === 'on'
  const lancarAndamento = texto(dados, 'lancarAndamento') === 'on'

  const evento = criarTarefa
    ? validarEvento({
        responsavelId: texto(dados, 'responsavelId'),
        assunto: texto(dados, 'assunto'),
        prazoDeEntrega: texto(dados, 'prazoDeEntrega'),
        horario: texto(dados, 'horario'),
      })
    : null
  const andamento = lancarAndamento
    ? validarAndamento({
        data: texto(dados, 'data'),
        statusId: texto(dados, 'statusId'),
        statusPersonalizado: texto(dados, 'statusPersonalizado'),
        descricao: texto(dados, 'descricao'),
        encerraOCaso: '',
      })
    : null

  const erros = {
    ...(evento !== null && !evento.ok ? evento.erros : {}),
    ...(andamento !== null && !andamento.ok ? andamento.erros : {}),
  }
  if (Object.keys(erros).length > 0) return { erros }

  const resultado = await conferirPublicacao(
    sessao,
    publicacaoId,
    {
      evento: evento !== null && evento.ok ? evento.dados : null,
      andamento: andamento !== null && andamento.ok ? andamento.dados : null,
    },
    await emailDaSessao(sessao),
  )
  if (resultado.situacao === 'ok') revalidatePath('/painel/casos')
  return resposta(resultado)
}

export async function ligarAoCaso(
  publicacaoId: string,
  _estado: EstadoDaPublicacao,
  dados: FormData,
): Promise<EstadoDaPublicacao> {
  const sessao = await exigirSessaoDaEquipe()
  const casoId = texto(dados, 'casoId')
  if (casoId === '') return { erros: { casoId: 'Escolha o caso.' } }
  return resposta(await ligarPublicacaoAoCaso(sessao, publicacaoId, casoId, await emailDaSessao(sessao)))
}

export async function descartar(publicacaoId: string): Promise<EstadoDaPublicacao> {
  const sessao = await exigirSessaoDaEquipe()
  return resposta(await descartarPublicacao(sessao, publicacaoId, await emailDaSessao(sessao)))
}

export async function reabrir(publicacaoId: string): Promise<EstadoDaPublicacao> {
  const sessao = await exigirSessaoDaEquipe()
  return resposta(await reabrirPublicacao(sessao, publicacaoId, await emailDaSessao(sessao)))
}

export async function reanalisar(publicacaoId: string): Promise<EstadoDaPublicacao> {
  const sessao = await exigirSessaoDaEquipe()
  const resultado = await reanalisarPublicacao(sessao, publicacaoId)
  atualizarTelas()
  if (resultado.situacao === 'falhou') return { mensagem: `A análise falhou: ${resultado.erro}` }
  if (resultado.situacao === 'ia_desligada') return { mensagem: 'A IA não está configurada.' }
  return { sucesso: true }
}

/** "Consultar agora": a mesma rodada da rotina diária, disparada da tela. */
export async function consultarAgora(): Promise<EstadoDaPublicacao> {
  const sessao = await exigirSessaoDaEquipe()
  const resumo = await executarConsulta({ disparadaPorId: sessao.usuarioId })
  after(async () => {
    await analisarPendentes(resumo.consultaId)
  })
  atualizarTelas()
  if (resumo.erros.length > 0) return { mensagem: resumo.erros.join(' ') }
  return {
    sucesso: true,
    mensagem:
      resumo.novas === 0
        ? 'Consulta feita: nenhuma publicação nova.'
        : `Consulta feita: ${resumo.novas} publicação(ões) nova(s).`,
  }
}
