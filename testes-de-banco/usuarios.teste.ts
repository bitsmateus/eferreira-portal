/**
 * A tela de Usuários (dependência 3.7) contra o banco de verdade.
 *
 * O que a suíte unitária de `usuarios.teste.ts` não alcança: violação real de
 * unicidade do e-mail, o filtro que mantém fora desta tela o perfil CLIENTE e
 * os usuários sem e-mail de uma credencial de API, e a trava do último
 * administrador — que só existe porque o banco tem mais de um usuário.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PerfilUsuario, SituacaoUsuario, TipoPessoa } from '@prisma/client'

import { SemAutorizacao, type SessaoServidor } from '@/lib/autorizacao'
import { prisma } from '@/lib/prisma'
import { senhaConfere } from '@/lib/senha'
import {
  alterarSituacaoDoUsuario,
  atualizarMinhaConta,
  atualizarUsuario,
  criarUsuario,
  listarUsuarios,
  redefinirSenha,
} from '@/lib/usuarios'

const EMAILS = [
  'admin.teste.usuarios@exemplo.invalido',
  'segundo.admin.teste.usuarios@exemplo.invalido',
  'novo.usuario.teste@exemplo.invalido',
  'outro.usuario.teste@exemplo.invalido',
  'cliente.usuario.teste@exemplo.invalido',
  'senha.digitada.teste@exemplo.invalido',
]
const DOCUMENTO_DO_CLIENTE = '39053344705'

let sessaoDoAdmin: SessaoServidor
let sessaoDeOperador: SessaoServidor
let administradorId: string
/** Administradores reais da base, afastados enquanto a suíte roda. */
let afastados: string[] = []

async function limpar(): Promise<void> {
  await prisma.usuario.deleteMany({ where: { email: { in: EMAILS } } })
  await prisma.cliente.deleteMany({ where: { documento: DOCUMENTO_DO_CLIENTE } })
}

/**
 * A trava do último administrador é uma regra sobre o banco INTEIRO, não sobre
 * as linhas que este teste criou. Numa base de desenvolvimento com o
 * administrador da semente, "o único administrador ativo" seria mentira, e o
 * teste falharia por causa do ambiente — passando no CI, que roda em banco
 * limpo, e falhando na máquina de quem estivesse trabalhando.
 *
 * Então a suíte afasta os administradores que já existiam e os devolve no fim.
 * Desativar é reversível e não apaga nada: ninguém perde acesso de verdade.
 */
async function afastarOutrosAdministradores(): Promise<void> {
  const outros = await prisma.usuario.findMany({
    where: {
      perfil: PerfilUsuario.ADMINISTRADOR,
      situacao: SituacaoUsuario.ATIVO,
      email: { notIn: EMAILS },
    },
    select: { id: true },
  })

  afastados = outros.map((usuario) => usuario.id)

  if (afastados.length > 0) {
    await prisma.usuario.updateMany({
      where: { id: { in: afastados } },
      data: { situacao: SituacaoUsuario.INATIVO },
    })
  }
}

async function devolverOsAfastados(): Promise<void> {
  if (afastados.length === 0) return
  await prisma.usuario.updateMany({
    where: { id: { in: afastados } },
    data: { situacao: SituacaoUsuario.ATIVO },
  })
  afastados = []
}

beforeAll(async () => {
  await limpar()
  await afastarOutrosAdministradores()

  const admin = await prisma.usuario.create({
    data: {
      nome: 'Administrador do teste de usuários',
      email: EMAILS[0],
      senhaHash: null,
      perfil: PerfilUsuario.ADMINISTRADOR,
    },
    select: { id: true },
  })
  administradorId = admin.id

  sessaoDoAdmin = {
    usuarioId: admin.id,
    perfil: PerfilUsuario.ADMINISTRADOR,
    clienteId: null,
    contratoAssinado: false,
  }
  sessaoDeOperador = { ...sessaoDoAdmin, perfil: PerfilUsuario.OPERADOR }
})

afterAll(async () => {
  await limpar()
  await devolverOsAfastados()
  await prisma.$disconnect()
})

describe('exigência de administrador', () => {
  it('operador não gerencia usuários', async () => {
    await expect(
      criarUsuario(
        sessaoDeOperador,
        { nome: 'Alguém', email: EMAILS[2] ?? '', perfil: PerfilUsuario.OPERADOR },
        null,
      ),
    ).rejects.toThrow(SemAutorizacao)
  })
})

describe('criarUsuario', () => {
  it('cria com senha sorteada pelo sistema e hash Argon2id', async () => {
    const resultado = await criarUsuario(
      sessaoDoAdmin,
      { nome: 'Novo Usuário', email: EMAILS[2] ?? '', perfil: PerfilUsuario.OPERADOR },
      'admin@teste.invalido',
    )

    expect(resultado.situacao).toBe('criado')
    if (resultado.situacao !== 'criado') return

    expect(resultado.senha.length).toBeGreaterThan(10)

    const criado = await prisma.usuario.findUnique({ where: { id: resultado.usuarioId } })
    expect(criado?.situacao).toBe(SituacaoUsuario.ATIVO)
    expect(criado?.senhaHash).not.toBeNull()
    expect(await senhaConfere(resultado.senha, criado?.senhaHash ?? '')).toBe(true)

    const auditoria = await prisma.auditoria.findFirst({
      where: { entidade: 'usuario', entidadeId: resultado.usuarioId },
    })
    expect(auditoria).not.toBeNull()
    // A senha nunca vai para a auditoria — só nome, e-mail e perfil.
    expect(JSON.stringify(auditoria?.detalhes)).not.toContain(resultado.senha)
  })

  it('recusa e-mail já cadastrado', async () => {
    const resultado = await criarUsuario(
      sessaoDoAdmin,
      { nome: 'Duplicado', email: EMAILS[0] ?? '', perfil: PerfilUsuario.OPERADOR },
      null,
    )
    expect(resultado.situacao).toBe('email_em_uso')
  })
})

describe('listarUsuarios — o filtro é o requisito desta tela', () => {
  it('não traz o perfil CLIENTE nem o usuário sem e-mail de uma credencial de API', async () => {
    const cliente = await prisma.cliente.create({
      data: {
        documento: DOCUMENTO_DO_CLIENTE,
        nome: 'Cliente do teste de usuários',
        nomeBusca: 'cliente do teste de usuarios',
        tipoPessoa: TipoPessoa.FISICA,
      },
      select: { id: true },
    })

    await prisma.usuario.create({
      data: {
        nome: 'Usuário do cliente',
        email: null,
        perfil: PerfilUsuario.CLIENTE,
        clienteId: cliente.id,
      },
    })

    await prisma.usuario.create({
      data: {
        nome: 'API · Integração de teste',
        email: null,
        senhaHash: null,
        perfil: PerfilUsuario.OPERADOR,
      },
    })

    const linhas = await listarUsuarios(sessaoDoAdmin)

    expect(linhas.every((linha) => linha.email !== '')).toBe(true)
    expect(linhas.some((linha) => linha.nome === 'Usuário do cliente')).toBe(false)
    expect(linhas.some((linha) => linha.nome === 'API · Integração de teste')).toBe(false)
    expect(linhas.some((linha) => linha.email === EMAILS[0])).toBe(true)
  })
})

describe('o último administrador não fica sem sucessor', () => {
  it('recusa rebaixar o único administrador ativo', async () => {
    const resultado = await atualizarUsuario(
      sessaoDoAdmin,
      administradorId,
      { nome: 'Administrador do teste de usuários', email: EMAILS[0] ?? '', perfil: PerfilUsuario.OPERADOR },
      null,
    )
    expect(resultado.situacao).toBe('ultimo_administrador')

    const inalterado = await prisma.usuario.findUnique({ where: { id: administradorId } })
    expect(inalterado?.perfil).toBe(PerfilUsuario.ADMINISTRADOR)
  })

  it('recusa desativar o único administrador ativo', async () => {
    const resultado = await alterarSituacaoDoUsuario(
      sessaoDoAdmin,
      administradorId,
      SituacaoUsuario.INATIVO,
      null,
    )
    expect(resultado.situacao).toBe('ultimo_administrador')
  })

  it('com um segundo administrador ativo, o primeiro pode ser rebaixado', async () => {
    const segundo = await prisma.usuario.create({
      data: {
        nome: 'Segundo administrador',
        email: EMAILS[1],
        senhaHash: null,
        perfil: PerfilUsuario.ADMINISTRADOR,
        situacao: SituacaoUsuario.ATIVO,
      },
      select: { id: true },
    })

    const resultado = await atualizarUsuario(
      sessaoDoAdmin,
      administradorId,
      { nome: 'Administrador do teste de usuários', email: EMAILS[0] ?? '', perfil: PerfilUsuario.OPERADOR },
      null,
    )
    expect(resultado.situacao).toBe('atualizado')

    // Devolve o estado original para não atrapalhar os testes seguintes.
    await prisma.usuario.update({
      where: { id: administradorId },
      data: { perfil: PerfilUsuario.ADMINISTRADOR },
    })
    await prisma.usuario.delete({ where: { id: segundo.id } })
  })
})

describe('redefinirSenha', () => {
  it('troca o hash e destrava tentativas anteriores', async () => {
    const criado = await criarUsuario(
      sessaoDoAdmin,
      { nome: 'Outro Usuário', email: EMAILS[3] ?? '', perfil: PerfilUsuario.OPERADOR },
      null,
    )
    if (criado.situacao !== 'criado') throw new Error('falha ao preparar o teste')

    await prisma.usuario.update({
      where: { id: criado.usuarioId },
      data: { tentativasFalhas: 4, bloqueadoAte: new Date(Date.now() + 60_000) },
    })

    const resultado = await redefinirSenha(sessaoDoAdmin, criado.usuarioId, null)
    expect(resultado.situacao).toBe('redefinida')
    if (resultado.situacao !== 'redefinida') return

    // A senha antiga não confere mais.
    expect(resultado.senha).not.toBe(criado.senha)

    const atualizado = await prisma.usuario.findUnique({ where: { id: criado.usuarioId } })
    expect(atualizado?.tentativasFalhas).toBe(0)
    expect(atualizado?.bloqueadoAte).toBeNull()
    expect(await senhaConfere(criado.senha, atualizado?.senhaHash ?? '')).toBe(false)
    expect(await senhaConfere(resultado.senha, atualizado?.senhaHash ?? '')).toBe(true)
  })
})

describe('senha digitada pelo administrador (23/09/2026)', () => {
  it('redefinir com senha digitada grava exatamente ela', async () => {
    const criado = await criarUsuario(
      sessaoDoAdmin,
      { nome: 'Senha Digitada', email: EMAILS[5] ?? '', perfil: PerfilUsuario.OPERADOR },
      null,
      'senha-escolhida-1',
    )
    if (criado.situacao !== 'criado') throw new Error('falha ao preparar o teste')
    expect(criado.senha).toBe('senha-escolhida-1')

    const resultado = await redefinirSenha(sessaoDoAdmin, criado.usuarioId, null, 'outra-senha-22')
    expect(resultado.situacao).toBe('redefinida')

    const atualizado = await prisma.usuario.findUnique({ where: { id: criado.usuarioId } })
    expect(await senhaConfere('outra-senha-22', atualizado?.senhaHash ?? '')).toBe(true)
    expect(await senhaConfere('senha-escolhida-1', atualizado?.senhaHash ?? '')).toBe(false)
  })

  it('operador não redefine senha de ninguém', async () => {
    await expect(
      redefinirSenha(sessaoDeOperador, administradorId, null, 'qualquer-senha-1'),
    ).rejects.toBeInstanceOf(SemAutorizacao)
  })
})

describe('atualizarMinhaConta (23/09/2026)', () => {
  it('operador edita só a própria conta; e-mail e senha exigem a senha atual', async () => {
    const criado = await criarUsuario(
      sessaoDoAdmin,
      { nome: 'Operador da Conta', email: EMAILS[4] ?? '', perfil: PerfilUsuario.OPERADOR },
      null,
      'senha-atual-123',
    )
    if (criado.situacao !== 'criado') throw new Error('falha ao preparar o teste')
    const sessao: SessaoServidor = { ...sessaoDoAdmin, usuarioId: criado.usuarioId, perfil: PerfilUsuario.OPERADOR }

    // Só o nome: não pede senha.
    expect(
      (await atualizarMinhaConta(sessao, { nome: 'Novo Nome', email: EMAILS[4] ?? '', senhaAtual: '', senhaNova: '' }, null)).situacao,
    ).toBe('atualizada')

    // Trocar a senha com a atual errada: recusa e nada muda.
    expect(
      (await atualizarMinhaConta(sessao, { nome: 'Novo Nome', email: EMAILS[4] ?? '', senhaAtual: 'errada', senhaNova: 'nova-senha-456' }, null)).situacao,
    ).toBe('senha_atual_errada')

    expect(
      (await atualizarMinhaConta(sessao, { nome: 'Novo Nome', email: EMAILS[4] ?? '', senhaAtual: 'senha-atual-123', senhaNova: 'nova-senha-456' }, null)).situacao,
    ).toBe('atualizada')

    const depois = await prisma.usuario.findUnique({ where: { id: criado.usuarioId } })
    expect(depois?.nome).toBe('Novo Nome')
    expect(await senhaConfere('nova-senha-456', depois?.senhaHash ?? '')).toBe(true)

    // Perfil nunca muda por aqui.
    expect(depois?.perfil).toBe(PerfilUsuario.OPERADOR)
  })
})
