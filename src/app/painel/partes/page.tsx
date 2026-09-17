import type { Metadata } from 'next'

import { TopoDaPagina } from '@/componentes/topo-da-pagina'
import { listarPartes } from '@/lib/partes'
import { exigirSessaoDaEquipe } from '@/lib/sessao'
import { ListaDePartes, NovaParte } from './lista'

export const metadata: Metadata = {
  title: 'Partes — E. Ferreira Advogados',
}

export default async function PaginaDePartes() {
  const sessao = await exigirSessaoDaEquipe()
  const partes = await listarPartes(sessao)

  return (
    <>
      <TopoDaPagina
        titulo="Partes"
        subtitulo="Quem assina um documento avulso sem ser cliente do escritório"
      />

      <div className="flex-1 overflow-auto px-6 py-6">
        {/*
          `min-w-0` nos dois filhos do grid — mesma armadilha do
          `min-height: auto` do flexbox, no eixo horizontal.
        */}
        <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          <div className="min-w-0">
            <NovaParte />
          </div>

          <div className="min-w-0">
            <ListaDePartes partes={partes} />

            <div className="aviso aviso-info mt-4">
              <span aria-hidden="true">▲</span>
              <div>
                <b>Este cadastro nunca vira cliente.</b> É separado de propósito —
                parte contrária, testemunha e advogado externo não têm caso, pasta
                nem acesso ao portal. Serve só para escolher quem assina um
                documento avulso, na tela de assinatura de cada anexo.
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
