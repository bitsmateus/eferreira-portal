/**
 * Utilidades de backup do banco.
 *
 * Em desenvolvimento, `pg_dump` e `psql` rodam dentro do container do Postgres
 * (não é preciso ter o cliente instalado na máquina). Em homologação e
 * produção, defina `BANCO_VIA_DOCKER=false` e os binários são chamados
 * direto — é assim que a rotina agendada do EasyPanel executa.
 */

import { spawnSync } from 'node:child_process'

export type Conexao = {
  usuario: string
  senha: string
  hospedeiro: string
  porta: string
  banco: string
}

export function lerConexao(url: string | undefined): Conexao {
  if (url === undefined || url === '') {
    throw new Error('DATABASE_URL não definida.')
  }

  const analisada = new URL(url)

  return {
    usuario: decodeURIComponent(analisada.username),
    senha: decodeURIComponent(analisada.password),
    hospedeiro: analisada.hostname,
    porta: analisada.port === '' ? '5432' : analisada.port,
    banco: analisada.pathname.replace(/^\//, ''),
  }
}

export function viaDocker(): boolean {
  return (process.env['BANCO_VIA_DOCKER'] ?? 'true') !== 'false'
}

const CONTAINER = process.env['BANCO_CONTAINER'] ?? 'eferreira-banco'

/**
 * Roda um comando do Postgres e devolve a saída padrão.
 * `entrada` alimenta o stdin (usado na restauração).
 */
export function rodarComandoDoPostgres(
  comando: string,
  argumentos: readonly string[],
  conexao: Conexao,
  entrada?: string,
): string {
  const ambiente = { ...process.env, PGPASSWORD: conexao.senha }

  const executavel = viaDocker() ? 'docker' : comando
  const argumentosFinais = viaDocker()
    ? [
        'exec',
        '-i',
        '-e',
        `PGPASSWORD=${conexao.senha}`,
        CONTAINER,
        comando,
        ...argumentos,
      ]
    : [...argumentos]

  const resultado = spawnSync(executavel, argumentosFinais, {
    env: ambiente,
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
    ...(entrada !== undefined ? { input: entrada } : {}),
  })

  if (resultado.error !== undefined) {
    throw resultado.error
  }

  if (resultado.status !== 0) {
    throw new Error(
      `${comando} terminou com código ${String(resultado.status)}:\n${resultado.stderr}`,
    )
  }

  return resultado.stdout
}

/** Argumentos de conexão comuns a pg_dump e psql. */
export function argumentosDeConexao(conexao: Conexao, banco?: string): string[] {
  return [
    '-h',
    viaDocker() ? 'localhost' : conexao.hospedeiro,
    '-p',
    viaDocker() ? '5432' : conexao.porta,
    '-U',
    conexao.usuario,
    '-d',
    banco ?? conexao.banco,
  ]
}

/** Dump lógico completo, em texto puro. */
export function gerarDump(conexao: Conexao): string {
  return rodarComandoDoPostgres(
    'pg_dump',
    [...argumentosDeConexao(conexao), '--clean', '--if-exists', '--no-owner', '--no-acl'],
    conexao,
  )
}
