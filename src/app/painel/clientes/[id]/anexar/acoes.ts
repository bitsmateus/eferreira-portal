'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  anexarDocumento,
  validarAnexo,
  validarArquivo,
  type CamposDeAnexo,
} from '@/lib/documentos'
import { texto, type ErrosDeCampo } from '@/lib/formulario'
import { emailDaSessao, exigirSessaoDaEquipe } from '@/lib/sessao'

export type EstadoDoAnexo = { erros?: ErrosDeCampo; mensagem?: string } | undefined

export async function anexarNaPasta(
  clienteId: string,
  _estado: EstadoDoAnexo,
  dados: FormData,
): Promise<EstadoDoAnexo> {
  const sessao = await exigirSessaoDaEquipe()

  const campos: CamposDeAnexo = {
    tipo: texto(dados, 'tipo'),
    casoId: texto(dados, 'casoId'),
  }

  const conferido = validarAnexo(campos)
  if (!conferido.ok) return { erros: conferido.erros }

  const bruto = dados.get('arquivo')
  const arquivo = bruto instanceof File ? bruto : null

  const conferidoArquivo = validarArquivo(arquivo)
  if (!conferidoArquivo.ok) return { erros: conferidoArquivo.erros }
  if (arquivo === null) return { erros: { arquivo: 'Escolha um arquivo para anexar.' } }

  const conteudo = new Uint8Array(await arquivo.arrayBuffer())

  const resultado = await anexarDocumento(
    sessao,
    clienteId,
    conferido.dados,
    {
      nome: conferidoArquivo.dados.nome,
      tipoConteudo: conferidoArquivo.dados.tipoConteudo,
      conteudo,
    },
    await emailDaSessao(sessao),
  )

  if (resultado.situacao === 'cliente_nao_encontrado') {
    return { mensagem: 'Cliente não encontrado.' }
  }

  if (resultado.situacao === 'caso_invalido') {
    return { erros: { casoId: 'Escolha um caso deste cliente.' } }
  }

  revalidatePath(`/painel/clientes/${clienteId}`)
  redirect(`/painel/clientes/${clienteId}`)
}
