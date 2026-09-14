import type { Metadata } from 'next'
import { PerfilUsuario } from '@prisma/client'

import { TopoDaPagina } from '@/componentes/topo-da-pagina'
import { listarUsuarios } from '@/lib/usuarios'
import { exigirSessaoDaEquipe } from '@/lib/sessao'
import { ListaDeUsuarios, NovoUsuario } from './usuarios'

export const metadata: Metadata = {
  title: 'Usuários — E. Ferreira Advogados',
}

export default async function PaginaDeUsuarios() {
  const sessao = await exigirSessaoDaEquipe()

  // CLAUDE.md, perfis: gestão de usuários é do administrador.
  // `listarUsuarios` exige o mesmo — a decisão não está aqui, está no
  // domínio; esta tela só evita o erro feio para o operador.
  if (sessao.perfil !== PerfilUsuario.ADMINISTRADOR) {
    return (
      <>
        <TopoDaPagina titulo="Usuários" subtitulo="Acesso da equipe ao painel" />
        <div className="flex-1 overflow-auto px-6 py-6">
          <div className="aviso aviso-atencao">
            <span aria-hidden="true">▲</span>
            <div>
              Os usuários da equipe são geridos pelo <b>administrador</b>. Fale com
              quem tem esse perfil no escritório.
            </div>
          </div>
        </div>
      </>
    )
  }

  const usuarios = await listarUsuarios(sessao)

  return (
    <>
      <TopoDaPagina
        titulo="Usuários"
        subtitulo="Quem acessa o painel do escritório — operadores e administradores"
      />

      <div className="flex-1 overflow-auto px-6 py-6">
        <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
          <div>
            <NovoUsuario />
          </div>
          <div>
            <ListaDeUsuarios usuarios={usuarios} idDoUsuarioAtual={sessao.usuarioId} />
          </div>
        </div>
      </div>
    </>
  )
}
