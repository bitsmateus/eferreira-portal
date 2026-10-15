/**
 * Espelho do cadastro do cliente no sistema da NX, onde está ligado o número
 * da API oficial do WhatsApp e onde roda a IA de atendimento.
 *
 * Pedido do dono do sistema (08/10/2026): todo cliente cadastrado ou editado
 * no portal deve existir como contato lá. A regra é sempre a mesma — procura
 * o contato pelo número do WhatsApp; achou, atualiza; não achou, cria.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ISTO É CONVENIÊNCIA, NUNCA AUTORIDADE
 *
 * O cadastro do portal é o que vale. Por isso a sincronização:
 *
 *  - roda DEPOIS de o cliente estar gravado, fora da transação, e **nunca
 *    lança**: falha, demora ou resposta estranha da NX não desfazem nem
 *    travam o cadastro (mesmo princípio de `cep.ts` e do envio de e-mail);
 *  - fica desligada sem `NX_API_URL` e `NX_API_TOKEN`. É de propósito que a
 *    homologação fique sem elas — senão um teste gravaria contato de mentira
 *    na base real da NX, o mesmo risco que a D4Sign já ensinou;
 *  - o resultado entra na auditoria (regra 6), sem o token e sem o telefone.
 *
 * O contato é achado pelo número, então cliente sem telefone não é
 * sincronizado (empresa sem telefone própria: quem tem número é o sócio).
 * ─────────────────────────────────────────────────────────────────────────
 */

import { AcaoAuditoria, TipoPessoa } from '@prisma/client'

import { registrarAuditoria } from '@/lib/auditoria'
import { exigirAdministrador, exigirEquipe, filtroDeClientes } from '@/lib/autorizacao'
import type { SessaoServidor } from '@/lib/autorizacao'
import { somenteDigitos } from '@/lib/formatos'
import { prisma } from '@/lib/prisma'

const ESPERA_MAXIMA_MS = 8000

export type ResultadoDaSincronizacaoNx =
  | { situacao: 'criado' | 'atualizado' }
  | { situacao: 'desligado' | 'sem_telefone' | 'cliente_inexistente' }
  | { situacao: 'falhou'; motivo: string }

type Configuracao = { base: string; token: string }

function configuracao(): Configuracao | null {
  const base = process.env.NX_API_URL?.trim().replace(/\/+$/, '') ?? ''
  const token = process.env.NX_API_TOKEN?.trim() ?? ''
  if (base === '' || token === '') return null
  return { base, token }
}

/** Formato da NX: DDI + DDD + número, só dígitos. */
export function numeroParaNx(telefone: string | null): string | null {
  const digitos = somenteDigitos(telefone ?? '')
  if (digitos.length < 10) return null
  return digitos.startsWith('55') && digitos.length >= 12 ? digitos : `55${digitos}`
}

/**
 * O mesmo celular pode estar gravado na NX com ou sem o nono dígito. Devolve
 * o número como veio primeiro e a outra forma depois; só vale para celular
 * (DDI 55 + DDD + 9 + 8 dígitos, ou a forma antiga sem o 9).
 */
export function variantesDoNumero(numero: string): string[] {
  if (numero.length === 13 && numero.startsWith('55') && numero[4] === '9') {
    return [numero, numero.slice(0, 4) + numero.slice(5)]
  }
  if (numero.length === 12 && numero.startsWith('55') && /[6-9]/.test(numero[4] ?? '')) {
    return [numero.slice(0, 4) + '9' + numero.slice(4), numero]
  }
  return [numero]
}

function formatarDocumento(documento: string): string {
  if (documento.length === 11) {
    return documento.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  }
  return documento.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

type Contato = Record<string, string>

/** Só entra o que existe: na atualização, campo ausente fica como está lá. */
function montarContato(cliente: {
  nome: string
  documento: string
  tipoPessoa: TipoPessoa
  email: string | null
  cep: string | null
  endereco: string | null
  cidade: string | null
  uf: string | null
}, numero: string): Contato {
  const contato: Contato = {
    name: cliente.nome,
    number: numero,
    cpf: formatarDocumento(cliente.documento),
  }
  if (cliente.tipoPessoa === TipoPessoa.JURIDICA) contato.businessName = cliente.nome
  if (cliente.email) contato.email = cliente.email
  if (cliente.cep) contato.cep = cliente.cep
  // O portal guarda logradouro, número, complemento e bairro num campo só.
  if (cliente.endereco) contato.logradouro = cliente.endereco
  if (cliente.cidade) contato.cidade = cliente.cidade
  if (cliente.uf) contato.estado = cliente.uf
  return contato
}

async function chamar(
  config: Configuracao,
  caminho: string,
  corpo: Contato | { number: string },
): Promise<{ status: number }> {
  const resposta = await fetch(`${config.base}/${caminho}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.token}`,
    },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(ESPERA_MAXIMA_MS),
  })
  return { status: resposta.status }
}

async function sincronizar(clienteId: string): Promise<ResultadoDaSincronizacaoNx> {
  const config = configuracao()
  if (config === null) return { situacao: 'desligado' }

  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    select: {
      nome: true,
      documento: true,
      tipoPessoa: true,
      email: true,
      telefone: true,
      cep: true,
      endereco: true,
      cidade: true,
      uf: true,
    },
  })
  if (cliente === null) return { situacao: 'cliente_inexistente' }

  const numero = numeroParaNx(cliente.telefone)
  if (numero === null) return { situacao: 'sem_telefone' }

  try {
    // Procura com 9 e sem 9: o contato pode ter entrado na NX de qualquer
    // forma, e criar um segundo seria duplicar a pessoa.
    for (const candidato of variantesDoNumero(numero)) {
      const busca = await chamar(config, 'showcontact', { number: candidato })

      if (busca.status === 200) {
        // Atualiza pelo número como está gravado lá, para não trocar a chave.
        const edicao = await chamar(config, 'updateContact', montarContato(cliente, candidato))
        return edicao.status >= 200 && edicao.status < 300
          ? { situacao: 'atualizado' }
          : { situacao: 'falhou', motivo: `updateContact respondeu ${edicao.status}` }
      }

      if (busca.status !== 404) {
        return { situacao: 'falhou', motivo: `showcontact respondeu ${busca.status}` }
      }
    }

    const criacao = await chamar(config, 'createContact', montarContato(cliente, numero))
    return criacao.status >= 200 && criacao.status < 300
      ? { situacao: 'criado' }
      : { situacao: 'falhou', motivo: `createContact respondeu ${criacao.status}` }
  } catch (erro) {
    return {
      situacao: 'falhou',
      motivo: erro instanceof Error ? erro.name : 'erro desconhecido',
    }
  }
}

/**
 * Chamada depois de gravar um cliente. Nunca lança.
 * `autor` é quem gravou o cliente, para a auditoria dizer de quem foi a ação.
 */
export async function sincronizarContatoNx(
  clienteId: string,
  autor: { usuarioId: string | null; usuarioEmail: string | null },
): Promise<ResultadoDaSincronizacaoNx> {
  try {
    const resultado = await sincronizar(clienteId)

    if (resultado.situacao === 'criado' || resultado.situacao === 'atualizado' || resultado.situacao === 'falhou') {
      await registrarAuditoria({
        usuarioId: autor.usuarioId,
        usuarioEmail: autor.usuarioEmail,
        acao: resultado.situacao === 'criado' ? AcaoAuditoria.CRIACAO : AcaoAuditoria.ATUALIZACAO,
        entidade: 'contato_nx',
        entidadeId: clienteId,
        detalhes:
          resultado.situacao === 'falhou'
            ? { resultado: 'falhou', motivo: resultado.motivo }
            : { resultado: resultado.situacao },
      })
    }
    if (resultado.situacao === 'falhou') {
      console.error('[nx] contato não sincronizado:', resultado.motivo)
    }
    return resultado
  } catch (erro) {
    console.error('[nx] erro ao sincronizar contato:', erro instanceof Error ? erro.name : erro)
    return { situacao: 'falhou', motivo: 'erro interno' }
  }
}

/**
 * Botão "Enviar para a NX" da ficha (15/10/2026): faz na hora, a pedido de
 * quem está olhando, o que o cadastro já tenta fazer sozinho — e devolve o
 * resultado inteiro para a tela mostrar, inclusive o motivo da falha.
 */
export async function enviarClienteParaNx(
  sessao: SessaoServidor,
  clienteId: string,
  emailDoAutor: string | null,
): Promise<ResultadoDaSincronizacaoNx> {
  exigirEquipe(sessao)
  // Regra 2: só chega ao contato quem a sessão enxerga como cliente.
  const visivel = await prisma.cliente.findFirst({
    where: filtroDeClientes(sessao, { id: clienteId }),
    select: { id: true },
  })
  if (visivel === null) return { situacao: 'cliente_inexistente' }

  return sincronizarContatoNx(clienteId, { usuarioId: sessao.usuarioId, usuarioEmail: emailDoAutor })
}

export type ResumoDoEnvioEmMassa = {
  total: number
  criados: number
  atualizados: number
  semTelefone: number
  /** Já sincronizados antes com sucesso: o envio em massa não repete. */
  jaEnviados: number
  falhas: { clienteId: string; nome: string; motivo: string }[]
  desligado: boolean
}

/**
 * Botão geral "Enviar todos para a NX": percorre os clientes que ainda NÃO
 * foram sincronizados com sucesso (a auditoria `contato_nx` diz quais), um por
 * vez, e cada um segue a regra de sempre — achou pelo número (com ou sem o 9),
 * atualiza; não achou, cria. Quem falhou ou não tinha telefone volta a ser
 * tentado na próxima. Só o administrador.
 */
export async function enviarTodosParaNx(
  sessao: SessaoServidor,
  emailDoAutor: string | null,
): Promise<ResumoDoEnvioEmMassa> {
  exigirAdministrador(sessao)

  const resumo: ResumoDoEnvioEmMassa = {
    total: 0,
    criados: 0,
    atualizados: 0,
    semTelefone: 0,
    jaEnviados: 0,
    falhas: [],
    desligado: false,
  }

  if (configuracao() === null) return { ...resumo, desligado: true }

  const clientes = await prisma.cliente.findMany({
    select: { id: true, nome: true },
    orderBy: { criadoEm: 'asc' },
  })
  resumo.total = clientes.length

  const jaSincronizados = await prisma.auditoria.findMany({
    where: {
      entidade: 'contato_nx',
      OR: [
        { detalhes: { path: ['resultado'], equals: 'criado' } },
        { detalhes: { path: ['resultado'], equals: 'atualizado' } },
      ],
    },
    select: { entidadeId: true },
    distinct: ['entidadeId'],
  })
  const feitos = new Set(jaSincronizados.map((registro) => registro.entidadeId))

  for (const cliente of clientes) {
    if (feitos.has(cliente.id)) {
      resumo.jaEnviados += 1
      continue
    }
    const resultado = await sincronizarContatoNx(cliente.id, {
      usuarioId: sessao.usuarioId,
      usuarioEmail: emailDoAutor,
    })
    if (resultado.situacao === 'criado') resumo.criados += 1
    else if (resultado.situacao === 'atualizado') resumo.atualizados += 1
    else if (resultado.situacao === 'sem_telefone') resumo.semTelefone += 1
    else if (resultado.situacao === 'falhou') {
      resumo.falhas.push({ clienteId: cliente.id, nome: cliente.nome, motivo: resultado.motivo })
    }
  }

  return resumo
}
