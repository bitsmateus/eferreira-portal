/**
 * Quais campos do cadastro de cliente são obrigatórios.
 *
 * Mora separado de `clientes.ts` de propósito: o formulário precisa desta
 * lista para marcar os campos com asterisco, e `clientes.ts` fala com o Prisma
 * — importá-lo de um componente de cliente levaria código de servidor para
 * dentro do pacote que o navegador baixa. Mesma separação de `arquivos.ts` e
 * `acesso.ts`.
 *
 * Aqui não pode entrar nada de servidor: nem Prisma, nem `node:`, nem sessão.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * É UMA LISTA SÓ, E É DE PROPÓSITO
 *
 * A validação do servidor e o asterisco da tela leem exatamente estas linhas.
 * Duas listas se desencontrariam no primeiro campo que alguém tornasse
 * obrigatório — e o jeito de descobrir seria um operador preenchendo tudo o
 * que tem asterisco e o sistema recusando assim mesmo.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { TipoPessoa } from '@prisma/client'

/**
 * Campos que o escritório definiu como obrigatórios em 14/09/2026, e a razão
 * de a lista mudar conforme o tipo de pessoa.
 *
 * Para pessoa física, a qualificação é dela mesma. Para pessoa jurídica, RG,
 * estado civil, profissão, nacionalidade e nome da mãe **não se aplicam à
 * empresa** — são do sócio, que o escritório pediu como "o mesmo cadastro da
 * PF ligado ao cadastro do PJ" e mora no `RepresentanteLegal`. Exigi-los da
 * empresa impediria cadastrar qualquer CNPJ.
 *
 * Data de nascimento ficou de fora: o escritório tirou da lista, e nenhum dos
 * modelos de documento a usa.
 *
 * Bloqueiam a gravação, a pedido do escritório: "é melhor não deixar salvar,
 * para não criar futuras pendências".
 *
 * Cada linha traz o campo, o rótulo e a MENSAGEM PRONTA. A mensagem vem
 * escrita por extenso, e não montada com
 * `${rotulo} é obrigatório`, porque em português o adjetivo concorda com o
 * substantivo: "Nacionalidade é obrigatório" está errado, e num sistema de
 * escritório de advocacia isso salta aos olhos de quem lê o dia inteiro.
 */
export const OBRIGATORIOS_COMUNS = [
  ['email', 'E-mail', 'O e-mail é obrigatório.'],
  ['telefone', 'Telefone', 'O telefone é obrigatório.'],
  ['cep', 'CEP', 'O CEP é obrigatório.'],
  ['endereco', 'Endereço', 'O endereço é obrigatório.'],
  ['cidade', 'Cidade', 'A cidade é obrigatória.'],
  ['uf', 'UF', 'A UF é obrigatória.'],
] as const

export const OBRIGATORIOS_DA_PESSOA = [
  ['rg', 'RG', 'O RG é obrigatório.'],
  ['estadoCivil', 'Estado civil', 'O estado civil é obrigatório.'],
  ['profissao', 'Profissão', 'A profissão é obrigatória.'],
  ['nacionalidade', 'Nacionalidade', 'A nacionalidade é obrigatória.'],
  ['nomeMae', 'Nome da mãe', 'O nome da mãe é obrigatório.'],
] as const

export type CampoObrigatorio =
  | (typeof OBRIGATORIOS_COMUNS)[number][0]
  | (typeof OBRIGATORIOS_DA_PESSOA)[number][0]

export function obrigatoriosPara(
  tipoPessoa: TipoPessoa,
): readonly (readonly [CampoObrigatorio, string, string])[] {
  return tipoPessoa === TipoPessoa.FISICA
    ? [...OBRIGATORIOS_COMUNS, ...OBRIGATORIOS_DA_PESSOA]
    : OBRIGATORIOS_COMUNS
}

/**
 * Os dois que não estão nas listas acima porque o próprio esquema já os exige,
 * antes de qualquer regra do escritório: sem documento não há chave de
 * identificação (regra 4), e sem nome não há cadastro.
 */
const SEMPRE_OBRIGATORIOS = ['documento', 'nome'] as const

/**
 * O que a tela pergunta para decidir se põe asterisco no rótulo.
 *
 * Recebe o tipo de pessoa porque a lista muda com ele — e o tipo, na tela,
 * é derivado do documento que está sendo digitado. Quem decide o tipo de
 * verdade continua sendo o servidor (regra 2); aqui é só o asterisco.
 */
export function ehObrigatorio(campo: string, tipoPessoa: TipoPessoa): boolean {
  if ((SEMPRE_OBRIGATORIOS as readonly string[]).includes(campo)) return true
  return obrigatoriosPara(tipoPessoa).some(([nome]) => nome === campo)
}
