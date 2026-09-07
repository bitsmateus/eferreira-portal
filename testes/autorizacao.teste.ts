import { describe, expect, it } from 'vitest'
import { PerfilUsuario } from '@prisma/client'
import {
  SemAutorizacao,
  type SessaoServidor,
  ehEquipe,
  exigirAdministrador,
  exigirEquipe,
  filtroDeAndamentos,
  filtroDeCasos,
  filtroDeClientes,
  filtroDeDocumentos,
} from '@/lib/autorizacao'

const operador: SessaoServidor = {
  usuarioId: 'usuario-operador',
  perfil: PerfilUsuario.OPERADOR,
  clienteId: null,
  contratoAssinado: false,
}

const administrador: SessaoServidor = {
  usuarioId: 'usuario-admin',
  perfil: PerfilUsuario.ADMINISTRADOR,
  clienteId: null,
  contratoAssinado: false,
}

const clienteLiberado: SessaoServidor = {
  usuarioId: 'usuario-cliente-a',
  perfil: PerfilUsuario.CLIENTE,
  clienteId: 'cliente-a',
  contratoAssinado: true,
}

const clienteSemContrato: SessaoServidor = {
  usuarioId: 'usuario-cliente-b',
  perfil: PerfilUsuario.CLIENTE,
  clienteId: 'cliente-b',
  contratoAssinado: false,
}

const clienteSemVinculo: SessaoServidor = {
  usuarioId: 'usuario-cliente-c',
  perfil: PerfilUsuario.CLIENTE,
  clienteId: null,
  contratoAssinado: true,
}

describe('ehEquipe', () => {
  it('reconhece operador e administrador', () => {
    expect(ehEquipe(operador)).toBe(true)
    expect(ehEquipe(administrador)).toBe(true)
  })

  it('não trata cliente como equipe', () => {
    expect(ehEquipe(clienteLiberado)).toBe(false)
  })
})

describe('filtroDeCasos', () => {
  it('não restringe para a equipe do escritório', () => {
    expect(filtroDeCasos(operador)).toEqual({ AND: [{}] })
    expect(filtroDeCasos(administrador)).toEqual({ AND: [{}] })
  })

  it('prende o cliente ao próprio id, vindo da sessão do servidor', () => {
    expect(filtroDeCasos(clienteLiberado)).toEqual({
      AND: [{ clienteId: 'cliente-a' }],
    })
  })

  it('bloqueia o cliente antes da assinatura do contrato (Anexo I, 1.d)', () => {
    expect(() => filtroDeCasos(clienteSemContrato)).toThrow(SemAutorizacao)
  })

  it('bloqueia sessão de cliente sem cliente vinculado', () => {
    expect(() => filtroDeCasos(clienteSemVinculo)).toThrow(SemAutorizacao)
  })

  /**
   * Regra 3 — o teste que não se flexibiliza.
   *
   * O cenário é o do roadmap: o cliente A troca o id na URL para o caso do
   * cliente B. O critério que ele consegue influenciar entra como `extra`, e
   * precisa ficar SOB o filtro da sessão, nunca no lugar dele.
   */
  it('um id vindo do navegador não substitui a restrição da sessão', () => {
    const idDoCasoAlheio = 'caso-do-cliente-b'
    const filtro = filtroDeCasos(clienteLiberado, { id: idDoCasoAlheio })

    expect(filtro).toEqual({
      AND: [{ clienteId: 'cliente-a' }, { id: idDoCasoAlheio }],
    })

    // A restrição da sessão continua presente e íntegra.
    expect(filtro.AND).toContainEqual({ clienteId: 'cliente-a' })
  })

  it('um extra que tenta reescrever o clienteId não apaga a restrição', () => {
    const filtro = filtroDeCasos(clienteLiberado, { clienteId: 'cliente-b' })

    // As duas condições coexistem sob AND: o resultado é vazio, não o caso alheio.
    expect(filtro).toEqual({
      AND: [{ clienteId: 'cliente-a' }, { clienteId: 'cliente-b' }],
    })
    expect(filtro.AND).toContainEqual({ clienteId: 'cliente-a' })
  })

  it('o filtro nunca vira um OR, que ampliaria o resultado', () => {
    const filtro = filtroDeCasos(clienteLiberado, { situacao: 'EM_ANDAMENTO' })
    expect(Object.keys(filtro)).toEqual(['AND'])
    expect(filtro).not.toHaveProperty('OR')
  })
})

describe('filtroDeClientes', () => {
  it('a equipe vê todos', () => {
    expect(filtroDeClientes(operador)).toEqual({ AND: [{}] })
  })

  it('o cliente só se vê', () => {
    expect(filtroDeClientes(clienteLiberado)).toEqual({
      AND: [{ id: 'cliente-a' }],
    })
  })

  it('busca digitada pelo cliente não amplia o alcance', () => {
    const filtro = filtroDeClientes(clienteLiberado, {
      nome: { contains: 'Construtora' },
    })
    expect(filtro.AND).toContainEqual({ id: 'cliente-a' })
  })

  it('bloqueia antes da assinatura do contrato', () => {
    expect(() => filtroDeClientes(clienteSemContrato)).toThrow(SemAutorizacao)
  })
})

describe('filtroDeAndamentos', () => {
  it('a equipe vê todos', () => {
    expect(filtroDeAndamentos(administrador)).toEqual({ AND: [{}] })
  })

  it('o cliente só alcança andamentos dos próprios casos', () => {
    expect(filtroDeAndamentos(clienteLiberado)).toEqual({
      AND: [{ caso: { clienteId: 'cliente-a' } }],
    })
  })

  it('id de andamento vindo da URL entra sob a restrição da sessão', () => {
    const filtro = filtroDeAndamentos(clienteLiberado, {
      id: 'andamento-do-cliente-b',
    })
    expect(filtro.AND).toContainEqual({ caso: { clienteId: 'cliente-a' } })
  })

  it('bloqueia antes da assinatura do contrato', () => {
    expect(() => filtroDeAndamentos(clienteSemContrato)).toThrow(SemAutorizacao)
  })
})

describe('filtroDeDocumentos', () => {
  it('o cliente só alcança os próprios documentos', () => {
    expect(filtroDeDocumentos(clienteLiberado)).toEqual({
      AND: [{ clienteId: 'cliente-a' }],
    })
  })

  it('id de documento vindo da URL entra sob a restrição da sessão', () => {
    const filtro = filtroDeDocumentos(clienteLiberado, {
      id: 'documento-do-cliente-b',
    })
    expect(filtro.AND).toContainEqual({ clienteId: 'cliente-a' })
  })

  it('bloqueia antes da assinatura do contrato', () => {
    expect(() => filtroDeDocumentos(clienteSemContrato)).toThrow(SemAutorizacao)
  })
})

describe('exigências de perfil', () => {
  it('exigirEquipe deixa passar operador e administrador', () => {
    expect(() => exigirEquipe(operador)).not.toThrow()
    expect(() => exigirEquipe(administrador)).not.toThrow()
  })

  it('exigirEquipe barra o cliente', () => {
    expect(() => exigirEquipe(clienteLiberado)).toThrow(SemAutorizacao)
  })

  it('exigirAdministrador barra o operador', () => {
    expect(() => exigirAdministrador(operador)).toThrow(SemAutorizacao)
    expect(() => exigirAdministrador(clienteLiberado)).toThrow(SemAutorizacao)
    expect(() => exigirAdministrador(administrador)).not.toThrow()
  })
})
