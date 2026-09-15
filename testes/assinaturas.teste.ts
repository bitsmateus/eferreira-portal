import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TipoDocumento, TipoPessoa } from '@prisma/client'

import {
  ACAO_ASSINAR,
  emailDoEscritorio,
  mensagemDoEnvio,
  nomeDoAssinado,
  papeisSemEmail,
  partesQueAssinam,
} from '@/lib/assinaturas'
import {
  FalhaNaD4Sign,
  baixarAssinado,
  configuracaoD4Sign,
  subirDocumento,
  type ConfiguracaoD4Sign,
} from '@/lib/d4sign'
import { ESCRITORIO } from '@/lib/escritorio'

const PESSOA_FISICA = {
  nome: 'Joana Ribeiro',
  email: 'joana@exemplo.com.br',
  tipoPessoa: TipoPessoa.FISICA,
}

const EMPRESA = {
  nome: 'Padaria Aurora Ltda',
  email: 'contato@aurora.com.br',
  tipoPessoa: TipoPessoa.JURIDICA,
}

const SOCIO = { nome: 'Carlos Aurora', email: 'carlos@aurora.com.br' }

describe('quem assina cada documento', () => {
  // Procuração e declaração são declarações do cliente. O escritório é
  // destinatário delas, não parte que assina.
  it('procuração e declaração vão só para o cliente', () => {
    for (const tipo of [TipoDocumento.PROCURACAO, TipoDocumento.DECLARACAO]) {
      const partes = partesQueAssinam(tipo, PESSOA_FISICA, null)
      expect(partes).toHaveLength(1)
      expect(partes[0]?.papel).toBe('cliente')
      expect(partes[0]?.email).toBe('joana@exemplo.com.br')
    }
  })

  // O contrato é bilateral: as duas partes assinam.
  it('o contrato vai para o cliente e para o escritório', () => {
    const partes = partesQueAssinam(TipoDocumento.CONTRATO, PESSOA_FISICA, null)

    expect(partes.map((parte) => parte.papel)).toEqual(['cliente', 'escritorio'])
    expect(partes[1]?.email).toBe(emailDoEscritorio())
  })

  // Empresa não assina: quem assina por ela é o representante legal. Mandar o
  // documento para a empresa em vez do sócio é assinatura de quem não pode.
  it('na pessoa jurídica quem assina é o representante, não a empresa', () => {
    const partes = partesQueAssinam(TipoDocumento.PROCURACAO, EMPRESA, SOCIO)

    expect(partes).toHaveLength(1)
    expect(partes[0]?.papel).toBe('representante')
    expect(partes[0]?.nome).toBe('Carlos Aurora')
    expect(partes[0]?.email).toBe('carlos@aurora.com.br')
  })

  it('sem e-mail próprio do sócio, vale o da empresa', () => {
    const partes = partesQueAssinam(TipoDocumento.PROCURACAO, EMPRESA, {
      nome: 'Carlos Aurora',
      email: null,
    })

    expect(partes[0]?.email).toBe('contato@aurora.com.br')
  })

  // Anexo é arquivo que o escritório recebeu, não documento que ele emitiu.
  it('anexo não vai para assinatura nenhuma', () => {
    expect(partesQueAssinam(TipoDocumento.ANEXO, PESSOA_FISICA, null)).toEqual([])
  })

  // As testemunhas do contrato ficam no papel — decisão de 14/09/2026. Se um
  // dia entrarem, este teste falha e obriga quem mexer a reler a decisão.
  it('não inclui testemunhas', () => {
    const partes = partesQueAssinam(TipoDocumento.CONTRATO, PESSOA_FISICA, null)
    expect(partes).toHaveLength(2)
  })

  it('o código da ação é sempre "assinar"', () => {
    expect(ACAO_ASSINAR).toBe('1')
  })
})

describe('papeisSemEmail', () => {
  // O envio não sai sem endereço: a D4Sign aceitaria a lista e o documento
  // ficaria parado para sempre, com o crédito já gasto.
  it('aponta quem está sem endereço, pelo papel', () => {
    const partes = partesQueAssinam(
      TipoDocumento.CONTRATO,
      { ...PESSOA_FISICA, email: null },
      null,
    )

    expect(papeisSemEmail(partes)).toEqual(['Cliente'])
  })

  it('e-mail em branco conta como ausente', () => {
    expect(
      papeisSemEmail([{ papel: 'cliente', nome: 'Alguém', email: '   ' }]),
    ).toEqual(['Cliente'])
  })

  it('não aponta nada quando está tudo preenchido', () => {
    const partes = partesQueAssinam(TipoDocumento.CONTRATO, PESSOA_FISICA, null)
    expect(papeisSemEmail(partes)).toEqual([])
  })
})

describe('emailDoEscritorio', () => {
  afterEach(() => {
    delete process.env['D4SIGN_EMAIL_DO_ESCRITORIO']
  })

  // Quem MANDA e-mail é contato@; quem ASSINA pelo escritório é o advogado.
  it('sem configuração, é o e-mail do advogado da procuração', () => {
    expect(emailDoEscritorio()).toBe(ESCRITORIO.emailDoAdvogado)
  })

  it('a variável de ambiente manda', () => {
    process.env['D4SIGN_EMAIL_DO_ESCRITORIO'] = 'assina@eferreira.adv.br'
    expect(emailDoEscritorio()).toBe('assina@eferreira.adv.br')
  })

  it('variável em branco não vira remetente vazio', () => {
    process.env['D4SIGN_EMAIL_DO_ESCRITORIO'] = '   '
    expect(emailDoEscritorio()).toBe(ESCRITORIO.emailDoAdvogado)
  })
})

describe('mensagemDoEnvio', () => {
  it('diz o que é e de quem vem', () => {
    const mensagem = mensagemDoEnvio(TipoDocumento.CONTRATO, 'Joana Ribeiro')

    expect(mensagem).toContain('Contrato')
    expect(mensagem).toContain('Joana Ribeiro')
    expect(mensagem).toContain(ESCRITORIO.razaoSocial)
  })
})

describe('nomeDoAssinado', () => {
  // Os dois convivem na pasta: o que foi enviado e o que voltou assinado.
  it('marca o assinado sem duplicar a extensão', () => {
    expect(nomeDoAssinado('Contrato - 123.456.789-09.pdf')).toBe(
      'Contrato - 123.456.789-09 (assinado).pdf',
    )
  })

  it('funciona com extensão em maiúsculas e sem extensão', () => {
    expect(nomeDoAssinado('Procuracao.PDF')).toBe('Procuracao (assinado).pdf')
    expect(nomeDoAssinado('Declaracao')).toBe('Declaracao (assinado).pdf')
  })
})

// ---------------------------------------------------------------------------
// A camada da D4Sign, com o `fetch` dublado. Nenhum destes testes toca a
// internet, e nenhum gasta crédito do escritório.
// ---------------------------------------------------------------------------

const CONFIGURACAO: ConfiguracaoD4Sign = {
  url: 'https://secure.d4sign.com.br/api/v1',
  tokenApi: 'live_tokensecretissimo',
  cryptKey: 'live_crypt_secretissimo',
  cofre: 'cofre-do-escritorio',
}

function responder(corpo: string, situacao = 200, cabecalhos: HeadersInit = {}) {
  return new Response(corpo, { status: situacao, headers: cabecalhos })
}

describe('configuracaoD4Sign', () => {
  // O ambiente de quem roda os testes pode ter credenciais de verdade no
  // `.env`. Sem limpar antes de cada caso, este bloco passaria na máquina de
  // um e falharia na de outro — foi assim que dois testes de banco mentiram
  // por uma sessão inteira.
  const ANTERIOR = { ...process.env }

  beforeEach(() => {
    delete process.env['D4SIGN_TOKEN_API']
    delete process.env['D4SIGN_CRYPT_KEY']
    delete process.env['D4SIGN_COFRE']
  })

  afterEach(() => {
    process.env = { ...ANTERIOR }
  })

  // Null não é erro: é o estado normal de uma instalação que ainda não assina.
  it('devolve null sem as duas credenciais', () => {
    process.env['D4SIGN_TOKEN_API'] = 'so-o-token'
    expect(configuracaoD4Sign()).toBeNull()
  })

  it('devolve null quando não há credencial nenhuma', () => {
    expect(configuracaoD4Sign()).toBeNull()
  })

  it('lê as credenciais e o cofre', () => {
    process.env['D4SIGN_TOKEN_API'] = 'token'
    process.env['D4SIGN_CRYPT_KEY'] = 'chave'
    process.env['D4SIGN_COFRE'] = 'uuid-do-cofre'

    const configuracao = configuracaoD4Sign()
    expect(configuracao?.tokenApi).toBe('token')
    expect(configuracao?.cofre).toBe('uuid-do-cofre')
  })
})

describe('as credenciais não vazam na mensagem de erro', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  /**
   * A D4Sign autentica por query, não por cabeçalho: o token e a cryptKey vão
   * dentro da URL. Em alguns erros ela devolve a própria URL chamada — e essa
   * mensagem acaba no log do servidor, que é lido por mais gente do que cofre
   * (regra 8). Este teste existe para que a limpeza nunca seja removida sem
   * alguém perceber.
   */
  it('troca o token e a cryptKey ecoados pela API', async () => {
    const eco = `Erro ao chamar ${CONFIGURACAO.url}/safes?tokenAPI=${CONFIGURACAO.tokenApi}&cryptKey=${CONFIGURACAO.cryptKey}`
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => responder(eco, 401)),
    )

    const erro = await subirDocumento(
      CONFIGURACAO,
      'cofre',
      'documento.pdf',
      new Uint8Array([1, 2, 3]),
    ).catch((falha: unknown) => falha)

    expect(erro).toBeInstanceOf(FalhaNaD4Sign)
    const mensagem = (erro as Error).message
    expect(mensagem).not.toContain(CONFIGURACAO.tokenApi)
    expect(mensagem).not.toContain(CONFIGURACAO.cryptKey)
    expect(mensagem).toContain('«tokenAPI»')
    expect(mensagem).toContain('«cryptKey»')
  })
})

describe('subirDocumento', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('devolve o uuid do documento criado no cofre', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => responder(JSON.stringify({ uuid: 'uuid-novo' }))),
    )

    const uuid = await subirDocumento(
      CONFIGURACAO,
      'cofre',
      'Contrato',
      new Uint8Array([1]),
    )
    expect(uuid).toBe('uuid-novo')
  })

  // Resposta 200 sem uuid é o pior caso: o documento pode ter subido e o
  // sistema ficaria sem como perguntar por ele depois.
  it('recusa uma resposta bem-sucedida que não traz uuid', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => responder(JSON.stringify({ message: 'cofre inválido' }))),
    )

    await expect(
      subirDocumento(CONFIGURACAO, 'cofre', 'Contrato', new Uint8Array([1])),
    ).rejects.toBeInstanceOf(FalhaNaD4Sign)
  })
})

describe('baixarAssinado', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('pede o endereço e devolve os bytes', async () => {
    const chamadas: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (entrada: string) => {
        chamadas.push(entrada)
        return entrada.includes('/download')
          ? responder(JSON.stringify({ url: 'https://arquivos.d4sign/assinado.pdf' }))
          : responder('%PDF-1.4 conteudo')
      }),
    )

    const pdf = await baixarAssinado(CONFIGURACAO, 'uuid')

    expect(pdf).not.toBeNull()
    expect(new TextDecoder().decode(pdf ?? new Uint8Array())).toContain('%PDF')
    expect(chamadas).toHaveLength(2)
  })

  // Assinado, mas sem arquivo ainda: a conferência responde "aguardando" em
  // vez de arquivar um PDF vazio na pasta do cliente.
  it('devolve null quando a D4Sign não dá endereço', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => responder(JSON.stringify({}))),
    )

    expect(await baixarAssinado(CONFIGURACAO, 'uuid')).toBeNull()
  })

  it('recusa arquivo grande demais pelo tamanho declarado', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (entrada: string) =>
        entrada.includes('/download')
          ? responder(JSON.stringify({ url: 'https://arquivos.d4sign/gigante.pdf' }))
          : responder('x', 200, { 'content-length': String(500 * 1024 * 1024) }),
      ),
    )

    await expect(baixarAssinado(CONFIGURACAO, 'uuid')).rejects.toBeInstanceOf(
      FalhaNaD4Sign,
    )
  })

  // A URL do assinado dá acesso ao documento: ela não pode ir para a mensagem
  // de erro, que vai para o log.
  it('não repete o endereço do arquivo na mensagem de erro', async () => {
    const endereco = 'https://arquivos.d4sign/token-de-acesso-do-arquivo.pdf'
    vi.stubGlobal(
      'fetch',
      vi.fn(async (entrada: string) =>
        entrada.includes('/download')
          ? responder(JSON.stringify({ url: endereco }))
          : responder('sem permissão', 403),
      ),
    )

    const erro = await baixarAssinado(CONFIGURACAO, 'uuid').catch(
      (falha: unknown) => falha,
    )

    expect(erro).toBeInstanceOf(FalhaNaD4Sign)
    expect((erro as Error).message).not.toContain(endereco)
  })
})
