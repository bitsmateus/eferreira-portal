import { afterEach, describe, expect, it } from 'vitest'
import { PapelDaParte, ProvedorAssinatura, SituacaoDoEnvio, TipoDocumento } from '@prisma/client'

import {
  ancoraDaParte,
  podeReenviarPelaZapSign,
  rubricasDosAvulsos,
  type ParteQueAssina,
} from '@/lib/assinaturas'
import { provedorEscolhido } from '@/lib/provedor-de-assinatura'
import {
  AUTENTICACAO_PADRAO,
  FalhaNaZapSign,
  TAMANHO_DA_ASSINATURA,
  corpoDoDocumento,
  descreverFalhaDaZapSign,
  exigirSelfie,
  interpretarDocumento,
  modoDeAutenticacao,
  rubricaDaPosicao,
  tokenDoAviso,
} from '@/lib/zapsign'

const PEDIDO = {
  nome: 'Contrato — Maria',
  pdf: new Uint8Array([37, 80, 68, 70]),
  idExterno: 'doc-1',
  mensagem: 'Contrato — Maria',
  signatarios: [
    { nome: 'Maria', email: 'maria@x.com', qualificacao: 'Cliente', ancora: '[[assina:parte]]' },
    {
      nome: 'Dr. Sergio',
      email: 'contato@eferreira.adv.br',
      qualificacao: 'Escritório',
      ancora: '[[assina:escritorio]]',
    },
    { nome: 'Testemunha', email: 't@x.com', qualificacao: 'Testemunha', ancora: null },
  ],
}

afterEach(() => {
  delete process.env['ASSINATURA_PROVEDOR']
})

describe('corpo do documento na ZapSign', () => {
  it('PDF em base64 puro, id do portal e pasta própria', () => {
    const corpo = corpoDoDocumento(PEDIDO)
    expect(corpo['base64_pdf']).toBe('JVBERg==')
    expect(corpo['external_id']).toBe('doc-1')
    expect(corpo['lang']).toBe('pt-br')
  })

  it('cada um com e-mail automático, nome travado, sem selfie e a âncora do seu lugar', () => {
    const [cliente, escritorio, testemunha] = corpoDoDocumento(PEDIDO)['signers'] as Record<
      string,
      unknown
    >[]
    expect(cliente).toMatchObject({
      name: 'Maria',
      auth_mode: AUTENTICACAO_PADRAO,
      require_selfie_photo: false,
      send_automatic_email: true,
      lock_name: true,
      lock_email: true,
      qualification: 'Cliente',
      signature_placement: '[[assina:parte]]',
    })
    expect(escritorio?.['signature_placement']).toBe('[[assina:escritorio]]')
    // testemunha sem lugar marcado: fica no relatório de assinaturas
    expect(testemunha).not.toHaveProperty('signature_placement')
  })

  it('duas pessoas na mesma âncora: só a primeira, para não sobrepor', () => {
    const corpo = corpoDoDocumento({
      ...PEDIDO,
      signatarios: [
        { nome: 'A', email: 'a@x.com', qualificacao: 'Cliente', ancora: '[[assina:parte]]' },
        { nome: 'B', email: 'b@x.com', qualificacao: 'Cliente', ancora: '[[assina:parte]]' },
      ],
    })
    const [a, b] = corpo['signers'] as Record<string, unknown>[]
    expect(a?.['signature_placement']).toBe('[[assina:parte]]')
    expect(b).not.toHaveProperty('signature_placement')
  })

  it('nada de validação biométrica (custo extra), nem com a selfie religada', () => {
    for (const s of corpoDoDocumento(PEDIDO, AUTENTICACAO_PADRAO, true)['signers'] as Record<string, unknown>[]) {
      expect(s).not.toHaveProperty('selfie_validation_type')
    }
  })
})

describe('configuração por variável', () => {
  it('selfie tirada em 25/11/2026: desligada por padrão; "1" religa', () => {
    expect(exigirSelfie(undefined)).toBe(false)
    expect(exigirSelfie('')).toBe(false)
    expect(exigirSelfie('0')).toBe(false)
    expect(exigirSelfie('1')).toBe(true)
  })

  it('forma de identificação: padrão, da lista, e valor inválido cai no padrão', () => {
    expect(modoDeAutenticacao(undefined)).toBe('assinaturaTela-tokenEmail')
    expect(modoDeAutenticacao('tokenWhatsapp')).toBe('tokenWhatsapp')
    expect(modoDeAutenticacao('selfie')).toBe(AUTENTICACAO_PADRAO)
  })

  it('a plataforma dos envios novos continua a D4Sign até a chave virar', () => {
    expect(provedorEscolhido(undefined)).toBe(ProvedorAssinatura.D4SIGN)
    expect(provedorEscolhido(' ZapSign ')).toBe(ProvedorAssinatura.ZAPSIGN)
  })
})

describe('leitura do documento na ZapSign', () => {
  const signers = [
    { email: 'a@x.com', status: 'signed' },
    { email: 'b@x.com', status: 'link-opened' },
  ]

  it('pendente: conta quem assinou e não expõe arquivo', () => {
    const d = interpretarDocumento({ status: 'pending', signers, signed_file: 'https://x' })
    expect(d).toMatchObject({ situacao: 'aguardando', assinaram: 1, totalSignatarios: 2 })
    expect(d.arquivoAssinado).toBeNull()
  })

  it('assinado: traz o link do arquivo', () => {
    const d = interpretarDocumento({ status: 'signed', signers, signed_file: 'https://s3/a.pdf' })
    expect(d.situacao).toBe('assinado')
    expect(d.arquivoAssinado).toBe('https://s3/a.pdf')
  })

  it('recusado (refused/recusado) e excluído são cancelamento', () => {
    expect(interpretarDocumento({ status: 'refused' }).situacao).toBe('cancelado')
    expect(interpretarDocumento({ status: 'recusado' }).situacao).toBe('cancelado')
    expect(interpretarDocumento({ status: 'pending', deleted: true }).situacao).toBe('cancelado')
  })
})

describe('posição por coordenada (documento avulso)', () => {
  it('página: 0 é a última, 1 é a primeira, e a ZapSign conta a partir de 0', () => {
    const ultima = rubricaDaPosicao({ pagina: 0, lado: 'centro', alturaEmPercentual: 85 }, 3, 't')
    const primeira = rubricaDaPosicao({ pagina: 1, lado: 'centro', alturaEmPercentual: 85 }, 3, 't')
    const foraDoDocumento = rubricaDaPosicao({ pagina: 9, lado: 'centro', alturaEmPercentual: 85 }, 3, 't')
    expect(ultima.page).toBe(2)
    expect(primeira.page).toBe(0)
    expect(foraDoDocumento.page).toBe(2)
  })

  it('origem embaixo à esquerda: altura medida do topo vira distância do pé', () => {
    const r = rubricaDaPosicao({ pagina: 1, lado: 'centro', alturaEmPercentual: 85 }, 1, 'tok')
    // centro horizontal em 50%, centro vertical a 15% do pé
    expect(r.relative_position_left).toBeCloseTo(50 - TAMANHO_DA_ASSINATURA.x / 2, 2)
    expect(r.relative_position_bottom).toBeCloseTo(15 - TAMANHO_DA_ASSINATURA.y / 2, 2)
    expect(r.signer_token).toBe('tok')
  })

  it('nunca sai da página', () => {
    const r = rubricaDaPosicao({ pagina: 1, lado: 'direita', alturaEmPercentual: 95 }, 1, 't')
    expect(r.relative_position_bottom).toBeGreaterThanOrEqual(0)
    expect(r.relative_position_left + r.relative_size_x).toBeLessThanOrEqual(100)
  })

  it('sem escolha, cada um num lado da última página', () => {
    const partes: ParteQueAssina[] = [
      { papel: PapelDaParte.PARTE_CONTRARIA, nome: 'A', email: 'a@x.com' },
      { papel: PapelDaParte.TESTEMUNHA, nome: 'B', email: 'b@x.com' },
    ]
    const rubricas = rubricasDosAvulsos(partes, [], 2, [
      { email: 'a@x.com', token: 'ta' },
      { email: 'b@x.com', token: 'tb' },
    ])
    expect(rubricas.map((r) => r.signer_token)).toEqual(['ta', 'tb'])
    expect(rubricas.every((r) => r.page === 1)).toBe(true)
    expect(rubricas[0]?.relative_position_left).not.toBe(rubricas[1]?.relative_position_left)
  })
})

describe('âncora de cada parte', () => {
  const parte = (papel: ParteQueAssina['papel']): ParteQueAssina => ({ papel, nome: 'X', email: 'x@x.com' })

  it('cliente e representante na marca da parte; escritório na dele; testemunha sem', () => {
    expect(ancoraDaParte(TipoDocumento.CONTRATO, parte('cliente'))).toBe('[[assina:parte]]')
    expect(ancoraDaParte(TipoDocumento.PROCURACAO, parte('representante'))).toBe('[[assina:parte]]')
    expect(ancoraDaParte(TipoDocumento.CONTRATO, parte('escritorio'))).toBe('[[assina:escritorio]]')
    expect(ancoraDaParte(TipoDocumento.CONTRATO, parte(PapelDaParte.TESTEMUNHA))).toBeNull()
  })

  it('documento avulso não usa âncora: vai por coordenada', () => {
    expect(ancoraDaParte(TipoDocumento.ANEXO, parte(PapelDaParte.PARTE_CONTRARIA))).toBeNull()
  })
})

describe('reenvio pela ZapSign do que ficou pendente na D4Sign', () => {
  const pendente = { provedor: ProvedorAssinatura.D4SIGN, situacao: SituacaoDoEnvio.AGUARDANDO }

  it('com a ZapSign desligada, nunca — nada na D4Sign é tocado antes de tudo pronto', () => {
    expect(podeReenviarPelaZapSign(pendente, false)).toBe(false)
  })

  it('ligada: só o que está aguardando na D4Sign', () => {
    expect(podeReenviarPelaZapSign(pendente, true)).toBe(true)
    expect(podeReenviarPelaZapSign({ ...pendente, situacao: SituacaoDoEnvio.ASSINADO }, true)).toBe(false)
    expect(podeReenviarPelaZapSign({ ...pendente, situacao: SituacaoDoEnvio.NO_COFRE }, true)).toBe(false)
    expect(podeReenviarPelaZapSign({ ...pendente, provedor: ProvedorAssinatura.ZAPSIGN }, true)).toBe(false)
    expect(podeReenviarPelaZapSign(null, true)).toBe(false)
  })
})

describe('aviso e mensagens', () => {
  it('do aviso só sai o token do documento', () => {
    expect(tokenDoAviso({ token: ' abc ', status: 'signed', signed_file: 'x' })).toBe('abc')
    expect(tokenDoAviso({ event_type: 'doc_signed' })).toBeNull()
    expect(tokenDoAviso(null)).toBeNull()
  })

  it('falhas viram frase para a tela, sem token', () => {
    expect(descreverFalhaDaZapSign(new FalhaNaZapSign(402, '{}', 'criar'))).toMatch(/plano/)
    expect(
      descreverFalhaDaZapSign(new FalhaNaZapSign(401, JSON.stringify({ detail: 'Token inválido' }), 'criar')),
    ).toMatch(/chave.*Token inválido/)
    expect(descreverFalhaDaZapSign(new FalhaNaZapSign(503, '', 'consultar'))).toMatch(/instável/)
  })
})
