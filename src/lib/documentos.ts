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

import {
  AcaoAuditoria,
  OrigemDoDocumento,
  type Prisma,
  SituacaoDoEnvio,
  TipoDocumento,
} from '@prisma/client'
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
  LIMITE_DE_ARQUIVOS_POR_ENVIO,
  TAMANHO_MAXIMO_BYTES,
  TAMANHO_TOTAL_MAXIMO_BYTES,
  TIPOS_ACEITOS,
} from '@/lib/arquivos'
import { somenteDigitos } from '@/lib/formatos'
import type { EnvioEmAndamento } from '@/lib/assinaturas'

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

/**
 * Vários arquivos de uma vez (25/09/2026): "precisamos anexar mais de um
 * documento de uma vez". O limite por arquivo continua sendo o de sempre; o
 * teto de quantidade e de tamanho total existe para uma única requisição não
 * virar um jeito de encher o servidor — o corpo da ação de servidor cabe
 * `TAMANHO_TOTAL_MAXIMO_BYTES` (ver `next.config.ts`).
 */
export type ArquivoConferido = { arquivo: File; nome: string; tipoConteudo: string }

/**
 * Confere a lista inteira ANTES de gravar qualquer coisa: um arquivo ruim no
 * meio não pode deixar metade do lote no ar. Cada recusa diz de qual arquivo é.
 */
export function validarArquivos(
  arquivos: readonly File[],
): { ok: true; dados: ArquivoConferido[] } | { ok: false; mensagem: string } {
  const escolhidos = arquivos.filter((arquivo) => arquivo.size > 0)

  if (escolhidos.length === 0) {
    return { ok: false, mensagem: 'Escolha ao menos um arquivo para anexar.' }
  }

  if (escolhidos.length > LIMITE_DE_ARQUIVOS_POR_ENVIO) {
    return {
      ok: false,
      mensagem: `No máximo ${LIMITE_DE_ARQUIVOS_POR_ENVIO} arquivos por vez. Você escolheu ${escolhidos.length}.`,
    }
  }

  const total = escolhidos.reduce((soma, arquivo) => soma + arquivo.size, 0)
  if (total > TAMANHO_TOTAL_MAXIMO_BYTES) {
    return {
      ok: false,
      mensagem: `Os arquivos juntos passam de ${Math.floor(
        TAMANHO_TOTAL_MAXIMO_BYTES / (1024 * 1024),
      )} MB. Envie em mais de uma vez.`,
    }
  }

  const conferidos: ArquivoConferido[] = []
  for (const arquivo of escolhidos) {
    const conferido = validarArquivo(arquivo)
    if (!conferido.ok) {
      return {
        ok: false,
        mensagem: `"${arquivo.name}": ${conferido.erros['arquivo'] ?? 'arquivo inválido.'}`,
      }
    }
    conferidos.push({
      arquivo,
      nome: conferido.dados.nome,
      tipoConteudo: conferido.dados.tipoConteudo,
    })
  }

  return { ok: true, dados: conferidos }
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

const RESUMO = {
  id: true,
  tipo: true,
  origem: true,
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
// Tela de Documentos — item 2 da lista de melhorias: "quais contratos estão
// aguardando assinatura?" sem abrir cliente por cliente.
//
// Só a EQUIPE enxerga isto (`exigirEquipe`, abaixo) — ao contrário da pasta
// do cliente, que também serve `/meus-processos`, esta tela cruza documento
// de todos os clientes e não pode ser alcançada por uma sessão de cliente.
// ---------------------------------------------------------------------------

const RESUMO_GERAL = {
  ...RESUMO,
  cliente: { select: { id: true, nome: true, documento: true } },
} satisfies Prisma.DocumentoSelect

export type LinhaDeDocumentoGeral = Prisma.DocumentoGetPayload<{
  select: typeof RESUMO_GERAL
}>

/** O que a tela mostra sobre a assinatura, derivado do envio mais recente. */
export type SituacaoDeAssinatura = 'assinado' | 'aguardando' | 'nao_enviado'

export function situacaoDeAssinaturaDoDocumento(
  documento: Pick<LinhaDeDocumentoGeral, 'assinadoEm'>,
  envio: EnvioEmAndamento | null,
): SituacaoDeAssinatura {
  if (documento.assinadoEm !== null) return 'assinado'
  if (envio !== null && envio.situacao === SituacaoDoEnvio.AGUARDANDO) return 'aguardando'
  return 'nao_enviado'
}

export type FiltrosDeDocumento = {
  /** '' = todos. */
  tipo: '' | TipoDocumento
  /** '' = todos. Calculado a partir do envio mais recente, não de uma coluna. */
  situacao: '' | SituacaoDeAssinatura
}

export const FILTROS_DE_DOCUMENTO_VAZIOS: FiltrosDeDocumento = { tipo: '', situacao: '' }

export function lerFiltrosDeDocumento(
  entrada: Record<string, string | undefined>,
): FiltrosDeDocumento {
  const tipos = Object.values(TipoDocumento) as readonly string[]
  const situacoes = ['assinado', 'aguardando', 'nao_enviado'] as const

  const tipo = entrada['tipo']
  const situacao = entrada['situacao']

  return {
    tipo: tipo !== undefined && tipos.includes(tipo) ? (tipo as TipoDocumento) : '',
    situacao:
      situacao !== undefined && (situacoes as readonly string[]).includes(situacao)
        ? (situacao as SituacaoDeAssinatura)
        : '',
  }
}

export function algumFiltroDeDocumentoAtivo(filtros: FiltrosDeDocumento): boolean {
  return filtros.tipo !== '' || filtros.situacao !== ''
}

/**
 * Mesma heurística de `interpretarBusca` em `clientes.ts`: dígitos viram
 * busca por CPF/CNPJ do cliente, o resto vira busca por nome (do cliente ou
 * do arquivo).
 */
function condicaoDaBuscaGeral(termo: string): Prisma.DocumentoWhereInput | undefined {
  const limpo = termo.trim()
  if (limpo === '') return undefined

  const digitos = somenteDigitos(limpo)
  const temLetra = /\p{L}/u.test(limpo)

  if (!temLetra && digitos.length >= 3) {
    return { cliente: { documento: { contains: digitos } } }
  }

  return {
    OR: [
      { cliente: { nome: { contains: limpo, mode: 'insensitive' } } },
      { nome: { contains: limpo, mode: 'insensitive' } },
    ],
  }
}

/** Teto de linhas — a mesma ideia das listas de clientes e de casos. */
export const LIMITE_DA_LISTA_DE_DOCUMENTOS = 300

export type ListaDeDocumentosGeral = {
  linhas: LinhaDeDocumentoGeral[]
  /**
   * Truncada pelo teto de BUSCA (tipo/nome/cliente), antes do filtro de
   * situação de assinatura — este último é calculado em memória a partir do
   * envio mais recente, não dá para empurrar para o banco sem duplicar a
   * lógica de `comoEnvio`. Documentos raros o bastante para o escritório
   * de um advogado não deveriam nunca chegar perto deste teto.
   */
  truncada: boolean
}

export async function listarTodosOsDocumentos(
  sessao: SessaoServidor,
  termo: string,
  filtros: FiltrosDeDocumento,
): Promise<ListaDeDocumentosGeral> {
  exigirEquipe(sessao)

  const condicoes: Prisma.DocumentoWhereInput[] = []
  const daBusca = condicaoDaBuscaGeral(termo)
  if (daBusca !== undefined) condicoes.push(daBusca)
  if (filtros.tipo !== '') condicoes.push({ tipo: filtros.tipo })

  const documentos = await prisma.documento.findMany({
    where: filtroDeDocumentos(
      sessao,
      condicoes.length === 0 ? undefined : { AND: condicoes },
    ),
    select: RESUMO_GERAL,
    orderBy: { criadoEm: 'desc' },
    take: LIMITE_DA_LISTA_DE_DOCUMENTOS + 1,
  })

  return {
    linhas: documentos.slice(0, LIMITE_DA_LISTA_DE_DOCUMENTOS),
    truncada: documentos.length > LIMITE_DA_LISTA_DE_DOCUMENTOS,
  }
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
          origem: OrigemDoDocumento.ANEXADO,
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

// ---------------------------------------------------------------------------
// Exclusão
// ---------------------------------------------------------------------------

export type ResultadoDaExclusaoDeDocumento =
  | { situacao: 'excluido' }
  | { situacao: 'nao_encontrado' }
  /** Já foi assinado — o documento em si é a prova, e prova apagada não volta. */
  | { situacao: 'assinado' }
  /** Já foi enviado para assinatura; apagar destruiria o rastro do envio. */
  | { situacao: 'enviado_para_assinatura' }

/**
 * Apaga um documento da pasta — e SÓ o que ainda não deixou rastro.
 *
 * O problema real que isto resolve é o mesmo dos outros dois: anexo enviado
 * por engano, PDF gerado para o caso errado, teste que ficou na pasta. Esse
 * documento não é prova de nada, e apagá-lo não destrói nada.
 *
 * Documento ASSINADO é outra coisa — é ele próprio a prova, e não há como
 * desfazer. Documento já ENVIADO para assinatura também é recusado, mesmo
 * ainda aguardando: a linha em `EnvioParaAssinatura` aponta para ele com
 * `onDelete: Cascade`, e apagar o documento apagaria junto o registro de quem
 * mandou, para quem e quando — o rastro do crédito gasto e do e-mail
 * mandado (regra 6). Nenhuma tela deve poder fazer isso com dois cliques.
 */
export async function excluirDocumento(
  sessao: SessaoServidor,
  documentoId: string,
  emailDoAutor: string | null,
): Promise<ResultadoDaExclusaoDeDocumento> {
  exigirEquipe(sessao)

  // Regra 2: o id vem da tela, mas quem decide se ele pode ser tocado é o
  // filtro montado a partir da sessão.
  const documento = await prisma.documento.findFirst({
    where: filtroDeDocumentos(sessao, { id: documentoId }),
    select: {
      id: true,
      nome: true,
      clienteId: true,
      casoId: true,
      chaveArquivo: true,
      assinadoEm: true,
      _count: { select: { envios: true } },
    },
  })
  if (documento === null) return { situacao: 'nao_encontrado' }

  if (documento.assinadoEm !== null) return { situacao: 'assinado' }
  if (documento._count.envios > 0) return { situacao: 'enviado_para_assinatura' }

  await prisma.documento.delete({ where: { id: documento.id } })

  await registrarAuditoria({
    usuarioId: sessao.usuarioId,
    usuarioEmail: emailDoAutor,
    acao: AcaoAuditoria.EXCLUSAO,
    entidade: 'documento',
    entidadeId: documento.id,
    detalhes: {
      // Em texto: a linha do documento não existe mais para ser consultada.
      nome: documento.nome,
      clienteId: documento.clienteId,
      casoId: documento.casoId,
    },
  })

  // Best-effort: se o armazenamento não responder agora, sobra um objeto
  // órfão no balde — chave opaca, sem dono e sem utilidade —, o que é
  // inofensivo. Deixar o registro em estado incerto no banco seria pior.
  await removerArquivo(documento.chaveArquivo).catch(() => undefined)

  return { situacao: 'excluido' }
}
