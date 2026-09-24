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

  // Conta de recebimento citada na cláusula 2.2 do contrato. É a mesma que
  // aparece impressa em todo contrato assinado pelo escritório.
  banco: 'Banco 336 - C6 S.A.',
  agencia: '0001',
  conta: '31387773-4',
  chavePix: 'Cnpj 53.909.599/0001-47',
  razaoSocialRecebedora: 'EFERREIRA ASSESSORIA E COBRANCA LTDA',

  /**
   * O que entra no item 3.5 do contrato ("nos seguintes dados: ..."). O
   * contrato novo (24/09/2026) manda preencher [DADOS_DE_PAGAMENTO] e não diz
   * quais; usa-se a conta que já constava no contrato antigo. CONFIRMAR.
   */
  dadosDePagamento:
    'Banco 336 - C6 S.A., agência 0001, conta 31387773-4, chave Pix CNPJ 53.909.599/0001-47, em nome de EFERREIRA ASSESSORIA E COBRANCA LTDA',
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
 * Quem pode ser o OUTORGADO da procuração — pedido do escritório em
 * 24/09/2026 ("precisa ter a opção de trocar o outorgado (advogado); o
 * endereço profissional é o mesmo"). Quem escolhe é o operador, na hora de
 * gerar; o endereço do escritório (acima) vale para todos.
 *
 * O primeiro da lista é o padrão, e é o mesmo advogado do restante de
 * `ESCRITORIO`: o CONTRATO continua sendo dele (razão social, OAB), só a
 * procuração troca de outorgado.
 *
 * Como o resto deste arquivo, vive no código e não no banco: para incluir
 * outro advogado, acrescente uma linha aqui. (Quando a tela de administração
 * do escritório existir, isto vai para lá.)
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
  email: string
  whatsapp: string | null
}

export const ADVOGADOS: readonly AdvogadoOutorgado[] = [
  {
    id: 'sergio',
    nome: ESCRITORIO.advogado,
    feminino: false,
    qualificacao: ESCRITORIO.advogadoQualificacao,
    oab: ESCRITORIO.oab,
    email: ESCRITORIO.emailDoAdvogado,
    whatsapp: ESCRITORIO.whatsapp,
  },
  {
    // Dados da procuração de exemplo enviada em 24/09/2026.
    id: 'cristina',
    nome: 'Dra. Cristina Moura Santos Lopes',
    feminino: true,
    qualificacao: 'brasileira, divorciada, advogada',
    oab: '453.976',
    email: 'cristina.msl.adv@gmail.com',
    whatsapp: null,
  },
]

export const ADVOGADO_PADRAO: AdvogadoOutorgado = ADVOGADOS[0] as AdvogadoOutorgado

/** `null` ou vazio = o padrão; id que não existe = `undefined` (quem chama recusa). */
export function advogadoPorId(id: string | null): AdvogadoOutorgado | undefined {
  if (id === null || id === '') return ADVOGADO_PADRAO
  return ADVOGADOS.find((advogado) => advogado.id === id)
}
