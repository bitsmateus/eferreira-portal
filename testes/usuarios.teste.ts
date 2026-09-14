import { describe, expect, it } from 'vitest'
import { PerfilUsuario } from '@prisma/client'

import { validarUsuario } from '@/lib/usuarios'

describe('validarUsuario', () => {
  it('aceita nome, e-mail e perfil de equipe', () => {
    const resultado = validarUsuario({
      nome: 'Ana Paula Ferreira',
      email: 'Ana.Paula@ESCRITORIO.adv.br',
      perfil: PerfilUsuario.OPERADOR,
    })

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    // E-mail normalizado, igual ao restante do sistema (regra 4 aplicada
    // ao e-mail: a mesma normalização evita duas linhas para o mesmo endereço).
    expect(resultado.dados.email).toBe('ana.paula@escritorio.adv.br')
    expect(resultado.dados.perfil).toBe(PerfilUsuario.OPERADOR)
  })

  it('aceita administrador', () => {
    const resultado = validarUsuario({
      nome: 'Sergio Ferreira',
      email: 'sergio@eferreira.adv.br',
      perfil: PerfilUsuario.ADMINISTRADOR,
    })
    expect(resultado.ok).toBe(true)
  })

  it('recusa nome curto demais', () => {
    const resultado = validarUsuario({
      nome: 'Zé',
      email: 'ze@eferreira.adv.br',
      perfil: PerfilUsuario.OPERADOR,
    })
    expect(resultado.ok).toBe(false)
    if (resultado.ok) return
    expect(resultado.erros['nome']).toBeDefined()
  })

  it('recusa e-mail inválido', () => {
    const resultado = validarUsuario({
      nome: 'Ana Paula Ferreira',
      email: 'não-é-email',
      perfil: PerfilUsuario.OPERADOR,
    })
    expect(resultado.ok).toBe(false)
    if (resultado.ok) return
    expect(resultado.erros['email']).toBeDefined()
  })

  /**
   * Esta tela é só da equipe. O perfil CLIENTE não aparece no seletor, mas
   * regra 2 vale para o que o navegador manda também: a validação recusa
   * mesmo que alguém force o valor.
   */
  it('recusa perfil CLIENTE, mesmo que o navegador mande', () => {
    const resultado = validarUsuario({
      nome: 'Alguém',
      email: 'alguem@eferreira.adv.br',
      perfil: PerfilUsuario.CLIENTE,
    })
    expect(resultado.ok).toBe(false)
    if (resultado.ok) return
    expect(resultado.erros['perfil']).toBeDefined()
  })

  it('recusa perfil desconhecido', () => {
    const resultado = validarUsuario({
      nome: 'Alguém',
      email: 'alguem@eferreira.adv.br',
      perfil: 'SUPERUSUARIO',
    })
    expect(resultado.ok).toBe(false)
  })
})
