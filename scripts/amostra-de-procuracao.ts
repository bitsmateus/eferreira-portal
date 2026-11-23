/**
 * Gera PDFs de amostra da procuração, sem banco — `npx tsx scripts/amostra-de-procuracao.ts <pasta>`.
 * Usa os mesmos modelos, o mesmo preenchimento e o mesmo Chromium da geração
 * de verdade, com dados inventados. Serve para conferir o layout à vista.
 */

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { TipoDocumento, TipoPessoa } from '@prisma/client'

import { ADVOGADOS } from '../src/lib/escritorio'
import { montarModelo, preencherModelo, valoresDoDocumento, type ClienteParaDocumento } from '../src/lib/modelos'
import { gerarPdf, lerModelo, montarPaginaTimbrada } from '../src/lib/pdf'
import { lerPaginasDoPdf } from '../src/lib/posicao-da-assinatura'

const pasta = process.argv[2] ?? '.'

const pessoa: ClienteParaDocumento = {
  nome: 'Fulano de Tal da Silva',
  tipoPessoa: TipoPessoa.FISICA,
  documento: '52998224725',
  nacionalidade: 'brasileiro',
  estadoCivil: 'Casado',
  profissao: 'engenheiro',
  nomeMae: null,
  rg: '12.345.678-9 SSP/SP',
  email: 'fulano@exemplo.com.br',
  telefone: '11987654321',
  endereco: 'Rua das Flores, nº 100, apto. 12, Centro',
  cidade: 'São Paulo',
  uf: 'SP',
  cep: '01310100',
}
const empresa: ClienteParaDocumento = {
  ...pessoa,
  nome: 'Exemplo Consultoria Ltda',
  tipoPessoa: TipoPessoa.JURIDICA,
  documento: '11222333000181',
  nacionalidade: null,
  estadoCivil: null,
  rg: null,
}
const socio = {
  nome: 'Sicrano de Tal',
  documento: '39053344705',
  nacionalidade: 'brasileiro',
  rg: '22.588.089-1 SSP/SP',
  qualificacao: 'sócio',
  estadoCivil: 'Casado',
  profissao: 'empresário',
  email: null,
  telefone: null,
  endereco: null,
  cidade: null,
  uf: null,
  cep: null,
}
const tres = [
  ADVOGADOS[0]!,
  { id: 'lucas', nome: 'Dr. Lucas Bernardo Gomes', feminino: false, qualificacao: '', oab: '549.397', oabUf: 'SP' },
  { id: 'joyce', nome: 'Dra. Joyce Mayara Corrêa', feminino: true, qualificacao: '', oab: '450.640', oabUf: 'SP' },
]

async function amostra(nome: string, cliente: ClienteParaDocumento, rep: typeof socio | null, variante: 'pf' | 'pj', advogados: typeof tres) {
  const modelo = await montarModelo(lerModelo, TipoDocumento.PROCURACAO, variante, null, advogados.length)
  const preenchido = preencherModelo(modelo, valoresDoDocumento(cliente, rep, null, new Date(), advogados))
  if (!preenchido.ok) throw new Error(`faltou: ${preenchido.faltando.join(', ')}`)
  const { html, timbre } = await montarPaginaTimbrada(preenchido.html, 'Procuração')
  const pdf = await gerarPdf(html, timbre)
  writeFileSync(join(pasta, `${nome}.pdf`), pdf)
  console.log(`${nome}.pdf — ${(await lerPaginasDoPdf(pdf)).length} página(s)`)
}

async function principal() {
  await amostra('procuracao-pf-tres-advogados', pessoa, null, 'pf', tres)
  await amostra('procuracao-pj-um-advogado', empresa, socio, 'pj', tres.slice(0, 1))
}

principal().then(
  () => process.exit(0),
  (erro: unknown) => {
    console.error(erro)
    process.exit(1)
  },
)
