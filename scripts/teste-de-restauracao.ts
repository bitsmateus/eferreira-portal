/**
 * Teste de restauração — critério de pronto da Sprint 0.
 *
 * "Backup automático do banco, com teste de restauração feito antes de existir
 * dado real." Um backup que nunca foi restaurado não é backup: é um arquivo.
 *
 * O que este script faz, de ponta a ponta:
 *   1. gera um dump do banco atual;
 *   2. cria um banco descartável ao lado;
 *   3. restaura o dump nele;
 *   4. confere que as tabelas e as linhas chegaram do outro lado;
 *   5. derruba o banco descartável.
 *
 * Uso:  npm run banco:teste-restauracao
 */

import 'dotenv/config'
import {
  argumentosDeConexao,
  gerarDump,
  lerConexao,
  rodarComandoDoPostgres,
  type Conexao,
} from './banco'

const TABELAS_ESPERADAS = [
  'usuario',
  'cliente',
  'caso',
  'status_andamento',
  'andamento',
  'documento',
  'auditoria',
] as const

function consultar(conexao: Conexao, banco: string, sql: string): string {
  return rodarComandoDoPostgres(
    'psql',
    [...argumentosDeConexao(conexao, banco), '-t', '-A', '-c', sql],
    conexao,
  ).trim()
}

function executarNoPostgres(conexao: Conexao, sql: string): void {
  rodarComandoDoPostgres(
    'psql',
    [...argumentosDeConexao(conexao, 'postgres'), '-v', 'ON_ERROR_STOP=1', '-c', sql],
    conexao,
  )
}

function principal() {
  const conexao = lerConexao(process.env['DATABASE_URL'])
  const bancoDeTeste = `${conexao.banco}_restauracao_${Date.now()}`

  console.log(`Banco de origem: ${conexao.banco}`)
  console.log(`Banco descartável: ${bancoDeTeste}\n`)

  console.log('1/5 · gerando o dump…')
  const dump = gerarDump(conexao)
  console.log(`     ${dump.length} bytes.`)

  const contagensOriginais = new Map<string, string>()
  for (const tabela of TABELAS_ESPERADAS) {
    contagensOriginais.set(
      tabela,
      consultar(conexao, conexao.banco, `SELECT count(*) FROM "${tabela}";`),
    )
  }

  console.log('2/5 · criando o banco descartável…')
  executarNoPostgres(conexao, `CREATE DATABASE "${bancoDeTeste}";`)

  try {
    console.log('3/5 · restaurando o dump nele…')
    rodarComandoDoPostgres(
      'psql',
      [
        ...argumentosDeConexao(conexao, bancoDeTeste),
        '-v',
        'ON_ERROR_STOP=1',
        '-f',
        '-',
      ],
      conexao,
      dump,
    )

    console.log('4/5 · conferindo o que chegou do outro lado…')

    const tabelasRestauradas = consultar(
      conexao,
      bancoDeTeste,
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;",
    )
      .split('\n')
      .map((linha) => linha.trim())
      .filter((linha) => linha !== '')

    const faltando = TABELAS_ESPERADAS.filter(
      (tabela) => !tabelasRestauradas.includes(tabela),
    )

    if (faltando.length > 0) {
      throw new Error(
        `Tabelas ausentes na restauração: ${faltando.join(', ')}`,
      )
    }

    for (const tabela of TABELAS_ESPERADAS) {
      const original = contagensOriginais.get(tabela) ?? '0'
      const restaurada = consultar(
        conexao,
        bancoDeTeste,
        `SELECT count(*) FROM "${tabela}";`,
      )
      if (original !== restaurada) {
        throw new Error(
          `Tabela ${tabela}: origem tem ${original} linha(s), restauração tem ${restaurada}.`,
        )
      }
      console.log(`     ${tabela.padEnd(18)} ${restaurada} linha(s) — confere.`)
    }

    console.log('\nRESTAURAÇÃO VERIFICADA COM SUCESSO.')
  } finally {
    console.log('5/5 · derrubando o banco descartável…')
    executarNoPostgres(conexao, `DROP DATABASE IF EXISTS "${bancoDeTeste}";`)
  }
}

principal()
