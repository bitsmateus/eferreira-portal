/**
 * Prova da IA de verdade — `npm run ia:teste`.
 *
 * Manda ao provedor configurado (IA_PROVEDOR, ANTHROPIC_API_KEY / OPENAI_API_KEY,
 * IA_MODELO, ANTHROPIC_WORKSPACE_ID) o MESMO pedido que a fila de publicações
 * manda — instruções, esquema e validação —, com um despacho inventado. Nenhum
 * dado de processo real sai da máquina, e nada é gravado no banco.
 *
 * Custa uma chamada (centavos). A chave nunca aparece na saída (regra 8).
 */

import 'dotenv/config'
import {
  ESQUEMA_DA_ANALISE,
  INSTRUCOES_DO_SISTEMA,
  lerAnalise,
  mensagemDoUsuario,
} from '../src/lib/analise-da-publicacao'
import { AreaDoCaso } from '@prisma/client'

import { lerAgente } from '../src/lib/agentes'
import { descricaoDoProvedor, iaConfigurada, pedirObjeto, pedirTexto } from '../src/lib/ia'
import { montarPedidoDaMinuta, separarMinutaENota } from '../src/lib/minuta'

const DESPACHO_INVENTADO = [
  'Processo de teste. Vistos.',
  'Manifeste-se a parte autora, no prazo de 15 (quinze) dias, sobre a contestação apresentada.',
  'Designo audiência de conciliação para o dia 10/12/2026, às 14h00. Intimem-se.',
].join(' ')

/**
 * `npm run ia:teste -- minuta`: a minuta de verdade, com pesquisa na web, pelo
 * agente trabalhista e o mesmo despacho inventado. Custa mais (buscas e texto
 * longo) e leva alguns minutos.
 */
async function provaDaMinuta(): Promise<number> {
  const agente = await lerAgente(AreaDoCaso.TRABALHISTA)
  const { sistema, usuario } = montarPedidoDaMinuta(agente, {
    area: AreaDoCaso.TRABALHISTA,
    hoje: new Date().toISOString().slice(0, 10),
    pesquisaNaWeb: true,
    publicacao: {
      siglaTribunal: 'TRT2',
      orgao: 'Vara de teste',
      classe: 'Ação Trabalhista - Rito Ordinário',
      tipoComunicacao: 'Intimação',
      tipoDocumento: 'Despacho',
      numeroProcesso: '00000000020265020000',
      disponibilizacao: '2026-11-05',
      texto: DESPACHO_INVENTADO,
    },
    caso: null,
    analise: null,
  })
  const inicio = Date.now()
  const resposta = await pedirTexto({ sistema, usuario, pesquisaNaWeb: true })
  if (!resposta.ok) {
    console.log(`FALHOU: ${resposta.erro}`)
    return 1
  }
  const { minuta, nota } = separarMinutaENota(resposta.texto)
  console.log(`OK em ${Math.round((Date.now() - inicio) / 1000)}s — ${resposta.buscas} busca(s), ${resposta.fontes.length} fonte(s).`)
  console.log(`Minuta: ${minuta.length} caracteres. Nota: ${nota === null ? 'AUSENTE' : `${nota.length} caracteres`}.`)
  console.log(minuta.slice(0, 600))
  return 0
}

async function principal(): Promise<number> {
  if (!iaConfigurada()) {
    console.log('IA não configurada nesta máquina: falta a chave do provedor no .env.')
    return 1
  }
  console.log(`Provedor: ${descricaoDoProvedor() ?? '?'}`)
  if (process.argv.includes('minuta')) return provaDaMinuta()

  const resposta = await pedirObjeto({
    sistema: INSTRUCOES_DO_SISTEMA,
    usuario: mensagemDoUsuario({
      siglaTribunal: 'TJSP',
      orgao: 'Vara de teste',
      tipoComunicacao: 'Intimação',
      tipoDocumento: 'Despacho',
      classe: 'Procedimento Comum Cível',
      numeroProcesso: '00000000020268260000',
      disponibilizacao: '2026-11-05',
      texto: DESPACHO_INVENTADO,
    }),
    nome: 'registrar_analise',
    descricao: 'Registra a análise da publicação para a equipe do escritório conferir.',
    esquema: ESQUEMA_DA_ANALISE as unknown as Record<string, unknown>,
  })

  if (!resposta.ok) {
    console.log(`FALHOU: ${resposta.erro}`)
    return 1
  }
  const analise = lerAnalise(resposta.dados)
  if (analise === null) {
    console.log('FALHOU: o provedor respondeu, mas fora do formato esperado:')
    console.log(JSON.stringify(resposta.dados, null, 2))
    return 1
  }
  console.log('OK — análise no formato que a fila usa:')
  console.log(JSON.stringify(analise, null, 2))
  return 0
}

principal().then(
  (codigo) => process.exit(codigo),
  (erro: unknown) => {
    console.log(`FALHOU: ${erro instanceof Error ? erro.message : String(erro)}`)
    process.exit(1)
  },
)
