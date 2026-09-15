/**
 * Armazenamento de arquivos — regra 5: nenhum arquivo é público.
 *
 * O balde não tem acesso anônimo (ver docker-compose). Todo documento sai por
 * URL pré-assinada de validade curta, gerada **depois** da verificação de
 * autorização — quem verifica é `src/lib/documentos.ts`, nunca esta camada.
 * Aqui só existe o "como", não o "quem pode".
 *
 * S3 é padrão aberto: em desenvolvimento o serviço é o MinIO do
 * docker-compose; em produção, qualquer object storage compatível. Trocar de
 * fornecedor é mudar variável de ambiente, não reescrever código.
 */

import { randomUUID } from 'node:crypto'
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

function exigirVariavel(nome: string): string {
  const valor = process.env[nome]
  if (valor === undefined || valor === '') {
    throw new Error(
      `Variável de ambiente ${nome} não definida. Ver .env.example (regra 8).`,
    )
  }
  return valor
}

/** Validade da URL assinada. Curta de propósito: 5 minutos por padrão. */
function validadeEmSegundos(): number {
  const bruto = process.env['ARMAZENAMENTO_URL_VALIDADE_SEGUNDOS']
  const numero = Number(bruto)
  return Number.isFinite(numero) && numero > 0 ? Math.floor(numero) : 300
}

let clienteMemorizado: S3Client | null = null

function cliente(): S3Client {
  if (clienteMemorizado !== null) return clienteMemorizado

  clienteMemorizado = new S3Client({
    region: process.env['ARMAZENAMENTO_REGIAO'] ?? 'us-east-1',
    endpoint: exigirVariavel('ARMAZENAMENTO_ENDPOINT'),
    // O MinIO não atende por subdomínio de balde.
    forcePathStyle: true,
    credentials: {
      accessKeyId: exigirVariavel('ARMAZENAMENTO_CHAVE_ACESSO'),
      secretAccessKey: exigirVariavel('ARMAZENAMENTO_CHAVE_SECRETA'),
    },
  })

  return clienteMemorizado
}

function balde(): string {
  return exigirVariavel('ARMAZENAMENTO_BALDE')
}

/**
 * Gera a chave do arquivo no armazenamento.
 *
 * Opaca e sorteada pelo servidor: não carrega o nome original, o CPF nem o id
 * do cliente. Mesmo que a chave vazasse, não revelaria de quem é o documento —
 * e não há como adivinhar a de outro (regra 5).
 */
export function gerarChaveDeArquivo(): string {
  return `documentos/${randomUUID()}`
}

export async function enviarArquivo(
  chave: string,
  conteudo: Uint8Array,
  tipoConteudo: string,
): Promise<void> {
  await cliente().send(
    new PutObjectCommand({
      Bucket: balde(),
      Key: chave,
      Body: conteudo,
      ContentType: tipoConteudo,
    }),
  )
}

/**
 * URL temporária para ler o arquivo.
 *
 * `comoAnexo` decide se o navegador abre o documento na tela (visualização) ou
 * baixa (download) — os dois caminhos que o Anexo I, 4.a pede. O nome original
 * volta aqui, na hora de servir, e não fica gravado na chave.
 */
export async function urlTemporariaDeLeitura(
  chave: string,
  nomeDoArquivo: string,
  comoAnexo: boolean,
): Promise<string> {
  const disposicao = comoAnexo ? 'attachment' : 'inline'
  const nomeSeguro = nomeDoArquivo.replace(/["\\\r\n]/g, '_')

  const comando = new GetObjectCommand({
    Bucket: balde(),
    Key: chave,
    ResponseContentDisposition: `${disposicao}; filename="${nomeSeguro}"`,
  })

  return getSignedUrl(cliente(), comando, { expiresIn: validadeEmSegundos() })
}

/**
 * Lê o arquivo inteiro para a memória.
 *
 * Existe para a assinatura eletrônica, que precisa **mandar os bytes** do PDF
 * para a D4Sign — a URL assinada não serve, porque ela é curta e de uso
 * externo, e o que a plataforma quer é o arquivo no corpo do pedido.
 *
 * Carregar tudo na memória é aceitável aqui e só aqui: o que se assina são os
 * documentos gerados pelo próprio sistema, que são PDFs de poucas páginas. Não
 * use isto para servir arquivo a navegador — para isso existe
 * `urlTemporariaDeLeitura`, que não passa o conteúdo pelo servidor.
 */
export async function lerArquivo(chave: string): Promise<Uint8Array> {
  const resposta = await cliente().send(
    new GetObjectCommand({ Bucket: balde(), Key: chave }),
  )

  if (resposta.Body === undefined) {
    throw new Error(`O arquivo ${chave} não tem conteúdo no armazenamento.`)
  }

  return new Uint8Array(await resposta.Body.transformToByteArray())
}

/** Usado para desfazer o envio quando a gravação no banco falha. */
export async function removerArquivo(chave: string): Promise<void> {
  await cliente().send(new DeleteObjectCommand({ Bucket: balde(), Key: chave }))
}
