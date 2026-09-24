/**
 * Onde a D4Sign colocaria cada assinatura — `npm run d4sign:posicoes -- arquivo.pdf`.
 *
 * Lê um PDF gerado pelo portal, acha as marcas de assinatura e imprime os pins
 * (`addpins`) que seriam mandados, com os ajustes atuais. Só leitura: não
 * fala com a D4Sign, não gasta crédito, não manda e-mail. Serve para conferir
 * o que sairia ANTES de ligar `D4SIGN_POSICIONAR_ASSINATURA=1`.
 */

import 'dotenv/config'
import { readFileSync } from 'node:fs'

import {
  ajusteDoAmbiente,
  lerPaginasDoPdf,
  pinsPelasMarcas,
  posicionamentoLigado,
} from '../src/lib/posicao-da-assinatura'

async function principal(): Promise<void> {
  const arquivo = process.argv[2]
  if (arquivo === undefined) {
    console.error('Uso: npm run d4sign:posicoes -- caminho/do/documento.pdf')
    process.exitCode = 1
    return
  }

  const paginas = await lerPaginasDoPdf(readFileSync(arquivo))
  const ajuste = ajusteDoAmbiente()

  console.log(`Envio com posição: ${posicionamentoLigado() ? 'LIGADO' : 'desligado'}`)
  console.log(`Ajuste do pin: x ${ajuste.xMm} mm, y ${ajuste.yMm} mm`)
  console.log(`Páginas: ${paginas.length}\n`)

  for (const pagina of paginas) {
    for (const marca of pagina.marcas) {
      console.log(
        `página ${pagina.numero}: marca "${marca.chave}" em x ${marca.xMm.toFixed(1)} mm, y ${marca.yMm.toFixed(1)} mm (do topo)`,
      )
    }
  }

  const pins = pinsPelasMarcas(
    paginas,
    [
      { email: 'signatario-da-parte@exemplo.invalido', chave: 'parte' },
      { email: 'signatario-do-escritorio@exemplo.invalido', chave: 'escritorio' },
    ],
    ajuste,
  )
  console.log('\nPins que seriam enviados:')
  console.log(JSON.stringify(pins, null, 2))
}

void principal().then(() => process.exit(process.exitCode ?? 0))
