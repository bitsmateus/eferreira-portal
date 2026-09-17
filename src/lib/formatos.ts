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

/**
 * Link de "fale conosco" pelo WhatsApp, a partir de um telefone com DDD.
 *
 * O `wa.me` exige o número completo com código do país — sem ele, o link abre
 * o WhatsApp sem conversa nenhuma selecionada, em vez de já abrir a conversa
 * com o escritório. `55` é fixo porque o sistema é só para o Brasil.
 */
export function linkDoWhatsapp(numeroComDdd: string): string {
  return `https://wa.me/55${somenteDigitos(numeroComDdd)}`
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

/**
 * Forma de um texto para busca: minúsculo e sem acento.
 *
 * "Marcos Vinícius" e "Marcos Vinicius" precisam se encontrar — quem digita o
 * nome de um cliente na pressa não põe acento, e o Anexo I, 2.1 promete busca
 * por nome. O Postgres só compara sem acento com a extensão `unaccent`, que
 * exigiria consulta em SQL cru e, com ela, escapar do filtro de autorização.
 * Por isso a normalização é feita aqui e guardada em coluna própria.
 */
export function normalizarParaBusca(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/** 240 KB, 1,4 MB — tamanho de arquivo na pasta do cliente, como no protótipo. */
export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  const megas = bytes / (1024 * 1024)
  return `${megas.toFixed(1).replace('.', ',')} MB`
}

/**
 * As 27 unidades federativas.
 *
 * Lista fechada porque a UF vai impressa em documento assinado, e "S.P.", "sp"
 * e "Sao Paulo" no mesmo campo viram três grafias da mesma coisa em três
 * procurações do mesmo cliente.
 *
 * Mora aqui, e não em `clientes.ts`, porque o formulário precisa dela para
 * montar o seletor — e formulário roda no navegador, onde o Prisma não entra.
 */
export const UNIDADES_FEDERATIVAS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
] as const

export function ufValida(valor: string): boolean {
  return (UNIDADES_FEDERATIVAS as readonly string[]).includes(valor)
}
