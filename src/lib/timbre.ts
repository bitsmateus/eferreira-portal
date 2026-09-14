/**
 * O timbre dos documentos gerados — regra 10: "com a logo no cabeçalho e no
 * rodapé".
 *
 * ─────────────────────────────────────────────────────────────────────────
 * A IDENTIDADE VISUAL FOI APROVADA COMO ESTÁ (14/09/2026)
 *
 * A dependência 3.2 do Anexo II pedia a logo em vetor. O escritório respondeu
 * que "a logo e a identidade visual é o que já está, não precisa ajustar
 * nada" — ou seja, o desenho aprovado no protótipo é a marca. É o mesmo
 * símbolo de `src/componentes/marca.tsx`, aqui em traço preto, porque
 * documento vai para papel e para assinatura, não para tela escura.
 *
 * Se um dia chegar um arquivo de logo de verdade, é este arquivo e o
 * `marca.tsx` que mudam — nenhum modelo desenha marca por conta própria.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * O timbre saiu dos três modelos e veio para cá por um motivo de fundo: o que
 * está em `src/modelos/` é **texto jurídico do escritório**, que a regra 10
 * proíbe alterar. Papel timbrado não é texto jurídico. Separados, dá para
 * mexer no timbre sem nunca encostar na cláusula.
 */

import { ESCRITORIO } from '@/lib/escritorio'

function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * O símbolo da marca, em traço preto. Sem gradiente de propósito: impressora
 * a laser e leitor de PDF de cartório transformam gradiente em borrão, e a
 * marca precisa sobreviver a uma fotocópia.
 */
const SIMBOLO = `<svg class="simbolo" viewBox="0 0 64 64" aria-hidden="true">
  <rect x="4" y="4" width="56" height="56" fill="none" stroke="#000" stroke-width="3"/>
  <path d="M15 19H39M15 32H33M15 45H39" stroke="#000" stroke-width="3" fill="none" stroke-linecap="square"/>
  <path d="M47 15V49" stroke="#000" stroke-width="3"/>
</svg>`

export function cabecalhoDoDocumento(): string {
  return `<div class="marca-cabecalho">
  ${SIMBOLO}
  <div class="marca-texto">
    <div class="nome">E. FERREIRA</div>
    <div class="complemento">ADVOGADOS</div>
  </div>
</div>`
}

export function rodapeDoDocumento(): string {
  const partes = [
    ESCRITORIO.razaoSocial,
    `OAB/${ESCRITORIO.uf} ${ESCRITORIO.oab}`,
    ESCRITORIO.telefone,
    ESCRITORIO.email,
  ]

  return `<div class="marca-rodape">
  ${escapar(partes.join(' · '))}
</div>`
}
