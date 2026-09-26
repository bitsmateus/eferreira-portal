import type { Metadata } from 'next'

import { TopoDaPagina } from '@/componentes/topo-da-pagina'
import { listarAdvogados } from '@/lib/advogados'
import { exigirSessaoDaEquipe } from '@/lib/sessao'
import { ListaDeAdvogados, NovoAdvogado } from './lista'

export const metadata: Metadata = {
  title: 'Advogados — E. Ferreira Advogados',
}

export default async function PaginaDeAdvogados() {
  const sessao = await exigirSessaoDaEquipe()
  const advogados = await listarAdvogados(sessao)

  return (
    <>
      <TopoDaPagina
        titulo="Advogados"
        subtitulo="Quem pode ser o outorgado da procuração"
      />

      <div className="flex-1 overflow-auto px-6 py-6">
        {/*
          `min-w-0` nos dois filhos do grid — mesma armadilha do
          `min-height: auto` do flexbox, no eixo horizontal.
        */}
        <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          <div className="min-w-0">
            <NovoAdvogado />
          </div>

          <div className="min-w-0">
            <ListaDeAdvogados advogados={advogados} />

            <div className="aviso aviso-info mt-4">
              <span aria-hidden="true">▲</span>
              <div>
                <b>Isto não é um usuário do sistema.</b> O advogado cadastrado aqui só
                aparece como outorgado na procuração: não entra no painel e não assina
                nada. O endereço, o e-mail e o telefone que a procuração cita são os do
                escritório, iguais para todos. O <b>padrão</b> é o que já vem escolhido
                em &ldquo;Gerar documento&rdquo;.
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
