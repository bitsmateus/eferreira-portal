import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { TopoDaPagina } from '@/componentes/topo-da-pagina'
import { listarResponsaveis } from '@/lib/casos'
import { obterCliente } from '@/lib/clientes'
import { formatarDocumento } from '@/lib/documento'
import { exigirSessaoDaEquipe } from '@/lib/sessao'
import { cadastrarCaso } from '@/app/painel/casos/acoes'
import {
  FormularioDeCaso,
  VALORES_VAZIOS,
} from '@/app/painel/casos/formulario-de-caso'

export const metadata: Metadata = {
  title: 'Novo caso — E. Ferreira Advogados',
}

export default async function PaginaDeNovoCaso({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const sessao = await exigirSessaoDaEquipe()
  const { id } = await params

  // O caso só pode nascer sob um cliente que esta sessão enxerga.
  const cliente = await obterCliente(sessao, id)
  if (cliente === null) notFound()

  const responsaveis = await listarResponsaveis(sessao)
  const acao = cadastrarCaso.bind(null, cliente.id)

  return (
    <>
      <TopoDaPagina
        titulo="Novo caso"
        subtitulo={
          <>
            Passo 2 — {cliente.nome} ·{' '}
            <span className="mono">{formatarDocumento(cliente.documento)}</span>
          </>
        }
      />

      <div className="flex-1 overflow-auto px-6 py-6">
        <FormularioDeCaso
          acao={acao}
          valores={VALORES_VAZIOS}
          responsaveis={responsaveis}
          rotuloDoBotao="Salvar caso"
          hrefCancelar={`/painel/clientes/${cliente.id}`}
        />
      </div>
    </>
  )
}
