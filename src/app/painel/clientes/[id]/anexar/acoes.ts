'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  anexarDocumento,
  validarAnexo,
  validarArquivos,
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

  // Um ou vários arquivos (25/09/2026). O tipo e o caso valem para todos.
  const brutos = dados.getAll('arquivo')
  const arquivos = brutos.filter((item): item is File => item instanceof File)

  const conferidoArquivos = validarArquivos(arquivos)
  if (!conferidoArquivos.ok) return { erros: { arquivo: conferidoArquivos.mensagem } }

  const emailDoAutor = await emailDaSessao(sessao)
  const anexados: string[] = []

  for (const item of conferidoArquivos.dados) {
    const resultado = await anexarDocumento(
      sessao,
      clienteId,
      conferido.dados,
      {
        nome: item.nome,
        tipoConteudo: item.tipoConteudo,
        conteudo: new Uint8Array(await item.arquivo.arrayBuffer()),
      },
      emailDoAutor,
    )

    if (resultado.situacao === 'cliente_nao_encontrado') {
      return { mensagem: 'Cliente não encontrado.' }
    }

    if (resultado.situacao === 'caso_invalido') {
      return { erros: { casoId: 'Escolha um caso deste cliente.' } }
    }

    anexados.push(item.nome)
  }

  revalidatePath(`/painel/clientes/${clienteId}`)
  redirect(`/painel/clientes/${clienteId}`)
}
