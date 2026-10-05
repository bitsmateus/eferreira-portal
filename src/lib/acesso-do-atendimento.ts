/**
 * Entrada do cliente pelo ATENDIMENTO (a IA no WhatsApp): o mesmo código por
 * e-mail da tela `/consultar`, só que quem pede e confere é um integrador com
 * chave de API, em nome de uma conversa.
 *
 * Nada de lógica nova de código aqui: `pedirCodigo` e `conferirCodigo`, de
 * `acesso-do-cliente.ts`, fazem tudo — elegibilidade (contrato assinado,
 * ativo, com e-mail), limites, hash, validade, cinco tentativas, auditoria e
 * resposta sempre igual. Este arquivo só acrescenta duas coisas:
 *
 *   1. a ORIGEM do pedido passa a ser a conversa (o telefone), e não um IP;
 *   2. o comprovante de que ESTA conversa acertou o código para ESTE documento.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * O COMPROVANTE MORA NO SERVIDOR
 *
 * Quem chama é um agente de IA que não guarda memória entre mensagens, e um
 * token entregue a ele teria de passar pelo modelo — que é justamente o que
 * não deve decidir quem está autorizado. Então o servidor guarda a prova:
 * é o próprio `CodigoDeAcesso` usado (`usadoEm`), que já grava a origem de
 * quem o pediu. "Verificado" é: existe um código DESTE documento, usado há
 * menos de `MINUTOS_DE_ACESSO_DO_ATENDIMENTO`, pedido pela MESMA conversa.
 *
 * Não há tabela nova nem segredo novo. E o identificador da conversa vem do
 * integrador (do webhook), não do texto que o modelo escreve.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { createHash } from 'node:crypto'
import { SituacaoCliente } from '@prisma/client'

import { MINUTOS_DE_ACESSO_DO_ATENDIMENTO } from '@/lib/acesso'
import { conferirCodigo, pedirCodigo } from '@/lib/acesso-do-cliente'
import { prisma } from '@/lib/prisma'

const MS_POR_MINUTO = 60_000

const TAMANHO_MINIMO_DA_ORIGEM = 4
const TAMANHO_MAXIMO_DA_ORIGEM = 80

/** O agente do atendimento aparece assim na auditoria. */
const AGENTE_DO_ATENDIMENTO = 'api-atendimento'

/**
 * O identificador da conversa vira uma chave curta e opaca. O telefone não
 * entra na auditoria nem no banco: só esta impressão digital dele.
 *
 * O prefixo `api:` separa estas chaves dos IPs que o portal grava no mesmo
 * campo — e como o limite de pedidos por endereço conta por esse valor, cada
 * conversa ganha o seu próprio limite, em vez de todas dividirem o IP do n8n.
 */
export function chaveDaOrigem(identificador: string): string {
  const digital = createHash('sha256')
    .update(identificador.trim())
    .digest('hex')
    .slice(0, 24)
  return `api:${digital}`
}

export function origemValida(identificador: string): boolean {
  const tamanho = identificador.trim().length
  return tamanho >= TAMANHO_MINIMO_DA_ORIGEM && tamanho <= TAMANHO_MAXIMO_DA_ORIGEM
}

/** Resposta única, como a do portal: não revela se o documento é de cliente. */
export async function pedirCodigoDoAtendimento(
  documento: string,
  identificador: string,
): Promise<{ situacao: 'pedido_registrado' }> {
  return pedirCodigo(documento, {
    enderecoIp: chaveDaOrigem(identificador),
    agenteUsuario: AGENTE_DO_ATENDIMENTO,
  })
}

export type ResultadoDaConferenciaDoAtendimento =
  | { situacao: 'confere'; nome: string; validoPorMinutos: number }
  | { situacao: 'nao_confere' }

export async function conferirCodigoDoAtendimento(
  documento: string,
  codigo: string,
  identificador: string,
): Promise<ResultadoDaConferenciaDoAtendimento> {
  const resultado = await conferirCodigo(documento, codigo, {
    enderecoIp: chaveDaOrigem(identificador),
    agenteUsuario: AGENTE_DO_ATENDIMENTO,
  })

  if (resultado.situacao !== 'confere') return { situacao: 'nao_confere' }

  return {
    situacao: 'confere',
    nome: resultado.nome,
    validoPorMinutos: MINUTOS_DE_ACESSO_DO_ATENDIMENTO,
  }
}

/**
 * Esta conversa acertou o código deste documento nos últimos 30 minutos?
 *
 * O código precisa ter sido PEDIDO pela mesma conversa que agora consulta:
 * um código acertado por outra conversa não serve de comprovante para esta.
 * E o cliente continua tendo de estar elegível — desativar ou revogar o
 * acesso fecha a consulta na hora, sem esperar os 30 minutos.
 */
export async function acessoVerificado(
  documento: string,
  identificador: string,
  agora: Date = new Date(),
): Promise<boolean> {
  const desde = new Date(agora.getTime() - MINUTOS_DE_ACESSO_DO_ATENDIMENTO * MS_POR_MINUTO)

  const comprovantes = await prisma.codigoDeAcesso.count({
    where: {
      enderecoIp: chaveDaOrigem(identificador),
      usadoEm: { gte: desde },
      cliente: {
        documento,
        situacao: SituacaoCliente.ATIVO,
        contratoAssinadoEm: { not: null },
      },
    },
  })

  return comprovantes > 0
}
