/**
 * A API do escritório, ponta a ponta — Anexo I, itens 3.b e 3.c.
 *
 * As requisições entram pelas **rotas de verdade**, não pelas funções de
 * domínio por baixo delas. É de propósito: a permissão da chave é conferida na
 * rota, porque a sessão que a credencial carrega é de operador e o domínio
 * deixaria qualquer chave escrever. Testar só o domínio provaria o contrário do
 * que interessa.
 *
 * Critério de pronto da sprint: "um terceiro consegue consultar um andamento
 * pela API usando só a documentação". Estes testes percorrem exatamente o que
 * `docs/api.md` manda o terceiro fazer.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { PerfilUsuario, PermissaoApi, TipoPessoa } from '@prisma/client'

import { GET as getConsulta } from '@/app/api/v1/consulta/route'
import { GET as getCredencial } from '@/app/api/v1/credencial/route'
import { GET as getStatus } from '@/app/api/v1/status/route'
import { POST as postCliente } from '@/app/api/v1/clientes/route'
import { PUT as putCliente } from '@/app/api/v1/clientes/[id]/route'
import { POST as postCaso } from '@/app/api/v1/casos/route'
import { POST as postAndamento } from '@/app/api/v1/casos/[id]/andamentos/route'
import { criarCredencial, revogarCredencial } from '@/lib/credenciais'
import { SemAutorizacao, type SessaoServidor } from '@/lib/autorizacao'
import { prisma } from '@/lib/prisma'

const BASE = 'https://homologacao.exemplo.invalido'

/** Sintéticos e válidos no dígito verificador. Os do protótipo reprovam. */
const DOCUMENTO_EXISTENTE = '52998224725'
const DOCUMENTO_NOVO = '11144477735'
const DOCUMENTO_DE_NINGUEM = '39053344705'
const DOCUMENTOS = [DOCUMENTO_EXISTENTE, DOCUMENTO_NOVO]

const EMAIL_DO_ADMIN = 'admin.teste.api@exemplo.invalido'
const NOMES_DAS_CHAVES = ['Teste · só consulta', 'Teste · consulta e escrita']

let sessaoDoAdmin: SessaoServidor
let sessaoDeOperador: SessaoServidor
let chaveDeLeitura: string
let chaveDeEscrita: string
let credencialDeLeituraId: string
let clienteId: string
let casoId: string
let statusId: string

function requisicao(
  caminho: string,
  opcoes: { chave?: string; metodo?: string; corpo?: unknown } = {},
): NextRequest {
  const cabecalhos = new Headers()
  if (opcoes.chave !== undefined) {
    cabecalhos.set('authorization', `Bearer ${opcoes.chave}`)
  }
  if (opcoes.corpo !== undefined) {
    cabecalhos.set('content-type', 'application/json')
  }

  return new NextRequest(`${BASE}${caminho}`, {
    method: opcoes.metodo ?? 'GET',
    headers: cabecalhos,
    ...(opcoes.corpo === undefined
      ? {}
      : { body: JSON.stringify(opcoes.corpo) }),
  })
}

function parametros(id: string) {
  return { params: Promise.resolve({ id }) }
}

async function corpoDe(resposta: Response): Promise<Record<string, unknown>> {
  return (await resposta.json()) as Record<string, unknown>
}

async function limpar(): Promise<void> {
  await prisma.cliente.deleteMany({ where: { documento: { in: DOCUMENTOS } } })
  await prisma.credencialApi.deleteMany({ where: { nome: { in: NOMES_DAS_CHAVES } } })
  await prisma.usuario.deleteMany({
    where: {
      OR: [
        { email: EMAIL_DO_ADMIN },
        { nome: { in: NOMES_DAS_CHAVES.map((nome) => `API · ${nome}`) } },
      ],
    },
  })
}

beforeAll(async () => {
  await limpar()

  const admin = await prisma.usuario.create({
    data: {
      nome: 'Administrador do teste da API',
      email: EMAIL_DO_ADMIN,
      senhaHash: null,
      perfil: PerfilUsuario.ADMINISTRADOR,
    },
    select: { id: true },
  })

  sessaoDoAdmin = {
    usuarioId: admin.id,
    perfil: PerfilUsuario.ADMINISTRADOR,
    clienteId: null,
    contratoAssinado: false,
  }
  sessaoDeOperador = { ...sessaoDoAdmin, perfil: PerfilUsuario.OPERADOR }

  const leitura = await criarCredencial(
    sessaoDoAdmin,
    { nome: NOMES_DAS_CHAVES[0] ?? '', permissoes: [PermissaoApi.CONSULTAR] },
    EMAIL_DO_ADMIN,
  )
  chaveDeLeitura = leitura.chave
  credencialDeLeituraId = leitura.credencialId

  const escrita = await criarCredencial(
    sessaoDoAdmin,
    {
      nome: NOMES_DAS_CHAVES[1] ?? '',
      permissoes: [PermissaoApi.CONSULTAR, PermissaoApi.ESCREVER],
    },
    EMAIL_DO_ADMIN,
  )
  chaveDeEscrita = escrita.chave

  const cliente = await prisma.cliente.create({
    data: {
      documento: DOCUMENTO_EXISTENTE,
      nome: 'Cliente já cadastrado',
      nomeBusca: 'cliente ja cadastrado',
      tipoPessoa: TipoPessoa.FISICA,
      email: 'cliente.api@exemplo.invalido',
    },
    select: { id: true },
  })
  clienteId = cliente.id

  const caso = await prisma.caso.create({
    data: { clienteId: cliente.id, assunto: 'Ação de cobrança do teste da API' },
    select: { id: true },
  })
  casoId = caso.id

  const status = await prisma.statusAndamento.findFirst({
    where: { ativo: true },
    orderBy: { ordem: 'asc' },
    select: { id: true },
  })
  statusId = status?.id ?? ''
})

afterAll(async () => {
  await limpar()
  await prisma.$disconnect()
})

// ---------------------------------------------------------------------------

describe('quem pode gerar credencial', () => {
  it('o operador não gera: é coisa do administrador', async () => {
    await expect(
      criarCredencial(
        sessaoDeOperador,
        { nome: 'Chave que não deve nascer', permissoes: [PermissaoApi.CONSULTAR] },
        null,
      ),
    ).rejects.toBeInstanceOf(SemAutorizacao)
  })

  it('a chave criada não fica recuperável em lugar nenhum', async () => {
    const guardada = await prisma.credencialApi.findUnique({
      where: { id: credencialDeLeituraId },
      select: { segredoHash: true, final: true },
    })

    const segredo = chaveDeLeitura.split('_').slice(-1)[0] ?? ''
    expect(guardada?.segredoHash).not.toContain(segredo)
    expect(guardada?.final).toBe(segredo.slice(-4))
  })

  it('o segredo também não vai para a auditoria', async () => {
    const registro = await prisma.auditoria.findFirst({
      where: { entidade: 'credencial_api', entidadeId: credencialDeLeituraId },
      select: { detalhes: true },
    })

    const segredo = chaveDeLeitura.split('_').slice(-1)[0] ?? ''
    expect(JSON.stringify(registro?.detalhes)).not.toContain(segredo)
  })
})

describe('autenticação', () => {
  it('sem cabeçalho: 401 com WWW-Authenticate', async () => {
    const resposta = await getConsulta(
      requisicao(`/api/v1/consulta?documento=${DOCUMENTO_EXISTENTE}`),
    )

    expect(resposta.status).toBe(401)
    expect(resposta.headers.get('WWW-Authenticate')).toBe('Bearer')
    expect((await corpoDe(resposta))['erro']).toBe('nao_autenticado')
  })

  it('chave inventada, malformada ou com segredo trocado: sempre 401', async () => {
    const trocada = `${chaveDeLeitura.slice(0, -4)}0000`

    for (const chave of ['ef_live_qualquercoisa', 'nem-parece-chave', trocada]) {
      const resposta = await getConsulta(
        requisicao(`/api/v1/consulta?documento=${DOCUMENTO_EXISTENTE}`, { chave }),
      )
      expect(resposta.status).toBe(401)
    }
  })

  it('a chave se apresenta em /credencial', async () => {
    const resposta = await getCredencial(
      requisicao('/api/v1/credencial', { chave: chaveDeLeitura }),
    )

    expect(resposta.status).toBe(200)
    const corpo = await corpoDe(resposta)
    expect(corpo['nome']).toBe(NOMES_DAS_CHAVES[0])
    expect(corpo['permissoes']).toEqual(['CONSULTAR'])
    expect(corpo['versao']).toBe('1')
  })

  it('nenhuma resposta pode ser guardada em cache', async () => {
    const resposta = await getCredencial(
      requisicao('/api/v1/credencial', { chave: chaveDeLeitura }),
    )
    expect(resposta.headers.get('Cache-Control')).toContain('no-store')
  })

  it('o uso da chave fica anotado', async () => {
    await getCredencial(requisicao('/api/v1/credencial', { chave: chaveDeLeitura }))

    // A anotação é disparada fora do caminho da resposta; espera curta.
    await new Promise((seguir) => setTimeout(seguir, 300))

    const credencial = await prisma.credencialApi.findUnique({
      where: { id: credencialDeLeituraId },
      select: { ultimoUsoEm: true },
    })
    expect(credencial?.ultimoUsoEm).not.toBeNull()
  })
})

describe('permissões separam a chave de leitura da de escrita', () => {
  it('a chave de consulta não cadastra: 403', async () => {
    const resposta = await postCliente(
      requisicao('/api/v1/clientes', {
        chave: chaveDeLeitura,
        metodo: 'POST',
        corpo: { documento: DOCUMENTO_NOVO, nome: 'Não deve nascer' },
      }),
    )

    expect(resposta.status).toBe(403)
    expect((await corpoDe(resposta))['erro']).toBe('sem_permissao')

    const criado = await prisma.cliente.findUnique({
      where: { documento: DOCUMENTO_NOVO },
      select: { id: true },
    })
    expect(criado).toBeNull()
  })

  it('a chave de consulta também não lança andamento: 403', async () => {
    const resposta = await postAndamento(
      requisicao(`/api/v1/casos/${casoId}/andamentos`, {
        chave: chaveDeLeitura,
        metodo: 'POST',
        corpo: { data: '2026-08-31', statusId, descricao: 'Não deve ser lançado.' },
      }),
      parametros(casoId),
    )

    expect(resposta.status).toBe(403)
  })
})

describe('consulta por CPF ou CNPJ (Anexo I, 3.b)', () => {
  it('devolve cliente, processo e andamento', async () => {
    await postAndamento(
      requisicao(`/api/v1/casos/${casoId}/andamentos`, {
        chave: chaveDeEscrita,
        metodo: 'POST',
        corpo: {
          data: '2026-08-31',
          statusId,
          descricao: 'Petição de réplica juntada aos autos.',
        },
      }),
      parametros(casoId),
    )

    const resposta = await getConsulta(
      requisicao(`/api/v1/consulta?documento=529.982.247-25`, {
        chave: chaveDeLeitura,
      }),
    )

    expect(resposta.status).toBe(200)
    const corpo = await corpoDe(resposta)

    const cliente = corpo['cliente'] as Record<string, unknown>
    expect(cliente['documento']).toBe(DOCUMENTO_EXISTENTE)
    expect(cliente['documentoFormatado']).toBe('529.982.247-25')
    expect(cliente['tipoPessoa']).toBe('FISICA')
    // Sem contrato assinado, o cliente não entra no portal — e a API diz isso.
    expect(cliente['contratoAssinadoEm']).toBeNull()

    const casos = corpo['casos'] as Record<string, unknown>[]
    expect(casos).toHaveLength(1)
    expect(casos[0]?.['situacao']).toBe('EM_ANDAMENTO')
    expect(casos[0]?.['situacaoRotulo']).toBe('Em andamento')

    const andamento = casos[0]?.['andamento'] as Record<string, unknown>
    // Regra 11: dia civil em São Paulo, sem hora.
    expect(andamento['data']).toBe('2026-08-31')
    expect(andamento['descricao']).toContain('réplica')

    // Sem ?historico=true, a linha do tempo inteira não vem.
    expect(casos[0]?.['historico']).toBeUndefined()
  })

  it('com ?historico=true vem a linha do tempo inteira', async () => {
    const resposta = await getConsulta(
      requisicao(
        `/api/v1/consulta?documento=${DOCUMENTO_EXISTENTE}&historico=true`,
        { chave: chaveDeLeitura },
      ),
    )

    const casos = (await corpoDe(resposta))['casos'] as Record<string, unknown>[]
    expect(Array.isArray(casos[0]?.['historico'])).toBe(true)
  })

  it('documento válido sem cliente: 404', async () => {
    const resposta = await getConsulta(
      requisicao(`/api/v1/consulta?documento=${DOCUMENTO_DE_NINGUEM}`, {
        chave: chaveDeLeitura,
      }),
    )

    expect(resposta.status).toBe(404)
    expect((await corpoDe(resposta))['erro']).toBe('nao_encontrado')
  })

  /**
   * Regra 4: dígito verificador, não só máscara. E é erro diferente de "não
   * encontrei" — um é resposta, o outro é engano de quem chamou.
   */
  it('documento que reprova no dígito verificador: 422, não 404', async () => {
    const resposta = await getConsulta(
      requisicao('/api/v1/consulta?documento=111.111.111-11', {
        chave: chaveDeLeitura,
      }),
    )

    expect(resposta.status).toBe(422)
    expect((await corpoDe(resposta))['erro']).toBe('dados_invalidos')
  })

  it('sem o parâmetro documento: 422', async () => {
    const resposta = await getConsulta(
      requisicao('/api/v1/consulta', { chave: chaveDeLeitura }),
    )
    expect(resposta.status).toBe(422)
  })
})

describe('lista de situações', () => {
  it('devolve a lista do escritório, que é de onde sai o statusId', async () => {
    const resposta = await getStatus(
      requisicao('/api/v1/status', { chave: chaveDeLeitura }),
    )

    expect(resposta.status).toBe(200)
    const status = (await corpoDe(resposta))['status'] as Record<string, unknown>[]
    expect(status.length).toBeGreaterThan(0)
    expect(status.map((situacao) => situacao['id'])).toContain(statusId)
  })
})

describe('cadastro e atualização (Anexo I, 3.b)', () => {
  it('a API valida igual ao painel — cadastro incompleto é recusado', async () => {
    const resposta = await postCliente(
      requisicao('/api/v1/clientes', {
        chave: chaveDeEscrita,
        metodo: 'POST',
        corpo: { documento: DOCUMENTO_NOVO, nome: 'Só o nome' },
      }),
    )

    expect(resposta.status).toBe(422)
    const corpo = await corpoDe(resposta)
    expect(corpo['erro']).toBe('dados_invalidos')
    // Os obrigatórios que o escritório definiu aparecem campo a campo.
    expect(Object.keys(corpo['campos'] as object).length).toBeGreaterThan(3)
  })

  it('cadastra o cliente completo', async () => {
    const resposta = await postCliente(
      requisicao('/api/v1/clientes', {
        chave: chaveDeEscrita,
        metodo: 'POST',
        corpo: {
          documento: '111.444.777-35',
          nome: 'Cliente cadastrado pela API',
          email: 'novo.api@exemplo.invalido',
          telefone: '11 98888-7777',
          endereco: 'Rua Exemplo, 100, São Paulo/SP',
          cep: '01310-100',
          cidade: 'São Paulo',
          uf: 'SP',
          rg: '12.345.678-9 SSP-SP',
          estadoCivil: 'solteiro',
          profissao: 'comerciante',
          nacionalidade: 'brasileiro',
          nomeMae: 'Nome da mãe',
        },
      }),
    )

    expect(resposta.status).toBe(201)
    const corpo = await corpoDe(resposta)
    expect(typeof corpo['clienteId']).toBe('string')

    const gravado = await prisma.cliente.findUnique({
      where: { documento: DOCUMENTO_NOVO },
      select: { nome: true, tipoPessoa: true },
    })
    expect(gravado?.nome).toBe('Cliente cadastrado pela API')
    // O tipo sai do próprio documento, não de um campo que o chamador escolhe.
    expect(gravado?.tipoPessoa).toBe(TipoPessoa.FISICA)
  })

  // Regra 4: o documento já cadastrado reconhece, não duplica.
  it('documento repetido: 409 com o id de quem já existe', async () => {
    const resposta = await postCliente(
      requisicao('/api/v1/clientes', {
        chave: chaveDeEscrita,
        metodo: 'POST',
        corpo: {
          documento: DOCUMENTO_EXISTENTE,
          nome: 'Tentativa de duplicar',
          email: 'x@exemplo.invalido',
          telefone: '11 90000-0000',
          endereco: 'Rua Exemplo, 1',
          cep: '01310-100',
          cidade: 'São Paulo',
          uf: 'SP',
          rg: '1 SSP-SP',
          estadoCivil: 'solteiro',
          profissao: 'x',
          nacionalidade: 'brasileiro',
          nomeMae: 'Mãe',
        },
      }),
    )

    expect(resposta.status).toBe(409)
    const corpo = await corpoDe(resposta)
    expect(corpo['erro']).toBe('conflito')
    expect(corpo['clienteId']).toBe(clienteId)
  })

  it('corpo que não é JSON: 400', async () => {
    const malformada = new NextRequest(`${BASE}/api/v1/clientes`, {
      method: 'POST',
      headers: new Headers({
        authorization: `Bearer ${chaveDeEscrita}`,
        'content-type': 'application/json',
      }),
      body: 'isto não é json',
    })

    const resposta = await postCliente(malformada)
    expect(resposta.status).toBe(400)
    expect((await corpoDe(resposta))['erro']).toBe('corpo_invalido')
  })

  it('atualiza o cliente inteiro', async () => {
    const resposta = await putCliente(
      requisicao(`/api/v1/clientes/${clienteId}`, {
        chave: chaveDeEscrita,
        metodo: 'PUT',
        corpo: {
          documento: DOCUMENTO_EXISTENTE,
          nome: 'Cliente já cadastrado (atualizado)',
          email: 'cliente.api@exemplo.invalido',
          telefone: '11 97777-6666',
          endereco: 'Rua Nova, 200',
          cep: '01310-100',
          cidade: 'São Paulo',
          uf: 'SP',
          rg: '9.876.543-2 SSP-SP',
          estadoCivil: 'casado',
          profissao: 'engenheiro',
          nacionalidade: 'brasileiro',
          nomeMae: 'Nome da mãe',
        },
      }),
      parametros(clienteId),
    )

    expect(resposta.status).toBe(200)

    const gravado = await prisma.cliente.findUnique({
      where: { id: clienteId },
      select: { nome: true },
    })
    expect(gravado?.nome).toContain('atualizado')
  })

  it('cliente inexistente na atualização: 404', async () => {
    const resposta = await putCliente(
      requisicao('/api/v1/clientes/nao-existe', {
        chave: chaveDeEscrita,
        metodo: 'PUT',
        corpo: {
          documento: DOCUMENTO_EXISTENTE,
          nome: 'Qualquer',
          email: 'x@exemplo.invalido',
          telefone: '11 90000-0000',
          endereco: 'Rua X, 1',
          cep: '01310-100',
          cidade: 'São Paulo',
          uf: 'SP',
          rg: '1 SSP-SP',
          estadoCivil: 'solteiro',
          profissao: 'x',
          nacionalidade: 'brasileiro',
          nomeMae: 'Mãe',
        },
      }),
      parametros('nao-existe'),
    )

    expect(resposta.status).toBe(404)
  })
})

describe('caso e andamento', () => {
  it('cadastra caso pelo documento, sem precisar do clienteId', async () => {
    const resposta = await postCaso(
      requisicao('/api/v1/casos', {
        chave: chaveDeEscrita,
        metodo: 'POST',
        corpo: {
          documento: '529.982.247-25',
          assunto: 'Caso criado pela API',
          vara: '3ª Vara Cível',
        },
      }),
    )

    expect(resposta.status).toBe(201)
    const corpo = await corpoDe(resposta)
    expect(corpo['clienteId']).toBe(clienteId)
    expect(typeof corpo['casoId']).toBe('string')
  })

  it('documento que não é de cliente nenhum: 404', async () => {
    const resposta = await postCaso(
      requisicao('/api/v1/casos', {
        chave: chaveDeEscrita,
        metodo: 'POST',
        corpo: { documento: DOCUMENTO_DE_NINGUEM, assunto: 'Não deve nascer' },
      }),
    )

    expect(resposta.status).toBe(404)
  })

  /**
   * Regra 6: andamento sem autor identificado não serve de prova de
   * diligência. Lançado por API, o autor é a própria chave.
   */
  it('o andamento lançado pela API tem autor, e o autor é a chave', async () => {
    const resposta = await postAndamento(
      requisicao(`/api/v1/casos/${casoId}/andamentos`, {
        chave: chaveDeEscrita,
        metodo: 'POST',
        corpo: {
          data: '2026-09-01',
          statusId,
          descricao: 'Andamento lançado pela integração de teste.',
        },
      }),
      parametros(casoId),
    )

    expect(resposta.status).toBe(201)
    const andamentoId = (await corpoDe(resposta))['andamentoId'] as string

    const gravado = await prisma.andamento.findUnique({
      where: { id: andamentoId },
      select: { autor: { select: { nome: true, email: true } } },
    })

    expect(gravado?.autor.nome).toBe(`API · ${NOMES_DAS_CHAVES[1]}`)
    // O usuário da credencial não tem e-mail: não entra por tela nenhuma.
    expect(gravado?.autor.email).toBeNull()
  })

  it('a auditoria registra quem lançou', async () => {
    const registro = await prisma.auditoria.findFirst({
      where: { entidade: 'andamento' },
      orderBy: { criadoEm: 'desc' },
      select: { usuarioEmail: true },
    })

    expect(registro?.usuarioEmail).toBe(`API · ${NOMES_DAS_CHAVES[1]}`)
  })

  it('data no futuro é recusada, como no painel', async () => {
    const resposta = await postAndamento(
      requisicao(`/api/v1/casos/${casoId}/andamentos`, {
        chave: chaveDeEscrita,
        metodo: 'POST',
        corpo: {
          data: '2099-01-01',
          statusId,
          descricao: 'Isto seria previsão, não andamento.',
        },
      }),
      parametros(casoId),
    )

    expect(resposta.status).toBe(422)
    const campos = (await corpoDe(resposta))['campos'] as Record<string, string>
    expect(campos['data']).toMatch(/futuro/i)
  })

  it('statusId fora da lista do escritório: 422 apontando /api/v1/status', async () => {
    const resposta = await postAndamento(
      requisicao(`/api/v1/casos/${casoId}/andamentos`, {
        chave: chaveDeEscrita,
        metodo: 'POST',
        corpo: {
          data: '2026-09-01',
          statusId: 'inventado',
          descricao: 'Situação que o escritório não cadastrou.',
        },
      }),
      parametros(casoId),
    )

    expect(resposta.status).toBe(422)
    const campos = (await corpoDe(resposta))['campos'] as Record<string, string>
    expect(campos['statusId']).toContain('/api/v1/status')
  })

  it('caso inexistente: 404', async () => {
    const resposta = await postAndamento(
      requisicao('/api/v1/casos/nao-existe/andamentos', {
        chave: chaveDeEscrita,
        metodo: 'POST',
        corpo: { data: '2026-09-01', statusId, descricao: 'Não deve ser lançado.' },
      }),
      parametros('nao-existe'),
    )

    expect(resposta.status).toBe(404)
  })
})

describe('revogação', () => {
  it('a chave revogada para de funcionar na hora', async () => {
    const antes = await getCredencial(
      requisicao('/api/v1/credencial', { chave: chaveDeLeitura }),
    )
    expect(antes.status).toBe(200)

    const resultado = await revogarCredencial(
      sessaoDoAdmin,
      credencialDeLeituraId,
      EMAIL_DO_ADMIN,
    )
    expect(resultado.situacao).toBe('revogada')

    const depois = await getCredencial(
      requisicao('/api/v1/credencial', { chave: chaveDeLeitura }),
    )
    expect(depois.status).toBe(401)
  })

  it('o operador não revoga', async () => {
    await expect(
      revogarCredencial(sessaoDeOperador, credencialDeLeituraId, null),
    ).rejects.toBeInstanceOf(SemAutorizacao)
  })

  it('a linha continua, para a auditoria não perder o autor', async () => {
    const credencial = await prisma.credencialApi.findUnique({
      where: { id: credencialDeLeituraId },
      select: { revogadoEm: true },
    })
    expect(credencial).not.toBeNull()
    expect(credencial?.revogadoEm).not.toBeNull()
  })
})
