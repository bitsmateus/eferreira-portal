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

  advogado: 'Dr. Sergio Evangelista Ferreira',
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
} as const

export type DadosDoEscritorio = typeof ESCRITORIO
