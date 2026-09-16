/**
 * Busca de endereço pelo CEP.
 *
 * Existe para poupar o trabalho mais repetitivo do cadastro — CEP, rua,
 * bairro, cidade e UF digitados um a um, em todo cliente — e, principalmente,
 * para tirar o erro de digitação de **cidade e UF**, que não são detalhe de
 * endereço: é delas que sai a cidade da assinatura dos documentos.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ISTO É CONVENIÊNCIA, NUNCA AUTORIDADE
 *
 * O que vale é o que está gravado no cadastro, conferido por quem cadastrou.
 * Por isso:
 *
 *  - a consulta **nunca** apaga o que a pessoa escreveu — só preenche campo
 *    vazio (ver `formulario-de-cliente.tsx`);
 *  - falha, demora ou CEP inexistente devolvem `null` e a tela segue como
 *    sempre foi, com os campos à mão. Cadastrar não pode depender de um
 *    serviço de terceiro estar no ar;
 *  - nada aqui valida coisa alguma. A validação do cadastro continua onde
 *    sempre esteve, em `clientes.ts`.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * O serviço é o ViaCEP, dos Correios brasileiros — público, sem cadastro e
 * sem chave, então não há segredo envolvido (regra 8). Trocar de fornecedor é
 * mexer só neste arquivo: quem chama recebe `EnderecoDoCep` e não sabe de
 * onde veio.
 */

import { somenteDigitos } from '@/lib/formatos'

export type EnderecoDoCep = {
  /** Rua, avenida, praça. Vem sem número — número ninguém adivinha. */
  logradouro: string
  bairro: string
  cidade: string
  uf: string
}

/** Sem resposta em cinco segundos, o cadastro continua sem ela. */
const ESPERA_MAXIMA_MS = 5000

const ENDERECO_DO_SERVICO = 'https://viacep.com.br/ws'

type RespostaDoViaCep = {
  logradouro?: string
  bairro?: string
  localidade?: string
  uf?: string
  /** O ViaCEP responde 200 com este campo quando o CEP não existe. */
  erro?: boolean | string
}

/**
 * Devolve o endereço do CEP, ou null.
 *
 * Null cobre tudo o que pode dar errado — CEP mal formado, CEP inexistente,
 * serviço fora do ar, resposta estranha — de propósito: para quem chama, o
 * resultado útil é "consegui" ou "não consegui", e nenhuma dessas falhas
 * muda o que a tela deve fazer.
 */
export async function buscarEnderecoPorCep(
  cep: string,
): Promise<EnderecoDoCep | null> {
  const digitos = somenteDigitos(cep)
  if (digitos.length !== 8) return null

  let bruto: RespostaDoViaCep
  try {
    const resposta = await fetch(`${ENDERECO_DO_SERVICO}/${digitos}/json/`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(ESPERA_MAXIMA_MS),
      // Endereço de CEP não muda de hora em hora; e o mesmo CEP costuma ser
      // consultado várias vezes seguidas enquanto se corrige a digitação.
      cache: 'force-cache',
    })

    if (!resposta.ok) return null
    bruto = (await resposta.json()) as RespostaDoViaCep
  } catch {
    // Rede, tempo esgotado ou resposta que não é JSON. Cadastrar continua
    // possível sem isto, então não há erro a propagar.
    return null
  }

  // `erro` chega como booleano em umas respostas e como "true" em outras.
  if (bruto.erro === true || bruto.erro === 'true') return null

  const cidade = (bruto.localidade ?? '').trim()
  const uf = (bruto.uf ?? '').trim().toUpperCase()

  // Sem cidade e UF a consulta não serviu para nada: são justamente elas que
  // motivam esta busca existir.
  if (cidade === '' || uf === '') return null

  return {
    logradouro: (bruto.logradouro ?? '').trim(),
    bairro: (bruto.bairro ?? '').trim(),
    cidade,
    uf,
  }
}

/**
 * O endereço como ele entra no campo único do cadastro, que guarda
 * "logradouro, número, complemento e bairro".
 *
 * O número fica de fora porque o CEP não o conhece — e é por isso que o texto
 * sai com a vírgula esperando por ele. Preencher com "Av. Paulista, Bela
 * Vista" pareceria pronto e iria assim para a procuração, sem o número.
 */
export function enderecoParaOCampo(endereco: EnderecoDoCep): string {
  return endereco.logradouro === '' ? '' : `${endereco.logradouro}, `
}
