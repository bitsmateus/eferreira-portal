'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  LINHAS_DE_PARCELA,
  atualizarCaso,
  criarCaso,
  lerParcelas,
  somaDasParcelasConfere,
  validarCaso,
  type CamposDeCaso,
  type ParcelaInformada,
} from '@/lib/casos'
import { formatarReais } from '@/lib/extenso'
import { texto, type ErrosDeCampo } from '@/lib/formulario'
import { emailDaSessao, exigirSessaoDaEquipe } from '@/lib/sessao'

export type EstadoDoCaso =
  | {
      erros?: ErrosDeCampo
      mensagem?: string
      /** Caso que já usa a numeração informada. */
      conflito?: { id: string }
    }
  | undefined

function lerCampos(dados: FormData): CamposDeCaso {
  return {
    numeroProcesso: texto(dados, 'numeroProcesso'),
    assunto: texto(dados, 'assunto'),
    vara: texto(dados, 'vara'),
    parteContraria: texto(dados, 'parteContraria'),
    situacao: texto(dados, 'situacao'),
    responsavelId: texto(dados, 'responsavelId'),
    honorarios: texto(dados, 'honorarios'),
  }
}

function lerLinhasDeParcela(dados: FormData) {
  const linhas = []
  for (let indice = 0; indice < LINHAS_DE_PARCELA; indice += 1) {
    linhas.push({
      valor: texto(dados, `parcela-${indice}-valor`),
      vencimento: texto(dados, `parcela-${indice}-vencimento`),
    })
  }
  return linhas
}

/** Valida caso e parcelas juntos, porque a soma precisa bater com o total. */
function conferirTudo(
  dados: FormData,
):
  | { ok: true; caso: ReturnType<typeof validarCaso> & { ok: true }; parcelas: ParcelaInformada[] }
  | { ok: false; erros: ErrosDeCampo } {
  const caso = validarCaso(lerCampos(dados))
  const parcelas = lerParcelas(lerLinhasDeParcela(dados))

  if (!caso.ok || !parcelas.ok) {
    return {
      ok: false,
      erros: { ...(caso.ok ? {} : caso.erros), ...(parcelas.ok ? {} : parcelas.erros) },
    }
  }

  if (!somaDasParcelasConfere(caso.dados.honorarios, parcelas.dados)) {
    const soma = parcelas.dados.reduce((total, p) => total + p.valorEmCentavos, 0)
    return {
      ok: false,
      erros: {
        honorarios: `A soma das parcelas (${formatarReais(
          soma,
        )}) não bate com o total dos honorários. Contrato com dois valores diferentes para a mesma coisa vira discussão depois.`,
      },
    }
  }

  return { ok: true, caso, parcelas: parcelas.dados }
}

export async function cadastrarCaso(
  clienteId: string,
  _estado: EstadoDoCaso,
  dados: FormData,
): Promise<EstadoDoCaso> {
  const sessao = await exigirSessaoDaEquipe()

  const conferido = conferirTudo(dados)
  if (!conferido.ok) return { erros: conferido.erros }

  const resultado = await criarCaso(
    sessao,
    clienteId,
    conferido.caso.dados,
    conferido.parcelas,
    await emailDaSessao(sessao),
  )

  if (resultado.situacao === 'cliente_nao_encontrado') {
    return { mensagem: 'Cliente não encontrado.' }
  }

  if (resultado.situacao === 'responsavel_invalido') {
    return {
      erros: {
        responsavelId:
          'Responsável inválido. Escolha um operador ou administrador ativo.',
      },
    }
  }

  if (resultado.situacao === 'numero_repetido') {
    return {
      erros: {
        numeroProcesso: 'Já existe um caso com este número de processo.',
      },
      conflito: { id: resultado.casoId },
    }
  }

  revalidatePath('/painel/casos')
  revalidatePath(`/painel/clientes/${clienteId}`)
  redirect(`/painel/casos/${resultado.casoId}`)
}

export async function salvarEdicaoDeCaso(
  id: string,
  _estado: EstadoDoCaso,
  dados: FormData,
): Promise<EstadoDoCaso> {
  const sessao = await exigirSessaoDaEquipe()

  const conferido = conferirTudo(dados)
  if (!conferido.ok) return { erros: conferido.erros }

  const resultado = await atualizarCaso(
    sessao,
    id,
    conferido.caso.dados,
    conferido.parcelas,
    await emailDaSessao(sessao),
  )

  if (resultado.situacao === 'nao_encontrado') {
    return { mensagem: 'Caso não encontrado.' }
  }

  if (resultado.situacao === 'responsavel_invalido') {
    return {
      erros: {
        responsavelId:
          'Responsável inválido. Escolha um operador ou administrador ativo.',
      },
    }
  }

  if (resultado.situacao === 'numero_repetido') {
    return {
      erros: {
        numeroProcesso: 'Já existe um caso com este número de processo.',
      },
      conflito: { id: resultado.casoId },
    }
  }

  revalidatePath('/painel/casos')
  revalidatePath(`/painel/casos/${id}`)
  redirect(`/painel/casos/${id}`)
}
