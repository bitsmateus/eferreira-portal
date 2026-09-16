'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  registrarAssinatura,
  revogarAcesso,
  validarAssinatura,
} from '@/lib/assinatura'
import {
  atualizarCliente,
  criarCliente,
  excluirCliente,
  reconhecerPorDocumento,
  validarCliente,
  type CamposDeCliente,
} from '@/lib/clientes'
import { buscarEnderecoPorCep, type EnderecoDoCep } from '@/lib/cep'
import { texto, type ErrosDeCampo } from '@/lib/formulario'
import { emailDaSessao, exigirSessaoDaEquipe } from '@/lib/sessao'

/**
 * O que o formulário recebe de volta. `duplicado` é o reconhecimento do
 * passo 2: em vez de cadastrar de novo, mostramos quem já existe.
 */
export type EstadoDoCliente =
  | {
      erros?: ErrosDeCampo
      mensagem?: string
      duplicado?: { id: string; nome: string }
    }
  | undefined

function lerCampos(dados: FormData): CamposDeCliente {
  return {
    documento: texto(dados, 'documento'),
    nome: texto(dados, 'nome'),
    rg: texto(dados, 'rg'),
    dataNascimento: texto(dados, 'dataNascimento'),
    estadoCivil: texto(dados, 'estadoCivil'),
    profissao: texto(dados, 'profissao'),
    nacionalidade: texto(dados, 'nacionalidade'),
    nomeMae: texto(dados, 'nomeMae'),
    email: texto(dados, 'email'),
    telefone: texto(dados, 'telefone'),
    cep: texto(dados, 'cep'),
    endereco: texto(dados, 'endereco'),
    cidade: texto(dados, 'cidade'),
    uf: texto(dados, 'uf'),
  }
}

export async function cadastrarCliente(
  _estado: EstadoDoCliente,
  dados: FormData,
): Promise<EstadoDoCliente> {
  const sessao = await exigirSessaoDaEquipe()

  const conferido = validarCliente(lerCampos(dados))
  if (!conferido.ok) return { erros: conferido.erros }

  const resultado = await criarCliente(
    sessao,
    conferido.dados,
    await emailDaSessao(sessao),
  )

  if (resultado.situacao === 'ja_existe') {
    return {
      duplicado: { id: resultado.clienteId, nome: resultado.nome },
      mensagem:
        'Este CPF/CNPJ já está cadastrado. Abra a ficha existente em vez de criar um segundo registro.',
    }
  }

  revalidatePath('/painel/clientes')
  redirect(`/painel/clientes/${resultado.clienteId}`)
}

export async function salvarEdicaoDeCliente(
  id: string,
  _estado: EstadoDoCliente,
  dados: FormData,
): Promise<EstadoDoCliente> {
  const sessao = await exigirSessaoDaEquipe()

  const conferido = validarCliente(lerCampos(dados))
  if (!conferido.ok) return { erros: conferido.erros }

  const resultado = await atualizarCliente(
    sessao,
    id,
    conferido.dados,
    await emailDaSessao(sessao),
  )

  if (resultado.situacao === 'nao_encontrado') {
    return { mensagem: 'Cliente não encontrado.' }
  }

  if (resultado.situacao === 'documento_de_outro') {
    return {
      erros: {
        documento: `Este CPF/CNPJ já pertence a ${resultado.nome}.`,
      },
    }
  }

  revalidatePath('/painel/clientes')
  revalidatePath(`/painel/clientes/${id}`)
  redirect(`/painel/clientes/${id}`)
}

/**
 * Reconhecimento enquanto se digita: diz se o CPF/CNPJ já tem cliente.
 * Só a equipe consulta — e a consulta passa pelo filtro da sessão.
 */
export async function conferirDocumento(valor: string): Promise<{
  encontrado: boolean
  id?: string
  nome?: string
  quantidadeDeCasos?: number
}> {
  const sessao = await exigirSessaoDaEquipe()

  const cliente = await reconhecerPorDocumento(sessao, valor)
  if (cliente === null) return { encontrado: false }

  return {
    encontrado: true,
    id: cliente.id,
    nome: cliente.nome,
    quantidadeDeCasos: cliente.quantidadeDeCasos,
  }
}

export type EstadoDaExclusao = { erro?: string } | undefined

/**
 * Apaga um cliente que ainda não deixou rastro.
 *
 * A confirmação viaja no corpo do formulário e é exigida aqui, não só na
 * tela: um POST solto nesta ação não pode apagar cadastro de ninguém. É o
 * mesmo cuidado da revogação de acesso e do envio para assinatura.
 */
export async function excluirClienteDaLista(
  clienteId: string,
  _estado: EstadoDaExclusao,
  dados: FormData,
): Promise<EstadoDaExclusao> {
  const sessao = await exigirSessaoDaEquipe()

  if (texto(dados, 'confirmacao') !== 'excluir') {
    return { erro: 'Exclusão não confirmada.' }
  }

  const resultado = await excluirCliente(
    sessao,
    clienteId,
    await emailDaSessao(sessao),
  )

  if (resultado.situacao === 'nao_encontrado') {
    return { erro: 'Cliente não encontrado.' }
  }

  if (resultado.situacao === 'tem_historico') {
    const partes: string[] = []
    if (resultado.documentos > 0) {
      partes.push(
        resultado.documentos === 1
          ? '1 documento na pasta'
          : `${resultado.documentos} documentos na pasta`,
      )
    }
    if (resultado.andamentos > 0) {
      partes.push(
        resultado.andamentos === 1
          ? '1 andamento lançado'
          : `${resultado.andamentos} andamentos lançados`,
      )
    }
    if (resultado.contratoAssinado) partes.push('contrato assinado')

    return {
      erro:
        `Este cliente não pode ser excluído porque já tem ${partes.join(', ')}. ` +
        'Apagar isso destruiria documento e histórico de processo. Se o cadastro ' +
        'está errado, corrija pela edição.',
    }
  }

  revalidatePath('/painel/clientes')
  revalidatePath('/painel/casos')
  redirect('/painel/clientes')
}

/**
 * Endereço a partir do CEP, para poupar digitação no cadastro.
 *
 * Passa pelo servidor, e não direto do navegador, por dois motivos: a tela
 * não precisa saber qual serviço de CEP é usado, e trocar de fornecedor fica
 * sendo mudança em um arquivo só. Exige sessão da equipe como qualquer outra
 * ação do painel — não é porta aberta para consultar CEP de graça pelo nosso
 * servidor.
 *
 * Devolve null em qualquer falha: cadastrar não pode depender disto.
 */
export async function consultarCep(cep: string): Promise<EnderecoDoCep | null> {
  await exigirSessaoDaEquipe()
  return buscarEnderecoPorCep(cep)
}

// ---------------------------------------------------------------------------
// O gatilho do Anexo I, 1.d
// ---------------------------------------------------------------------------

export type EstadoDaAssinatura = { erro?: string } | undefined

/**
 * Registra a assinatura do contrato — é esta ação que libera o acesso do
 * cliente. Enquanto o token de API do D4Sign não chega (dependência 3.3), é
 * o operador quem informa a data que consta no documento assinado.
 */
export async function registrarAssinaturaDoContrato(
  clienteId: string,
  _estado: EstadoDaAssinatura,
  dados: FormData,
): Promise<EstadoDaAssinatura> {
  const sessao = await exigirSessaoDaEquipe()

  const conferido = validarAssinatura({ assinadoEm: texto(dados, 'assinadoEm') })
  if (!conferido.ok) {
    return { erro: conferido.erros['assinadoEm'] ?? 'Data inválida.' }
  }

  const resultado = await registrarAssinatura(
    sessao,
    clienteId,
    conferido.dados,
    await emailDaSessao(sessao),
  )

  if (resultado.situacao === 'cliente_nao_encontrado') {
    return { erro: 'Cliente não encontrado.' }
  }

  if (resultado.situacao === 'sem_email') {
    return {
      erro:
        'Este cadastro não tem e-mail, e é por e-mail que o código de acesso ' +
        'chega. Preencha o e-mail antes de registrar a assinatura.',
    }
  }

  revalidatePath('/painel/clientes')
  revalidatePath(`/painel/clientes/${clienteId}`)
  return undefined
}

/** Desfaz o gatilho: o cliente deixa de entrar, na hora. */
export async function revogarAcessoDoCliente(
  clienteId: string,
  _estado: EstadoDaAssinatura,
  dados: FormData,
): Promise<EstadoDaAssinatura> {
  const sessao = await exigirSessaoDaEquipe()

  // A tela pede confirmação antes de mostrar este botão; o campo abaixo é a
  // confirmação viajando junto. Cortar um acesso por clique perdido seria
  // deixar um cliente sem consulta sem ninguém perceber.
  if (texto(dados, 'confirmacao') !== 'revogar') {
    return { erro: 'Revogação não confirmada.' }
  }

  const resultado = await revogarAcesso(
    sessao,
    clienteId,
    await emailDaSessao(sessao),
  )

  if (resultado.situacao === 'cliente_nao_encontrado') {
    return { erro: 'Cliente não encontrado.' }
  }

  revalidatePath('/painel/clientes')
  revalidatePath(`/painel/clientes/${clienteId}`)
  return undefined
}
