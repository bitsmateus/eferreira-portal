'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { TipoPessoa } from '@prisma/client'

import {
  registrarAssinatura,
  revogarAcesso,
  validarAssinatura,
} from '@/lib/assinatura'
import {
  atualizarCliente,
  criarCliente,
  criarClienteComRepresentante,
  excluirCliente,
  reconhecerPorDocumento,
  validarCliente,
  validarRepresentante,
  type CamposDeCliente,
  type CamposDoRepresentante,
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

function lerCamposDoRepresentante(dados: FormData): CamposDoRepresentante {
  return {
    representanteDocumento: texto(dados, 'representanteDocumento'),
    representanteNome: texto(dados, 'representanteNome'),
    representanteRg: texto(dados, 'representanteRg'),
    representanteEstadoCivil: texto(dados, 'representanteEstadoCivil'),
    representanteProfissao: texto(dados, 'representanteProfissao'),
    representanteNacionalidade: texto(dados, 'representanteNacionalidade'),
    representanteNomeMae: texto(dados, 'representanteNomeMae'),
    representanteEmail: texto(dados, 'representanteEmail'),
    representanteTelefone: texto(dados, 'representanteTelefone'),
    representanteQualificacao: texto(dados, 'representanteQualificacao'),
  }
}

export async function cadastrarCliente(
  _estado: EstadoDoCliente,
  dados: FormData,
): Promise<EstadoDoCliente> {
  const sessao = await exigirSessaoDaEquipe()

  const conferido = validarCliente(lerCampos(dados))
  if (!conferido.ok) return { erros: conferido.erros }

  // Pessoa jurídica não nasce sem representante legal — decisão de
  // 17/09/2026. As duas validações rodam antes de qualquer gravação: a
  // pessoa vê tudo o que falta de uma vez, em vez de descobrir aos poucos.
  if (conferido.dados.tipoPessoa === TipoPessoa.JURIDICA) {
    const representante = validarRepresentante(lerCamposDoRepresentante(dados))
    if (!representante.ok) return { erros: representante.erros }

    const resultado = await criarClienteComRepresentante(
      sessao,
      conferido.dados,
      representante.dados,
      await emailDaSessao(sessao),
    )

    if (resultado.situacao === 'ja_existe') {
      return {
        duplicado: { id: resultado.clienteId, nome: resultado.nome },
        mensagem:
          'Este CPF/CNPJ já está cadastrado. Abra a ficha existente em vez de criar um segundo registro.',
      }
    }

    if (resultado.situacao === 'representante_e_pessoa_juridica') {
      return {
        erros: {
          representanteDocumento: `Este CPF pertence a ${resultado.nome}, cadastrado como pessoa jurídica — o representante legal precisa ser uma pessoa física.`,
        },
      }
    }

    revalidatePath('/painel/clientes')
    redirect(`/painel/clientes/${resultado.clienteId}`)
  }

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

export type EstadoDaExclusao =
  | { situacao: 'erro'; mensagem: string }
  /** Tem rastro: a tela decide se mostra o popup de exclusão forçada. */
  | {
      situacao: 'tem_historico'
      documentos: number
      andamentos: number
      contratoAssinado: boolean
    }
  | undefined

/**
 * Apaga um cliente.
 *
 * A confirmação viaja no corpo do formulário e é exigida aqui, não só na
 * tela: um POST solto nesta ação não pode apagar cadastro de ninguém. É o
 * mesmo cuidado da revogação de acesso e do envio para assinatura.
 *
 * `confirmacao: 'excluir-tudo'` é a exclusão forçada — apaga cliente com
 * documento, andamento ou contrato assinado, e com eles o histórico do
 * processo. Só chega a `excluirCliente` com `forcar: true`, que por sua vez
 * só aceita de quem é ADMINISTRADOR (a tela também exige digitar o nome do
 * cliente antes de mostrar este botão).
 */
export async function excluirClienteDaLista(
  clienteId: string,
  _estado: EstadoDaExclusao,
  dados: FormData,
): Promise<EstadoDaExclusao> {
  const sessao = await exigirSessaoDaEquipe()

  const confirmacao = texto(dados, 'confirmacao')
  if (confirmacao !== 'excluir' && confirmacao !== 'excluir-tudo') {
    return { situacao: 'erro', mensagem: 'Exclusão não confirmada.' }
  }

  const resultado = await excluirCliente(
    sessao,
    clienteId,
    await emailDaSessao(sessao),
    { forcar: confirmacao === 'excluir-tudo' },
  )

  if (resultado.situacao === 'nao_encontrado') {
    return { situacao: 'erro', mensagem: 'Cliente não encontrado.' }
  }

  if (resultado.situacao === 'tem_historico') {
    return {
      situacao: 'tem_historico',
      documentos: resultado.documentos,
      andamentos: resultado.andamentos,
      contratoAssinado: resultado.contratoAssinado,
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
