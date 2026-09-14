/**
 * HTML → PDF, com Playwright.
 *
 * O mesmo HTML e o mesmo CSS servem à prévia na tela e ao arquivo assinado.
 * É de propósito: o operador confere na tela exatamente o que o cliente vai
 * receber, sem "na impressão fica diferente".
 *
 * Roda só no servidor. O navegador é caro de abrir, então é reaproveitado
 * entre gerações e fechado quando o processo termina.
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Browser } from 'playwright'

import { cabecalhoDoDocumento, rodapeDoDocumento } from '@/lib/timbre'

let navegadorMemorizado: Browser | null = null

async function navegador(): Promise<Browser> {
  if (navegadorMemorizado !== null && navegadorMemorizado.isConnected()) {
    return navegadorMemorizado
  }

  // Importado aqui dentro, e não no topo, para que o Playwright não entre no
  // pacote de quem só quer montar o HTML da prévia.
  const { chromium } = await import('playwright')

  navegadorMemorizado = await chromium.launch({ args: ['--no-sandbox'] })
  return navegadorMemorizado
}

export async function fecharNavegador(): Promise<void> {
  if (navegadorMemorizado !== null) {
    await navegadorMemorizado.close()
    navegadorMemorizado = null
  }
}

let estiloMemorizado: string | null = null

/** O CSS dos documentos, lido do disco uma vez. */
export async function estiloDosDocumentos(): Promise<string> {
  if (estiloMemorizado !== null) return estiloMemorizado
  estiloMemorizado = await readFile(
    join(process.cwd(), 'src', 'modelos', 'estilo.css'),
    'utf8',
  )
  return estiloMemorizado
}

export async function lerModelo(nome: string): Promise<string> {
  return readFile(join(process.cwd(), 'src', 'modelos', `${nome}.html`), 'utf8')
}

/** Embrulha o corpo do documento na página completa, com o CSS embutido. */
/**
 * Monta a página inteira: timbre, corpo do documento, timbre.
 *
 * O cabeçalho e o rodapé entram AQUI, e não nos modelos, porque o que está em
 * `src/modelos/` é texto jurídico do escritório — que a regra 10 proíbe
 * alterar. Papel timbrado não é texto jurídico, e separá-los permite mexer em
 * um sem nunca encostar no outro.
 *
 * Como a prévia na tela usa esta mesma função, o operador vê o documento
 * timbrado exatamente como ele sai no PDF.
 */
export function montarPagina(corpo: string, estilo: string, titulo: string): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${titulo}</title>
<style>${estilo}</style>
</head>
<body>${cabecalhoDoDocumento()}${corpo}${rodapeDoDocumento()}</body>
</html>`
}

/**
 * Gera o PDF. `printBackground` fica ligado para que as linhas de assinatura e
 * as bordas do cabeçalho apareçam; sem isso o Chromium as descarta.
 */
export async function gerarPdf(paginaHtml: string): Promise<Uint8Array> {
  const contexto = await (await navegador()).newContext()

  try {
    const pagina = await contexto.newPage()
    await pagina.setContent(paginaHtml, { waitUntil: 'load' })

    const pdf = await pagina.pdf({
      format: 'A4',
      printBackground: true,
      // As margens vêm do @page do CSS dos documentos, para que a prévia na
      // tela e o PDF usem a mesma medida.
      preferCSSPageSize: true,
    })

    return new Uint8Array(pdf)
  } finally {
    await contexto.close()
  }
}
