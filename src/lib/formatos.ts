/**
 * Formatação de exibição — telefone, CEP e número do processo.
 *
 * Mesma disciplina do CPF/CNPJ (regra 4): guarda-se a forma normalizada e
 * exibe-se a formatada. Máscara é assunto de tela, nunca de banco.
 */

/** Remove tudo que não é dígito. */
export function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, '')
}

/** (11) 98812-4470 ou (11) 3255-1090. Devolve o original se não reconhecer. */
export function formatarTelefone(valor: string): string {
  const digitos = somenteDigitos(valor)

  if (digitos.length === 11) {
    return digitos.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3')
  }
  if (digitos.length === 10) {
    return digitos.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3')
  }
  return valor
}

/** 01310-100. Devolve o original se não tiver 8 dígitos. */
export function formatarCep(valor: string): string {
  const digitos = somenteDigitos(valor)
  if (digitos.length !== 8) return valor
  return digitos.replace(/^(\d{5})(\d{3})$/, '$1-$2')
}

/**
 * Número do processo no padrão CNJ: 0012845-63.2026.8.26.0100.
 *
 * O número tem 20 dígitos (NNNNNNN-DD.AAAA.J.TR.OOOO). Quando os 20 dígitos
 * estão lá, guardamos só os dígitos e formatamos na exibição — assim
 * "0012845-63.2026.8.26.0100" e "00128456320268260100" são o mesmo caso, e o
 * índice único do banco não deixa cadastrar os dois.
 *
 * Nem todo caso é judicial: o protótipo prevê caso em fase pré-processual, e
 * há procedimento administrativo com numeração própria. Por isso, o que não
 * tiver 20 dígitos é guardado como foi digitado, apenas sem espaço sobrando.
 */
export function normalizarNumeroDeProcesso(valor: string): string {
  const limpo = valor.trim()
  const digitos = somenteDigitos(limpo)
  return digitos.length === 20 ? digitos : limpo
}

/** Formata o número do processo quando ele é um CNJ de 20 dígitos. */
export function formatarNumeroDeProcesso(valor: string): string {
  const digitos = somenteDigitos(valor)
  if (digitos.length !== 20) return valor

  return digitos.replace(
    /^(\d{7})(\d{2})(\d{4})(\d{1})(\d{2})(\d{4})$/,
    '$1-$2.$3.$4.$5.$6',
  )
}

/** Guarda só os dígitos quando o telefone tem 10 ou 11; senão, o que foi digitado. */
export function normalizarTelefone(valor: string): string {
  const limpo = valor.trim()
  const digitos = somenteDigitos(limpo)
  return digitos.length === 10 || digitos.length === 11 ? digitos : limpo
}

/** Guarda só os dígitos quando o CEP tem 8; senão, o que foi digitado. */
export function normalizarCep(valor: string): string {
  const limpo = valor.trim()
  const digitos = somenteDigitos(limpo)
  return digitos.length === 8 ? digitos : limpo
}
