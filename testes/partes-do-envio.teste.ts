import { describe, expect, it } from 'vitest'
import { PapelDaParte, TipoDocumento, TipoPessoa } from '@prisma/client'

import { partesDoEnvio, partesQueAssinam } from '@/lib/assinaturas'

const CLIENTE = {
  nome: 'Joana Ribeiro',
  email: 'joana@exemplo.com.br',
  tipoPessoa: TipoPessoa.FISICA,
}

const TESTEMUNHA = {
  nome: 'Testemunha Um',
  email: 'testemunha1@exemplo.com.br',
  papel: PapelDaParte.TESTEMUNHA,
}

const PARTE_CONTRARIA = {
  nome: 'Parte Contrária',
  email: 'contraria@exemplo.com.br',
  papel: PapelDaParte.PARTE_CONTRARIA,
}

describe('partesDoEnvio — quem recebe o e-mail de assinatura', () => {
  // O escritório confirmou em 21/09/2026: testemunha assina eletronicamente
  // nos documentos avulsos e no contrato de honorários.
  it('contrato: cliente, escritório e as testemunhas escolhidas na tela', () => {
    const automaticas = partesQueAssinam(TipoDocumento.CONTRATO, CLIENTE, null)

    const partes = partesDoEnvio(TipoDocumento.CONTRATO, automaticas, [
      TESTEMUNHA,
      { ...TESTEMUNHA, nome: 'Testemunha Dois', email: 'testemunha2@exemplo.com.br' },
    ])

    expect(partes.map((parte) => parte.papel)).toEqual([
      'cliente',
      'escritorio',
      PapelDaParte.TESTEMUNHA,
      PapelDaParte.TESTEMUNHA,
    ])
    expect(partes.map((parte) => parte.email)).toContain('testemunha2@exemplo.com.br')
  })

  it('contrato sem testemunha escolhida continua saindo só com cliente e escritório', () => {
    const automaticas = partesQueAssinam(TipoDocumento.CONTRATO, CLIENTE, null)

    expect(partesDoEnvio(TipoDocumento.CONTRATO, automaticas, [])).toEqual(automaticas)
  })

  // O JSON vem do navegador: o papel que ele traz não decide o papel de
  // ninguém no contrato (regra 2).
  it('no contrato, quem a tela mandou entra SEMPRE como testemunha', () => {
    const automaticas = partesQueAssinam(TipoDocumento.CONTRATO, CLIENTE, null)

    const partes = partesDoEnvio(TipoDocumento.CONTRATO, automaticas, [PARTE_CONTRARIA])

    expect(partes.at(-1)?.papel).toBe(PapelDaParte.TESTEMUNHA)
  })

  it('anexo: só quem a tela mandou, com o papel escolhido lá', () => {
    const partes = partesDoEnvio(TipoDocumento.ANEXO, [], [TESTEMUNHA, PARTE_CONTRARIA])

    expect(partes.map((parte) => parte.papel)).toEqual([
      PapelDaParte.TESTEMUNHA,
      PapelDaParte.PARTE_CONTRARIA,
    ])
  })

  it('procuração e declaração ignoram o que a tela mandar', () => {
    for (const tipo of [TipoDocumento.PROCURACAO, TipoDocumento.DECLARACAO]) {
      const automaticas = partesQueAssinam(tipo, CLIENTE, null)

      expect(partesDoEnvio(tipo, automaticas, [TESTEMUNHA])).toEqual(automaticas)
    }
  })
})
