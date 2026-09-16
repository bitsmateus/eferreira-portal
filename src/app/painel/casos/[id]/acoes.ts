'use server'

import { revalidatePath } from 'next/cache'

import {
  lancarAndamento,
  validarAndamento,
  type CamposDeAndamento,
} from '@/lib/andamentos'
import { texto, type ErrosDeCampo } from '@/lib/formulario'
import { emailDaSessao, exigirSessaoDaEquipe } from '@/lib/sessao'

export type EstadoDoAndamento =
  | { erros?: ErrosDeCampo; mensagem?: string; sucesso?: boolean }
  | undefined

export async function registrarAndamento(
  casoId: string,
  _estado: EstadoDoAndamento,
  dados: FormData,
): Promise<EstadoDoAndamento> {
  const sessao = await exigirSessaoDaEquipe()

  const campos: CamposDeAndamento = {
    data: texto(dados, 'data'),
    statusId: texto(dados, 'statusId'),
    statusPersonalizado: texto(dados, 'statusPersonalizado'),
    descricao: texto(dados, 'descricao'),
  }

  const conferido = validarAndamento(campos)
  if (!conferido.ok) return { erros: conferido.erros }

  const resultado = await lancarAndamento(
    sessao,
    casoId,
    conferido.dados,
    await emailDaSessao(sessao),
  )

  if (resultado.situacao === 'caso_nao_encontrado') {
    return { mensagem: 'Caso não encontrado.' }
  }

  if (resultado.situacao === 'status_invalido') {
    return {
      erros: { statusId: 'Situação inválida. Escolha uma da lista.' },
    }
  }

  // Fica na mesma página: quem lança andamento costuma lançar outro em
  // seguida, e a linha do tempo logo abaixo já mostra o que acabou de entrar.
  revalidatePath(`/painel/casos/${casoId}`)
  revalidatePath('/painel')
  revalidatePath('/painel/casos')
  revalidatePath('/painel/clientes')

  return { sucesso: true }
}
