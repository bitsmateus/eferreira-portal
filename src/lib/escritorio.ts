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
 * DIVERGÊNCIA AINDA ABERTA — decisão provisória de 14/09/2026
 *
 * Os modelos trazem DOIS endereços profissionais diferentes:
 *
 *   procuração → "Gerônimo Barbosa da Silva, 159, CEP 01310-100, São Paulo/SP"
 *   contrato   → "Rua Olegario Paiva, 180, 4º andar, sala 411,
 *                 Mogi das Cruzes/SP, CEP 08780-040"
 *
 * O escritório respondeu: "a princípio siga o de São Paulo, deixamos pendente
 * isso". Adotado o da procuração, portanto — e a pendência continua aberta,
 * porque os dois vieram dos próprios modelos do escritório e um deles está
 * errado em algum documento já assinado.
 *
 * ATENÇÃO: o endereço mudou de cidade, mas a COMARCA do foro não. A cláusula
 * de foro do contrato cita São Paulo, e ela é texto jurídico do escritório
 * (regra 10) — não se mexe nela por causa de um campo de endereço.
 * ─────────────────────────────────────────────────────────────────────────
 */

export const ESCRITORIO = {
  /** Razão social que assina o contrato. */
  razaoSocial: 'Sergio E. Ferreira Sociedade Individual de Advocacia',
  registroOab: '69.212',

  advogado: 'Dr. Sérgio E. Ferreira',
  /** Qualificação pessoal do advogado, como consta na procuração. */
  advogadoQualificacao: 'brasileiro, solteiro, advogado',
  oab: '378.532',

  // Endereço da procuração, adotado em 14/09/2026 por decisão do escritório.
  endereco: 'Gerônimo Barbosa da Silva, 159',
  cidade: 'São Paulo',
  uf: 'SP',
  cep: '01310-100',
  comarca: 'São Paulo - SP',

  telefone: '11 – 4580.3696',
  email: 'contato@eferreira.adv.br',

  // Conta de recebimento citada na cláusula 2.2 do contrato. É a mesma que
  // aparece impressa em todo contrato assinado pelo escritório.
  banco: 'Banco 336 - C6 S.A.',
  agencia: '0001',
  conta: '31387773-4',
  chavePix: 'Cnpj 53.909.599/0001-47',
  razaoSocialRecebedora: 'EFERREIRA ASSESSORIA E COBRANCA LTDA',
} as const

export type DadosDoEscritorio = typeof ESCRITORIO
