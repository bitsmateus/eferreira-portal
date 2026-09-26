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

import { AcaoAuditoria, OrigemDoDocumento, TipoDocumento, TipoPessoa } from '@prisma/client'

import {
  exigirEquipe,
  filtroDeCasos,
  filtroDeClientes,
  type SessaoServidor,
} from '@/lib/autorizacao'
import { obterAdvogadoParaDocumento } from '@/lib/advogados'
import { prisma } from '@/lib/prisma'
import { registrarAuditoria } from '@/lib/auditoria'
import { enviarArquivo, gerarChaveDeArquivo, removerArquivo } from '@/lib/armazenamento'
import { ROTULO_DO_TIPO } from '@/lib/arquivos'
import {
  ROTULOS_DO_CASO,
  ROTULOS_DO_REPRESENTANTE,
  montarModelo,
  varianteDoDocumento,
  lacunasDoContrato,
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
  | { situacao: 'pronto'; html: string; titulo: string; advogadoId: string }
  | { situacao: 'nao_encontrado' }
  | { situacao: 'caso_obrigatorio' }
  /** O cadastro está incompleto: a lista diz exatamente o que falta. */
  | { situacao: 'faltam_dados'; faltando: string[]; ondePreencher: string }
  /** O escritório não tem modelo para este documento neste tipo de cliente. */
  | { situacao: 'nao_se_aplica'; motivo: string }

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
  advogadoId: string | null = null,
): Promise<ResultadoDaPrevia> {
  exigirEquipe(sessao)

  // Vale só para a procuração, mas um id que não existe é recusado sempre:
  // o navegador não inventa quem assina como outorgado.
  const advogado = await obterAdvogadoParaDocumento(advogadoId)
  if (advogado === undefined) return { situacao: 'nao_encontrado' }

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

  // O contrato só existe com o tipo de objeto escolhido e ao menos uma
  // modalidade de honorários marcada — não há texto para "nenhuma". O que
  // falta DENTRO de uma modalidade (o percentual, o prazo, os campos do
  // personalizado) é dito pelos marcadores, mais abaixo.
  if (tipo === TipoDocumento.CONTRATO && caso !== null) {
    const lacunas = lacunasDoContrato(caso)
    if (lacunas.length > 0) {
      return {
        situacao: 'faltam_dados',
        faltando: lacunas,
        ondePreencher: `/painel/casos/${caso.id}/editar`,
      }
    }
  }

  // Empresa não assina sozinha: quem assina é o representante legal. Numa
  // pessoa física, o mesmo vínculo é o do ASSISTENTE (responsável por menor ou
  // incapaz) — os três documentos têm modelo "representada/assistida".
  const vinculo = cliente.representantes[0] ?? null
  const representante = vinculo?.pessoaFisica ?? null
  const ehEmpresa = cliente.tipoPessoa === TipoPessoa.JURIDICA
  const comResponsavel = !ehEmpresa && representante !== null
  const quemRepresenta = representante

  // Só existe modelo de declaração de hipossuficiência para pessoa física.
  if (tipo === TipoDocumento.DECLARACAO && ehEmpresa) {
    return {
      situacao: 'nao_se_aplica',
      motivo:
        'A declaração de hipossuficiência só tem modelo para pessoa física. Empresa não gera esta declaração.',
    }
  }

  if (cliente.tipoPessoa === TipoPessoa.JURIDICA && representante === null) {
    return {
      situacao: 'faltam_dados',
      faltando: ['representante legal da empresa'],
      ondePreencher: `/painel/clientes/${cliente.id}`,
    }
  }

  // Desde 24/09/2026 os três documentos separam a empresa (ou o assistido) do
  // representante: cada um entra com os seus dados, sem fundir um no outro.
  const paraDocumento: ClienteParaDocumento = cliente

  const preenchido = preencherModelo(
    await montarModelo(lerModelo, tipo, varianteDoDocumento(cliente.tipoPessoa, comResponsavel), caso),
    valoresDoDocumento(
      paraDocumento,
      quemRepresenta === null
        ? null
        : {
            nome: quemRepresenta.nome,
            documento: quemRepresenta.documento,
            nacionalidade: quemRepresenta.nacionalidade,
            rg: quemRepresenta.rg,
            qualificacao: vinculo?.qualificacao ?? null,
            estadoCivil: quemRepresenta.estadoCivil,
            profissao: quemRepresenta.profissao,
            email: quemRepresenta.email,
            telefone: quemRepresenta.telefone,
            nomeMae: quemRepresenta.nomeMae,
            endereco: quemRepresenta.endereco,
            cidade: quemRepresenta.cidade,
            uf: quemRepresenta.uf,
            cep: quemRepresenta.cep,
          },
      caso,
      new Date(),
      advogado,
    ),
  )

  if (!preenchido.ok) {
    // Só o caso resolve, quando tudo o que falta é dado dele — a mensagem
    // leva para a edição do caso, e não para o cadastro do cliente.
    const soFaltaDoCaso =
      caso !== null && preenchido.faltando.every((rotulo) => ROTULOS_DO_CASO.has(rotulo))

    return {
      situacao: 'faltam_dados',
      faltando: preenchido.faltando,
      ondePreencher: soFaltaDoCaso
        ? `/painel/casos/${caso.id}/editar`
        : quemRepresenta !== null &&
            preenchido.faltando.every((rotulo) => ROTULOS_DO_REPRESENTANTE.has(rotulo))
          ? `/painel/clientes/${quemRepresenta.id}/editar`
          : `/painel/clientes/${cliente.id}/editar`,
    }
  }

  return {
    situacao: 'pronto',
    html: preenchido.html,
    titulo: `${ROTULO_DO_TIPO[tipo]} — ${cliente.nome}`,
    advogadoId: advogado.id,
  }
}

export type ResultadoDaGeracao =
  | { situacao: 'gerado'; documentoId: string }
  | { situacao: 'nao_encontrado' }
  | { situacao: 'caso_obrigatorio' }
  | { situacao: 'faltam_dados'; faltando: string[]; ondePreencher: string }
  | { situacao: 'nao_se_aplica'; motivo: string }

export async function gerarDocumento(
  sessao: SessaoServidor,
  clienteId: string,
  tipo: TipoGeravel,
  casoId: string | null,
  emailDoAutor: string | null,
  advogadoId: string | null = null,
): Promise<ResultadoDaGeracao> {
  const previa = await montarPrevia(sessao, clienteId, tipo, casoId, advogadoId)

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
          origem: OrigemDoDocumento.GERADO,
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
          detalhes: {
            origem: 'gerado',
            tipo,
            clienteId: cliente.id,
            casoId,
            ...(tipo === TipoDocumento.PROCURACAO
              ? { outorgado: previa.advogadoId }
              : {}),
          },
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
