import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { TopoDaPagina } from '@/componentes/topo-da-pagina'
import { obterCliente } from '@/lib/clientes'
import { formatarDocumento } from '@/lib/documento'
import { exigirSessaoDaEquipe } from '@/lib/sessao'
import { FormularioDeAnexo } from './formulario'

export const metadata: Metadata = {
  title: 'Anexar documento — E. Ferreira Advogados',
}

export default async function PaginaDeAnexo({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const sessao = await exigirSessaoDaEquipe()
  const { id } = await params

  const cliente = await obterCliente(sessao, id)
  if (cliente === null) notFound()

  const casos = cliente.casos.map((caso) => ({
    id: caso.id,
    numeroProcesso: caso.numeroProcesso,
    assunto: caso.assunto,
  }))

  return (
    <>
      <TopoDaPagina
        titulo="Anexar documento"
        subtitulo={
          <>
            Pasta de {cliente.nome} ·{' '}
            <span className="mono">{formatarDocumento(cliente.documento)}</span>
          </>
        }
      />

      <div className="flex-1 overflow-auto px-6 py-6">
        <FormularioDeAnexo clienteId={cliente.id} casos={casos} />
      </div>
    </>
  )
}
