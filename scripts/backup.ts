/**
 * Gera um dump do banco em `backups/`.
 *
 * Uso:  npm run banco:backup
 *
 * A pasta `backups/` está no .gitignore: dump de banco de escritório de
 * advocacia não entra em repositório (regra 8, e bom senso).
 */

import 'dotenv/config'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { gerarDump, lerConexao } from './banco'

function carimboDeTempo(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function principal() {
  const conexao = lerConexao(process.env['DATABASE_URL'])
  const pasta = process.env['PASTA_DE_BACKUP'] ?? 'backups'

  mkdirSync(pasta, { recursive: true })

  const destino = path.join(
    pasta,
    `${conexao.banco}-${carimboDeTempo()}.sql`,
  )

  const dump = gerarDump(conexao)
  writeFileSync(destino, dump, 'utf8')

  console.log(`Backup gravado em ${destino} (${dump.length} bytes).`)
}

principal()
