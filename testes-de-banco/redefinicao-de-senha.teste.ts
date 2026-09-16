/**
 * "Esqueci minha senha" da equipe, contra o Postgres de verdade.
 *
 * O que a suíte unitária de `redefinicao-de-senha.teste.ts` não alcança:
 * quem é elegível de verdade (perfil, situação, e-mail), a invalidação do
 * código anterior, as tentativas que matam o código e a troca de senha em si
 * — inclusive que ela destrava o bloqueio de login.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PerfilUsuario, SituacaoUsuario } from '@prisma/client'

import {
  confirmarRedefinicao,
  pedirRedefinicao,
} from '@/lib/redefinicao-de-senha'
import { TENTATIVAS_POR_CODIGO } from '@/lib/redefinicao'
import { prisma } from '@/lib/prisma'
import { gerarHashDeSenha, senhaConfere } from '@/lib/senha'

const EMAIL_ATIVO = 'operador.teste.redefinicao@exemplo.invalido'
const EMAIL_BLOQUEADO = 'bloqueado.teste.redefinicao@exemplo.invalido'
const EMAIL_INATIVO = 'inativo.teste.redefinicao@exemplo.invalido'
const EMAIL_SEM_SENHA = 'semsenha.teste.redefinicao@exemplo.invalido'
const EMAIL_INEXISTENTE = 'ninguem.teste.redefinicao@exemplo.invalido'
const TODOS_OS_EMAILS = [EMAIL_ATIVO, EMAIL_BLOQUEADO, EMAIL_INATIVO, EMAIL_SEM_SENHA]

const SENHA_ANTIGA = 'senhaAntigaDoTeste123'

let ativoId: string
let bloqueadoId: string

async function limpar(): Promise<void> {
  await prisma.usuario.deleteMany({ where: { email: { in: TODOS_OS_EMAILS } } })
}

beforeAll(async () => {
  await limpar()

  const ativo = await prisma.usuario.create({
    data: {
      nome: 'Operador ativo do teste',
      email: EMAIL_ATIVO,
      senhaHash: await gerarHashDeSenha(SENHA_ANTIGA),
      perfil: PerfilUsuario.OPERADOR,
      situacao: SituacaoUsuario.ATIVO,
    },
    select: { id: true },
  })
  ativoId = ativo.id

  const bloqueado = await prisma.usuario.create({
    data: {
      nome: 'Operador bloqueado do teste',
      email: EMAIL_BLOQUEADO,
      senhaHash: await gerarHashDeSenha(SENHA_ANTIGA),
      perfil: PerfilUsuario.ADMINISTRADOR,
      situacao: SituacaoUsuario.ATIVO,
      tentativasFalhas: 5,
      bloqueadoAte: new Date(Date.now() + 15 * 60_000),
    },
    select: { id: true },
  })
  bloqueadoId = bloqueado.id

  await prisma.usuario.create({
    data: {
      nome: 'Operador inativo do teste',
      email: EMAIL_INATIVO,
      senhaHash: await gerarHashDeSenha(SENHA_ANTIGA),
      perfil: PerfilUsuario.OPERADOR,
      situacao: SituacaoUsuario.INATIVO,
    },
  })

  // Uma credencial de API: perfil da equipe, mas sem senha — não tem como
  // "esquecer" o que nunca teve.
  await prisma.usuario.create({
    data: {
      nome: 'Credencial sem senha do teste',
      email: EMAIL_SEM_SENHA,
      senhaHash: null,
      perfil: PerfilUsuario.OPERADOR,
      situacao: SituacaoUsuario.ATIVO,
    },
  })
})

afterAll(async () => {
  await limpar()
})

async function pedirEBuscarToken(email: string, usuarioId: string) {
  await pedirRedefinicao(email)
  return prisma.tokenDeRedefinicaoDeSenha.findFirst({
    where: { usuarioId, usadoEm: null, invalidadoEm: null },
    orderBy: { criadoEm: 'desc' },
  })
}

describe('pedirRedefinicao — elegibilidade', () => {
  it('usuário ativo, da equipe e com senha: gera um token de verdade', async () => {
    const token = await pedirEBuscarToken(EMAIL_ATIVO, ativoId)
    expect(token).not.toBeNull()
    expect(token?.expiraEm.getTime()).toBeGreaterThan(Date.now())
  })

  it('e-mail que não existe: não cria nenhum token', async () => {
    const antes = await prisma.tokenDeRedefinicaoDeSenha.count()
    await pedirRedefinicao(EMAIL_INEXISTENTE)
    const depois = await prisma.tokenDeRedefinicaoDeSenha.count()
    expect(depois).toBe(antes)
  })

  it('usuário inativo: não cria token', async () => {
    const usuario = await prisma.usuario.findUniqueOrThrow({
      where: { email: EMAIL_INATIVO },
    })
    const token = await pedirEBuscarToken(EMAIL_INATIVO, usuario.id)
    expect(token).toBeNull()
  })

  it('usuário sem senha (credencial de API): não cria token', async () => {
    const usuario = await prisma.usuario.findUniqueOrThrow({
      where: { email: EMAIL_SEM_SENHA },
    })
    const token = await pedirEBuscarToken(EMAIL_SEM_SENHA, usuario.id)
    expect(token).toBeNull()
  })

  it('pedir de novo invalida o token anterior — só um vale por vez', async () => {
    const primeiro = await pedirEBuscarToken(EMAIL_ATIVO, ativoId)

    // Sem isto, o segundo pedido cairia no limite de "cedo demais" (mesmo
    // minuto) e reaproveitaria o primeiro token em vez de criar outro — o
    // que é o comportamento certo do sistema, só não o que este teste quer
    // provar.
    await prisma.tokenDeRedefinicaoDeSenha.update({
      where: { id: primeiro!.id },
      data: { criadoEm: new Date(Date.now() - 2 * 60_000) },
    })

    const segundo = await pedirEBuscarToken(EMAIL_ATIVO, ativoId)

    expect(segundo?.id).not.toBe(primeiro?.id)

    const primeiroDeNovo = await prisma.tokenDeRedefinicaoDeSenha.findUniqueOrThrow({
      where: { id: primeiro!.id },
    })
    expect(primeiroDeNovo.invalidadoEm).not.toBeNull()
  })
})

describe('confirmarRedefinicao', () => {
  it('código correto troca a senha e destrava o bloqueio', async () => {
    await prisma.tokenDeRedefinicaoDeSenha.deleteMany({ where: { usuarioId: bloqueadoId } })

    const codigo = '135790'
    await prisma.tokenDeRedefinicaoDeSenha.create({
      data: {
        usuarioId: bloqueadoId,
        codigoHash: await gerarHashDeSenha(codigo),
        expiraEm: new Date(Date.now() + 10 * 60_000),
      },
    })

    const senhaNova = 'senhaNovaEscolhidaPeloOperador123'
    const resultado = await confirmarRedefinicao(EMAIL_BLOQUEADO, codigo, senhaNova)
    expect(resultado.situacao).toBe('redefinida')

    const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: bloqueadoId } })
    expect(await senhaConfere(senhaNova, usuario.senhaHash ?? '')).toBe(true)
    expect(usuario.tentativasFalhas).toBe(0)
    expect(usuario.bloqueadoAte).toBeNull()

    const token = await prisma.tokenDeRedefinicaoDeSenha.findFirst({
      where: { usuarioId: bloqueadoId },
      orderBy: { criadoEm: 'desc' },
    })
    expect(token?.usadoEm).not.toBeNull()
  })

  it('código errado não troca a senha e conta como tentativa', async () => {
    await prisma.tokenDeRedefinicaoDeSenha.deleteMany({ where: { usuarioId: ativoId } })

    const token = await prisma.tokenDeRedefinicaoDeSenha.create({
      data: {
        usuarioId: ativoId,
        codigoHash: await gerarHashDeSenha('111111'),
        expiraEm: new Date(Date.now() + 10 * 60_000),
      },
    })

    const resultado = await confirmarRedefinicao(EMAIL_ATIVO, '000000', 'outraSenhaQualquer123')
    expect(resultado.situacao).toBe('nao_confere')

    const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: ativoId } })
    expect(await senhaConfere(SENHA_ANTIGA, usuario.senhaHash ?? '')).toBe(true)

    const tokenDeNovo = await prisma.tokenDeRedefinicaoDeSenha.findUniqueOrThrow({
      where: { id: token.id },
    })
    expect(tokenDeNovo.tentativas).toBe(1)
  })

  it('a quinta tentativa errada mata o código, mesmo que a sexta acerte', async () => {
    await prisma.tokenDeRedefinicaoDeSenha.deleteMany({ where: { usuarioId: ativoId } })

    const codigo = '246810'
    await prisma.tokenDeRedefinicaoDeSenha.create({
      data: {
        usuarioId: ativoId,
        codigoHash: await gerarHashDeSenha(codigo),
        expiraEm: new Date(Date.now() + 10 * 60_000),
      },
    })

    for (let tentativa = 0; tentativa < TENTATIVAS_POR_CODIGO; tentativa += 1) {
      const resultado = await confirmarRedefinicao(EMAIL_ATIVO, '999999', 'senhaQualquer123')
      expect(resultado.situacao).toBe('nao_confere')
    }

    // O código certo, depois de esgotadas as tentativas, já não vale mais.
    const resultadoFinal = await confirmarRedefinicao(EMAIL_ATIVO, codigo, 'senhaQualquer123')
    expect(resultadoFinal.situacao).toBe('nao_confere')

    const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: ativoId } })
    expect(await senhaConfere(SENHA_ANTIGA, usuario.senhaHash ?? '')).toBe(true)
  })

  it('código vencido não confere', async () => {
    await prisma.tokenDeRedefinicaoDeSenha.deleteMany({ where: { usuarioId: ativoId } })

    const codigo = '024681'
    await prisma.tokenDeRedefinicaoDeSenha.create({
      data: {
        usuarioId: ativoId,
        codigoHash: await gerarHashDeSenha(codigo),
        expiraEm: new Date(Date.now() - 1000),
      },
    })

    const resultado = await confirmarRedefinicao(EMAIL_ATIVO, codigo, 'senhaQualquer123')
    expect(resultado.situacao).toBe('nao_confere')
  })
})
