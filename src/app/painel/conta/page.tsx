import type { Metadata } from 'next'

import { TopoDaPagina } from '@/componentes/topo-da-pagina'
import { prisma } from '@/lib/prisma'
import { exigirSessaoDaEquipe } from '@/lib/sessao'
import { FormularioDaMinhaConta } from './formulario'

export const metadata: Metadata = {
  title: 'Minha conta — E. Ferreira Advogados',
}

export default async function PaginaDaMinhaConta() {
  const sessao = await exigirSessaoDaEquipe()

  // A conta é sempre a da sessão — não há id na rota.
  const eu = await prisma.usuario.findUnique({
    where: { id: sessao.usuarioId },
    select: { nome: true, email: true },
  })

  return (
    <>
      <TopoDaPagina titulo="Minha conta" subtitulo="Seus dados de acesso ao painel" />
      <div className="flex-1 overflow-auto px-6 py-6">
        <FormularioDaMinhaConta nome={eu?.nome ?? ''} email={eu?.email ?? ''} />
      </div>
    </>
  )
}
