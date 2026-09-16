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
 * Gerar NÃO envia para assinatura. São dois passos, de propósito: o envio
 * gasta um crédito do escritório e manda e-mail de verdade, e isso não se
 * desfaz. Ver `src/lib/assinaturas.ts` e `docs/assinatura-eletronica.md`.
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
  aplicarPartes,
  preencherModelo,
  valoresDoDocumento,
  type ClienteParaDocumento,
} from '@/lib/modelos'
import { gerarPdf, lerModelo, montarPaginaTimbrada } from '@/lib/pdf'
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
 * Lê o modelo e encaixa as partes que mudam com o tipo de pessoa.
 *
 * Só a procuração tem variantes hoje: o escritório confirmou em 14/09/2026 que
 * "ela pode ser PJ ou PF dependendo do tipo de cliente do contrato". O contrato
 * e a declaração continuam com um texto só.
 */
async function montarModelo(
  tipo: TipoGeravel,
  tipoPessoa: TipoPessoa,
): Promise<string> {
  const modelo = await lerModelo(MODELO_DO_TIPO[tipo] ?? '')

  if (tipo !== TipoDocumento.PROCURACAO) return modelo

  const sufixo = tipoPessoa === TipoPessoa.FISICA ? 'pf' : 'pj'
  const [outorgante, assinatura] = await Promise.all([
    lerModelo(`procuracao-outorgante-${sufixo}`),
    lerModelo(`procuracao-assinatura-${sufixo}`),
  ])

  return aplicarPartes(modelo, { outorgante, assinatura })
}

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

  // Empresa não assina sozinha: quem assina é o representante legal.
  const vinculo = cliente.representantes[0] ?? null
  const representante = vinculo?.pessoaFisica ?? null

  if (cliente.tipoPessoa === TipoPessoa.JURIDICA && representante === null) {
    return {
      situacao: 'faltam_dados',
      faltando: ['representante legal da empresa'],
      ondePreencher: `/painel/clientes/${cliente.id}`,
    }
  }

  // O contrato e a declaração ainda usam os modelos antigos, em que a
  // qualificação pessoal do sócio ocupa o lugar da da empresa. A procuração
  // nova não funde mais os dois — ver `procuracao-outorgante-pj.html`.
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
    await montarModelo(tipo, cliente.tipoPessoa),
    valoresDoDocumento(
      paraDocumento,
      representante === null
        ? null
        : {
            nome: representante.nome,
            documento: representante.documento,
            nacionalidade: representante.nacionalidade,
            rg: representante.rg,
            qualificacao: vinculo?.qualificacao ?? null,
          },
      caso,
      new Date(),
    ),
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

  const { html, timbre } = await montarPaginaTimbrada(previa.html, previa.titulo)
  const pdf = await gerarPdf(html, timbre)

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
