/**
 * Geração de documento — Anexo I, passo 3.
 *
 * Junta as peças: autoriza, busca os dados, preenche o modelo do escritório,
 * transforma em PDF e arquiva na pasta do cliente.
 *
 * O documento gerado é um `Documento` como outro qualquer: sai pela mesma
 * porta autorizada, com a mesma chave opaca e a mesma auditoria (regras 5 e
 * 6). Não existe atalho de download direto.
 *
 * A assinatura eletrônica é a etapa seguinte e depende do token do D4Sign,
 * que o escritório ainda não enviou.
 */

import { AcaoAuditoria, TipoDocumento, TipoPessoa } from '@prisma/client'

import {
  exigirEquipe,
  filtroDeCasos,
  filtroDeClientes,
  type SessaoServidor,
} from '@/lib/autorizacao'
import { prisma } from '@/lib/prisma'
import { registrarAuditoria } from '@/lib/auditoria'
import { enviarArquivo, gerarChaveDeArquivo, removerArquivo } from '@/lib/armazenamento'
import { ROTULO_DO_TIPO } from '@/lib/arquivos'
import {
  MODELO_DO_TIPO,
  preencherModelo,
  valoresDoDocumento,
  type ClienteParaDocumento,
} from '@/lib/modelos'
import { estiloDosDocumentos, gerarPdf, lerModelo, montarPagina } from '@/lib/pdf'
import { formatarDocumento } from '@/lib/documento'

/** Tipos que o sistema sabe gerar. Anexo entra por upload, não por geração. */
export const TIPOS_GERAVEIS = [
  TipoDocumento.CONTRATO,
  TipoDocumento.PROCURACAO,
  TipoDocumento.DECLARACAO,
] as const

export type TipoGeravel = (typeof TIPOS_GERAVEIS)[number]

export function ehTipoGeravel(tipo: string): tipo is TipoGeravel {
  return (TIPOS_GERAVEIS as readonly string[]).includes(tipo)
}

/** Só o contrato depende do caso; procuração e declaração são do cliente. */
export function exigeCaso(tipo: TipoGeravel): boolean {
  return tipo === TipoDocumento.CONTRATO
}

export type ResultadoDaPrevia =
  | { situacao: 'pronto'; html: string; titulo: string }
  | { situacao: 'nao_encontrado' }
  | { situacao: 'caso_obrigatorio' }
  /** O cadastro está incompleto: a lista diz exatamente o que falta. */
  | { situacao: 'faltam_dados'; faltando: string[]; ondePreencher: string }

/**
 * Monta o documento preenchido, sem gravar nada. É o que a tela de prévia usa
 * e o que a geração reaproveita — assim não há como a prévia mostrar uma coisa
 * e o PDF sair outra.
 */
export async function montarPrevia(
  sessao: SessaoServidor,
  clienteId: string,
  tipo: TipoGeravel,
  casoId: string | null,
): Promise<ResultadoDaPrevia> {
  exigirEquipe(sessao)

  const cliente = await prisma.cliente.findFirst({
    where: filtroDeClientes(sessao, { id: clienteId }),
    include: {
      representantes: {
        orderBy: { criadoEm: 'asc' },
        include: { pessoaFisica: true },
      },
    },
  })
  if (cliente === null) return { situacao: 'nao_encontrado' }

  if (exigeCaso(tipo) && casoId === null) return { situacao: 'caso_obrigatorio' }

  const caso =
    casoId === null
      ? null
      : await prisma.caso.findFirst({
          where: filtroDeCasos(sessao, { id: casoId, clienteId: cliente.id }),
          include: { parcelas: { orderBy: { numero: 'asc' } } },
        })

  if (casoId !== null && caso === null) return { situacao: 'nao_encontrado' }

  // Empresa não assina sozinha: quem assina é o representante legal, e é a
  // qualificação DELE que entra no documento. O nome e o CPF que aparecem
  // continuam sendo os da empresa.
  const representante = cliente.representantes[0]?.pessoaFisica ?? null

  if (cliente.tipoPessoa === TipoPessoa.JURIDICA && representante === null) {
    return {
      situacao: 'faltam_dados',
      faltando: ['representante legal da empresa'],
      ondePreencher: `/painel/clientes/${cliente.id}`,
    }
  }

  const paraDocumento: ClienteParaDocumento =
    representante === null
      ? cliente
      : {
          ...cliente,
          // Da empresa: nome e CNPJ. Do sócio: a qualificação pessoal.
          nacionalidade: representante.nacionalidade,
          estadoCivil: representante.estadoCivil,
          nomeMae: representante.nomeMae,
          rg: representante.rg,
        }

  const preenchido = preencherModelo(
    await lerModelo(MODELO_DO_TIPO[tipo] ?? ''),
    valoresDoDocumento(paraDocumento, caso, new Date()),
  )

  if (!preenchido.ok) {
    return {
      situacao: 'faltam_dados',
      faltando: preenchido.faltando,
      ondePreencher:
        representante === null
          ? `/painel/clientes/${cliente.id}/editar`
          : `/painel/clientes/${representante.id}/editar`,
    }
  }

  return {
    situacao: 'pronto',
    html: preenchido.html,
    titulo: `${ROTULO_DO_TIPO[tipo]} — ${cliente.nome}`,
  }
}

export type ResultadoDaGeracao =
  | { situacao: 'gerado'; documentoId: string }
  | { situacao: 'nao_encontrado' }
  | { situacao: 'caso_obrigatorio' }
  | { situacao: 'faltam_dados'; faltando: string[]; ondePreencher: string }

export async function gerarDocumento(
  sessao: SessaoServidor,
  clienteId: string,
  tipo: TipoGeravel,
  casoId: string | null,
  emailDoAutor: string | null,
): Promise<ResultadoDaGeracao> {
  const previa = await montarPrevia(sessao, clienteId, tipo, casoId)

  if (previa.situacao !== 'pronto') return previa

  const paginaHtml = montarPagina(
    previa.html,
    await estiloDosDocumentos(),
    previa.titulo,
  )
  const pdf = await gerarPdf(paginaHtml)

  const cliente = await prisma.cliente.findFirst({
    where: filtroDeClientes(sessao, { id: clienteId }),
    select: { id: true, documento: true },
  })
  if (cliente === null) return { situacao: 'nao_encontrado' }

  const nome = `${ROTULO_DO_TIPO[tipo]} - ${formatarDocumento(cliente.documento)}.pdf`
  const chave = gerarChaveDeArquivo()
  await enviarArquivo(chave, pdf, 'application/pdf')

  try {
    const documentoId = await prisma.$transaction(async (transacao) => {
      const criado = await transacao.documento.create({
        data: {
          clienteId: cliente.id,
          casoId,
          tipo,
          nome,
          chaveArquivo: chave,
          tipoConteudo: 'application/pdf',
          tamanhoBytes: pdf.byteLength,
          enviadoPorId: sessao.usuarioId,
        },
        select: { id: true },
      })

      await registrarAuditoria(
        {
          usuarioId: sessao.usuarioId,
          usuarioEmail: emailDoAutor,
          acao: AcaoAuditoria.CRIACAO,
          entidade: 'documento',
          entidadeId: criado.id,
          detalhes: { origem: 'gerado', tipo, clienteId: cliente.id, casoId },
        },
        transacao,
      )

      return criado.id
    })

    return { situacao: 'gerado', documentoId }
  } catch (erro) {
    await removerArquivo(chave).catch(() => undefined)
    throw erro
  }
}
