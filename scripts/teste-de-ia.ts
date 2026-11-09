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
import { descricaoDoProvedor, iaConfigurada, pedirObjeto } from '../src/lib/ia'

const DESPACHO_INVENTADO = [
  'Processo de teste. Vistos.',
  'Manifeste-se a parte autora, no prazo de 15 (quinze) dias, sobre a contestação apresentada.',
  'Designo audiência de conciliação para o dia 10/12/2026, às 14h00. Intimem-se.',
].join(' ')

async function principal(): Promise<number> {
  if (!iaConfigurada()) {
    console.log('IA não configurada nesta máquina: falta a chave do provedor no .env.')
    return 1
  }
  console.log(`Provedor: ${descricaoDoProvedor() ?? '?'}`)

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
