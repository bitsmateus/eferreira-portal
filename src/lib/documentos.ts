/**
 * Pasta única do cliente — Anexo I, item 4.a.
 *
 * Todos os arquivos de um cliente reunidos em um lugar só: contrato,
 * procuração, declaração e os documentos de cada caso dele.
 *
 * Regra 5: nenhum arquivo é público. A URL de leitura só é assinada **depois**
 * de `filtroDeDocumentos` confirmar que esta sessão pode ver este documento.
 * Regra 6: envio e leitura ficam registrados, com autor identificado — quem
 * anexou o quê, e quem baixou o quê.
 */

import { AcaoAuditoria, type Prisma, TipoDocumento } from '@prisma/client'
import { z } from 'zod'

import {
  exigirEquipe,
  filtroDeClientes,
  filtroDeDocumentos,
  type SessaoServidor,
} from '@/lib/autorizacao'
import { prisma } from '@/lib/prisma'
import { registrarAuditoria } from '@/lib/auditoria'
import {
  enviarArquivo,
  gerarChaveDeArquivo,
  removerArquivo,
  urlTemporariaDeLeitura,
} from '@/lib/armazenamento'
import { errosPorCampo, type ResultadoDeFormulario } from '@/lib/formulario'
import {
  EXTENSOES_ACEITAS,
  TAMANHO_MAXIMO_BYTES,
  TIPOS_ACEITOS,
} from '@/lib/arquivos'

// ---------------------------------------------------------------------------
// Validação do formulário de anexo
// ---------------------------------------------------------------------------

export const esquemaDeAnexo = z.object({
  tipo: z.nativeEnum(TipoDocumento, {
    errorMap: () => ({ message: 'Tipo de documento inválido.' }),
  }),
  /** Vazio = documento do cliente, não de um caso específico. */
  casoId: z
    .string()
    .trim()
    .transform((valor) => (valor === '' ? null : valor)),
})

export type DadosDeAnexo = z.output<typeof esquemaDeAnexo>
export type CamposDeAnexo = Record<keyof z.input<typeof esquemaDeAnexo>, string>

export function validarAnexo(campos: CamposDeAnexo): ResultadoDeFormulario<DadosDeAnexo> {
  const conferido = esquemaDeAnexo.safeParse(campos)
  if (!conferido.success) {
    return { ok: false, erros: errosPorCampo(conferido.error) }
  }
  return { ok: true, dados: conferido.data }
}

/**
 * Confere o arquivo em si: presença, tamanho e tipo.
 *
 * O tipo declarado pelo navegador não é prova de nada, mas é a primeira
 * peneira; a lista fechada evita que qualquer coisa entre no balde.
 */
export function validarArquivo(
  arquivo: File | null,
): ResultadoDeFormulario<{ nome: string; tipoConteudo: string; tamanho: number }> {
  if (arquivo === null || arquivo.size === 0) {
    return { ok: false, erros: { arquivo: 'Escolha um arquivo para anexar.' } }
  }

  if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
    return {
      ok: false,
      erros: {
        arquivo: `Arquivo grande demais. O limite é ${Math.floor(
          TAMANHO_MAXIMO_BYTES / (1024 * 1024),
        )} MB.`,
      },
    }
  }

  const tipoConteudo = arquivo.type
  if (TIPOS_ACEITOS[tipoConteudo] === undefined) {
    return {
      ok: false,
      erros: {
        arquivo: `Tipo de arquivo não aceito. Aceitos: ${EXTENSOES_ACEITAS.join(', ')}.`,
      },
    }
  }

  const nome = arquivo.name.trim()
  return {
    ok: true,
    dados: {
      nome: nome === '' ? `documento.${TIPOS_ACEITOS[tipoConteudo]}` : nome,
      tipoConteudo,
      tamanho: arquivo.size,
    },
  }
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

const RESUMO = {
  id: true,
  tipo: true,
  nome: true,
  tipoConteudo: true,
  tamanhoBytes: true,
  assinadoEm: true,
  criadoEm: true,
  casoId: true,
  caso: { select: { id: true, numeroProcesso: true, assunto: true } },
  enviadoPor: { select: { nome: true } },
} satisfies Prisma.DocumentoSelect

export type LinhaDeDocumento = Prisma.DocumentoGetPayload<{ select: typeof RESUMO }>

/**
 * A pasta única: tudo do cliente, inclusive o que está preso a um caso dele.
 * O filtro da sessão entra sempre — o `clienteId` da URL só estreita.
 */
export async function listarPastaDoCliente(
  sessao: SessaoServidor,
  clienteId: string,
): Promise<LinhaDeDocumento[]> {
  return prisma.documento.findMany({
    where: filtroDeDocumentos(sessao, { clienteId }),
    select: RESUMO,
    orderBy: { criadoEm: 'desc' },
  })
}

/** Os documentos de um caso específico, dentro da pasta do cliente. */
export async function listarDocumentosDoCaso(
  sessao: SessaoServidor,
  casoId: string,
): Promise<LinhaDeDocumento[]> {
  return prisma.documento.findMany({
    where: filtroDeDocumentos(sessao, { casoId }),
    select: RESUMO,
    orderBy: { criadoEm: 'desc' },
  })
}

// ---------------------------------------------------------------------------
// Escrita
// ---------------------------------------------------------------------------

export type ResultadoDeAnexo =
  | { situacao: 'anexado'; documentoId: string }
  | { situacao: 'cliente_nao_encontrado' }
  /** O caso escolhido não existe ou não é deste cliente. */
  | { situacao: 'caso_invalido' }

export async function anexarDocumento(
  sessao: SessaoServidor,
  clienteId: string,
  dados: DadosDeAnexo,
  arquivo: { nome: string; tipoConteudo: string; conteudo: Uint8Array },
  emailDoAutor: string | null,
): Promise<ResultadoDeAnexo> {
  exigirEquipe(sessao)

  // Regra 2: o vínculo só vale se ESTA sessão enxerga ESTE cliente.
  const cliente = await prisma.cliente.findFirst({
    where: filtroDeClientes(sessao, { id: clienteId }),
    select: { id: true },
  })
  if (cliente === null) return { situacao: 'cliente_nao_encontrado' }

  // Um caso de outro cliente no corpo do formulário não pode virar vínculo.
  if (dados.casoId !== null) {
    const caso = await prisma.caso.findFirst({
      where: { id: dados.casoId, clienteId: cliente.id },
      select: { id: true },
    })
    if (caso === null) return { situacao: 'caso_invalido' }
  }

  const chave = gerarChaveDeArquivo()
  await enviarArquivo(chave, arquivo.conteudo, arquivo.tipoConteudo)

  try {
    const documentoId = await prisma.$transaction(async (transacao) => {
      const criado = await transacao.documento.create({
        data: {
          clienteId: cliente.id,
          casoId: dados.casoId,
          tipo: dados.tipo,
          nome: arquivo.nome,
          chaveArquivo: chave,
          tipoConteudo: arquivo.tipoConteudo,
          tamanhoBytes: arquivo.conteudo.byteLength,
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
            clienteId: cliente.id,
            casoId: dados.casoId,
            tipo: dados.tipo,
            nome: arquivo.nome,
          },
        },
        transacao,
      )

      return criado.id
    })

    return { situacao: 'anexado', documentoId }
  } catch (erro) {
    // O arquivo já subiu, mas o registro falhou. Sem isto ficaria um objeto
    // órfão no balde, sem dono e sem auditoria.
    await removerArquivo(chave).catch(() => undefined)
    throw erro
  }
}

// ---------------------------------------------------------------------------
// Entrega do arquivo
// ---------------------------------------------------------------------------

/**
 * Autoriza e devolve a URL temporária. É a única porta de saída de arquivo do
 * sistema: primeiro a consulta passa pelo filtro da sessão, e só o documento
 * que sobreviver a ele ganha uma URL assinada.
 *
 * O acesso é registrado (regra 6): documento de processo baixado sem registro
 * de quem baixou não serve como prova de diligência nem como trilha de LGPD.
 */
export async function urlDeLeituraAutorizada(
  sessao: SessaoServidor,
  documentoId: string,
  comoAnexo: boolean,
  emailDoAutor: string | null,
  origem?: { enderecoIp?: string | null; agenteUsuario?: string | null },
): Promise<string | null> {
  const documento = await prisma.documento.findFirst({
    where: filtroDeDocumentos(sessao, { id: documentoId }),
    select: { id: true, chaveArquivo: true, nome: true, clienteId: true },
  })

  if (documento === null) return null

  await registrarAuditoria({
    usuarioId: sessao.usuarioId,
    usuarioEmail: emailDoAutor,
    acao: AcaoAuditoria.ACESSO,
    entidade: 'documento',
    entidadeId: documento.id,
    detalhes: {
      clienteId: documento.clienteId,
      nome: documento.nome,
      forma: comoAnexo ? 'download' : 'visualizacao',
    },
    enderecoIp: origem?.enderecoIp ?? null,
    agenteUsuario: origem?.agenteUsuario ?? null,
  })

  return urlTemporariaDeLeitura(documento.chaveArquivo, documento.nome, comoAnexo)
}
