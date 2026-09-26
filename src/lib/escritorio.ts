/**
 * Dados fixos do escritório, usados nos documentos gerados.
 *
 * Vieram dos modelos enviados em 14/09/2026. Ficam aqui, e não em variável de
 * ambiente, porque nada disto é segredo: tudo é impresso em todo contrato que
 * o escritório manda para cliente. A regra 8 trata de credencial, não de
 * papel timbrado.
 *
 * Quando a tela de administração chegar, isto deve virar configuração editável
 * pelo administrador — hoje, mudar o telefone do escritório exige nova versão
 * do sistema, o que não é razoável a longo prazo.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DIVERGÊNCIA DE ENDEREÇO — RESOLVIDA em 14/09/2026
 *
 * Os modelos antigos traziam dois endereços profissionais diferentes. O
 * escritório confirmou por escrito qual vale:
 *
 *   "Rua Olegário Paiva, 180, 4º andar, sala 411 — Mogi das Cruzes/SP —
 *    CEP 08780-040 — este é o correto"
 *
 * A procuração nova (arquivo de 14/09/2026) traz o mesmo endereço, agora com
 * o bairro: Centro. É esse o adotado aqui.
 *
 * ATENÇÃO: a CIDADE DA ASSINATURA não sai daqui. O escritório definiu que ela
 * vem do cadastro do CLIENTE — "o que define a cidade/estado da assinatura é o
 * cadastro do cliente". Ver `cliente.cidade` em `src/lib/modelos.ts`.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ─────────────────────────────────────────────────────────────────────────
 * OS DOIS CONTATOS SÃO DIFERENTES, E É DE PROPÓSITO
 *
 * O papel timbrado e o contrato trazem o telefone e o e-mail do ESCRITÓRIO;
 * a procuração nova traz o WhatsApp e o e-mail pessoais do ADVOGADO. Não é
 * divergência: são quatro dados distintos, e cada documento cita os seus.
 * Guardados separadamente para nenhum acabar no lugar do outro.
 * ─────────────────────────────────────────────────────────────────────────
 */

export const ESCRITORIO = {
  /** Razão social que assina o contrato. */
  razaoSocial: 'Sergio E. Ferreira Sociedade Individual de Advocacia',
  registroOab: '69.212',
  /** CNPJ da sociedade, como no contrato de 24/09/2026. */
  cnpj: '67.706.981/0001-68',

  advogado: 'Dr. Sergio Evangelista Ferreira',
  /** Como o contrato de 24/09/2026 cita o advogado: no cabeçalho e na assinatura. */
  advogadoNoContrato: 'Sérgio E. Ferreira',
  /** Qualificação pessoal do advogado, como consta na procuração. */
  advogadoQualificacao: 'brasileiro, solteiro, advogado',
  oab: '378.532',
  /** Contatos pessoais do advogado, citados na procuração. */
  emailDoAdvogado: 'sergioferreira@eferreira.adv.br',
  whatsapp: '11 93806.3696',

  /**
   * Número do botão "Fale conosco" do portal do cliente (`/consultar` e
   * `/meus-processos`), passado pelo escritório em 17/09/2026. É um número
   * DIFERENTE do `whatsapp` do advogado acima (aquele é o pessoal dele, citado
   * na procuração) — os dois convivem porque servem propósitos diferentes:
   * este é o suporte geral, aquele é a assinatura de um documento específico.
   * Vale confirmar com o escritório se a intenção era mesmo dois números.
   */
  whatsappDeSuporte: '11 4580-3696',

  endereco: 'Rua Olegário Paiva, nº 180, 4º andar, Sala 411, Centro',
  cidade: 'Mogi das Cruzes',
  uf: 'SP',
  cep: '08780-040',
  /** Comarca do foro, como consta na cláusula de foro do contrato. */
  comarca: 'São Paulo - SP',

  // Contatos do escritório, como aparecem no papel timbrado.
  telefone: '(11) 4580-3696',
  email: 'contato@eferreira.adv.br',
  site: 'eferreira.adv.br',

  /**
   * Dados de pagamento do item 3.5 do contrato — texto do escritório, que
   * mandou a cláusula nova em 25/09/2026 ("Contrato ... (1).docx"), com a conta
   * do próprio escritório (a Eferreira Assessoria e Cobrança e o C6, que
   * constavam antes, saíram). Estão aqui, e não no HTML, para trocar de conta
   * ser mudar um lugar só.
   */
  favorecido: 'SERGIO E. FERREIRA SOCIEDADE INDIVIDUAL DE ADVOCACIA',
  instituicaoDePagamento: 'Nu Pagamentos S.A. — código 260',
  agenciaDePagamento: '0001',
  contaDePagamento: '278408077-1',
  chavePixDePagamento: 'financeiro@eferreira.adv.br',
} as const

export type DadosDoEscritorio = typeof ESCRITORIO

/**
 * A mensagem que já chega escrita na conversa do botão "Fale conosco pelo
 * WhatsApp" (`whatsappDeSuporte`, acima) — pedido do escritório em
 * 22/09/2026, para quem atende já saber de onde a pessoa veio e o que
 * precisa, sem repetir pergunta. A pessoa ainda decide se manda como está.
 */
export const MENSAGEM_DE_SUPORTE_NO_WHATSAPP =
  'Olá! Vim pelo site do Portal do Cliente e preciso de ajuda para acessar.'

/**
 * O OUTORGADO da procuração. Desde 25/09/2026 quem cadastra os advogados é a
 * equipe, na tela "Advogados" (`src/lib/advogados.ts`); o que está aqui é só
 * o FORMATO e os dois advogados de sempre, usados como padrão quando o banco
 * ainda está vazio e nos testes das funções puras.
 *
 * O e-mail e o telefone que a procuração cita são os do ESCRITÓRIO
 * (`ESCRITORIO.email`/`telefone`), iguais para qualquer advogado.
 */
export type AdvogadoOutorgado = {
  id: string
  nome: string
  /** Concordância do texto: "outorgada", "inscrita", "sua bastante procuradora". */
  feminino: boolean
  /** Como entra depois do nome: "brasileiro, solteiro, advogado". */
  qualificacao: string
  oab: string
  /** Seccional da OAB: "SP". */
  oabUf: string
}

export const ADVOGADOS: readonly AdvogadoOutorgado[] = [
  {
    id: 'sergio',
    nome: ESCRITORIO.advogado,
    feminino: false,
    qualificacao: ESCRITORIO.advogadoQualificacao,
    oab: ESCRITORIO.oab,
    oabUf: 'SP',
  },
  {
    id: 'cristina',
    nome: 'Dra. Cristina Moura Santos Lopes',
    feminino: true,
    qualificacao: 'brasileira, divorciada, advogada',
    oab: '453.976',
    oabUf: 'SP',
  },
]

export const ADVOGADO_PADRAO: AdvogadoOutorgado = ADVOGADOS[0] as AdvogadoOutorgado

/** Para as funções puras e os testes: procura na lista fixa acima. */
export function advogadoPorId(id: string | null): AdvogadoOutorgado | undefined {
  if (id === null || id === '') return ADVOGADO_PADRAO
  return ADVOGADOS.find((advogado) => advogado.id === id)
}
