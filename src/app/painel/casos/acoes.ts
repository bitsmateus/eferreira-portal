'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  LINHAS_DE_PARCELA,
  atualizarCaso,
  criarCaso,
  excluirCaso,
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
    percentualExito: texto(dados, 'percentualExito'),
    percentualProveitoEconomico: texto(dados, 'percentualProveitoEconomico'),
    referenciaDaEconomia: texto(dados, 'referenciaDaEconomia'),
    prazoDePagamentoDaEconomia: texto(dados, 'prazoDePagamentoDaEconomia'),
    tipoDeObjeto: texto(dados, 'tipoDeObjeto'),
    descricaoDoObjeto: texto(dados, 'descricaoDoObjeto'),
    honorariosPersonalizados: texto(dados, 'honorariosPersonalizados'),
    personalizadoServicos: texto(dados, 'personalizadoServicos'),
    personalizadoValorOuPercentual: texto(dados, 'personalizadoValorOuPercentual'),
    personalizadoBaseDeCalculo: texto(dados, 'personalizadoBaseDeCalculo'),
    personalizadoCondicaoDeExigibilidade: texto(
      dados,
      'personalizadoCondicaoDeExigibilidade',
    ),
    personalizadoPagamento: texto(dados, 'personalizadoPagamento'),
    personalizadoNatureza: texto(dados, 'personalizadoNatureza'),
    personalizadoRelacaoComAsDemais: texto(dados, 'personalizadoRelacaoComAsDemais'),
    personalizadoCondicoesEspecificas: texto(dados, 'personalizadoCondicoesEspecificas'),
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

/**
 * Cadastra um caso.
 *
 * `clienteFixo` vem preenchido quando o caso nasce dentro da ficha de um
 * cliente — ali o dono já está decidido, e aceitar um `clienteId` do
 * formulário abriria caminho para o caso cair em outro cadastro (regra 2).
 *
 * Nulo, o caso está nascendo da lista de Casos e o cliente vem do seletor.
 * Quem confere se ESTA sessão pode usar aquele cliente é `criarCaso`, pelo
 * filtro da sessão — aqui só se confere que algum foi escolhido.
 */
export async function cadastrarCaso(
  clienteFixo: string | null,
  _estado: EstadoDoCaso,
  dados: FormData,
): Promise<EstadoDoCaso> {
  const sessao = await exigirSessaoDaEquipe()

  const clienteId = clienteFixo ?? texto(dados, 'clienteId').trim()
  if (clienteId === '') {
    return { erros: { clienteId: 'Escolha o cliente deste caso.' } }
  }

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
    return { erros: { clienteId: 'Cliente não encontrado.' } }
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

export type EstadoDaExclusaoDeCaso = { erro?: string } | undefined

/**
 * Apaga um caso que ainda não deixou rastro.
 *
 * A confirmação viaja no corpo do formulário e é exigida aqui, não só na
 * tela: um POST solto nesta ação não pode apagar caso de ninguém.
 */
export async function excluirCasoDaLista(
  casoId: string,
  _estado: EstadoDaExclusaoDeCaso,
  dados: FormData,
): Promise<EstadoDaExclusaoDeCaso> {
  const sessao = await exigirSessaoDaEquipe()

  if (texto(dados, 'confirmacao') !== 'excluir') {
    return { erro: 'Exclusão não confirmada.' }
  }

  const resultado = await excluirCaso(sessao, casoId, await emailDaSessao(sessao))

  if (resultado.situacao === 'nao_encontrado') {
    return { erro: 'Caso não encontrado.' }
  }

  if (resultado.situacao === 'tem_historico') {
    const partes: string[] = []
    if (resultado.andamentos > 0) {
      partes.push(
        resultado.andamentos === 1
          ? '1 andamento lançado'
          : `${resultado.andamentos} andamentos lançados`,
      )
    }
    if (resultado.documentos > 0) {
      partes.push(
        resultado.documentos === 1
          ? '1 documento na pasta'
          : `${resultado.documentos} documentos na pasta`,
      )
    }

    return {
      erro:
        `Este caso não pode ser excluído porque já tem ${partes.join(', ')}. ` +
        'Apagar isso destruiria histórico de processo e documento. Se o cadastro ' +
        'está errado, corrija pela edição.',
    }
  }

  revalidatePath('/painel/casos')
  revalidatePath('/painel/clientes')
  redirect('/painel/casos')
}
