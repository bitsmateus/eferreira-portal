/**
 * CPF e CNPJ — a chave de identificação de todo o sistema (Anexo I, 1.e e 2.1).
 *
 * Regra 4 do CLAUDE.md: validação com dígito verificador, não apenas máscara.
 * Guardar sempre normalizado (só dígitos) e exibir formatado.
 */

export type TipoDocumento = 'CPF' | 'CNPJ'

/** Remove tudo que não é dígito. É esta forma que vai para o banco. */
export function normalizarDocumento(valor: string): string {
  return valor.replace(/\D/g, '')
}

function todosOsDigitosIguais(digitos: string): boolean {
  const primeiro = digitos[0]
  if (primeiro === undefined) return false
  for (const digito of digitos) {
    if (digito !== primeiro) return false
  }
  return true
}

/** Soma ponderada dos `pesos.length` primeiros dígitos. */
function somaPonderada(digitos: string, pesos: readonly number[]): number {
  let total = 0
  for (let i = 0; i < pesos.length; i += 1) {
    const caractere = digitos[i]
    const peso = pesos[i]
    if (caractere === undefined || peso === undefined) return Number.NaN
    total += Number(caractere) * peso
  }
  return total
}

function digitoEsperado(soma: number): number {
  const resto = soma % 11
  return resto < 2 ? 0 : 11 - resto
}

const PESOS_CPF_1 = [10, 9, 8, 7, 6, 5, 4, 3, 2] as const
const PESOS_CPF_2 = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2] as const
const PESOS_CNPJ_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const
const PESOS_CNPJ_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const

/**
 * Valida um CPF pelos dois dígitos verificadores.
 * Aceita com ou sem máscara; rejeita sequências repetidas (111.111.111-11).
 */
export function cpfValido(valor: string): boolean {
  const digitos = normalizarDocumento(valor)
  if (digitos.length !== 11) return false
  if (todosOsDigitosIguais(digitos)) return false

  const primeiro = digitoEsperado(somaPonderada(digitos, PESOS_CPF_1))
  if (primeiro !== Number(digitos[9])) return false

  const segundo = digitoEsperado(somaPonderada(digitos, PESOS_CPF_2))
  return segundo === Number(digitos[10])
}

/**
 * Valida um CNPJ pelos dois dígitos verificadores.
 * Aceita com ou sem máscara; rejeita sequências repetidas.
 */
export function cnpjValido(valor: string): boolean {
  const digitos = normalizarDocumento(valor)
  if (digitos.length !== 14) return false
  if (todosOsDigitosIguais(digitos)) return false

  const primeiro = digitoEsperado(somaPonderada(digitos, PESOS_CNPJ_1))
  if (primeiro !== Number(digitos[12])) return false

  const segundo = digitoEsperado(somaPonderada(digitos, PESOS_CNPJ_2))
  return segundo === Number(digitos[13])
}

/** Descobre se o valor é um CPF ou um CNPJ válido. Retorna null se não for nenhum. */
export function tipoDoDocumento(valor: string): TipoDocumento | null {
  const digitos = normalizarDocumento(valor)
  if (digitos.length === 11) return cpfValido(digitos) ? 'CPF' : null
  if (digitos.length === 14) return cnpjValido(digitos) ? 'CNPJ' : null
  return null
}

/** Um documento é válido quando é um CPF válido ou um CNPJ válido. */
export function documentoValido(valor: string): boolean {
  return tipoDoDocumento(valor) !== null
}

/** Formata para exibição: 381.204.556-08 ou 18.442.907/0001-55. */
export function formatarDocumento(valor: string): string {
  const digitos = normalizarDocumento(valor)

  if (digitos.length === 11) {
    return digitos.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  }

  if (digitos.length === 14) {
    return digitos.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
      '$1.$2.$3/$4-$5',
    )
  }

  return digitos
}

/**
 * Normaliza e valida de uma vez. Use esta função em toda entrada de documento:
 * ela devolve a forma que vai para o banco junto com o tipo de pessoa.
 */
export function prepararDocumento(
  valor: string,
): { ok: true; documento: string; tipo: TipoDocumento } | { ok: false; motivo: string } {
  const digitos = normalizarDocumento(valor)

  if (digitos.length === 0) {
    return { ok: false, motivo: 'Informe o CPF ou o CNPJ.' }
  }

  if (digitos.length !== 11 && digitos.length !== 14) {
    return {
      ok: false,
      motivo: 'O CPF tem 11 dígitos e o CNPJ tem 14. Confira o número digitado.',
    }
  }

  const tipo = tipoDoDocumento(digitos)
  if (tipo === null) {
    return {
      ok: false,
      motivo:
        digitos.length === 11
          ? 'CPF inválido — o dígito verificador não confere.'
          : 'CNPJ inválido — o dígito verificador não confere.',
    }
  }

  return { ok: true, documento: digitos, tipo }
}
