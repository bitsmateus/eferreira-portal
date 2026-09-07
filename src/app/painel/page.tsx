import type { Metadata } from 'next'
import { formatarDiaPorExtensoComSemana } from '@/lib/datas'
import { exigirSessaoDaEquipe } from '@/lib/sessao'

export const metadata: Metadata = {
  title: 'Painel — E. Ferreira Advogados',
}

/**
 * Painel vazio da Sprint 0. Os indicadores, a lista de últimos andamentos e o
 * bloco "Precisa de você" do protótipo entram a partir da Sprint 1, quando
 * existirem cliente, caso e andamento para contar.
 */
export default async function PaginaDoPainel() {
  // Segunda barreira, independente do middleware (regra 2).
  await exigirSessaoDaEquipe()

  return (
    <>
      <header className="flex flex-wrap items-center gap-3.5 border-b border-borda bg-superficie px-6 py-4">
        <div>
          <h1 className="text-[17px] font-semibold tracking-[-0.01em]">Painel</h1>
          <p className="mt-0.5 text-[12.5px] text-texto-2">
            {formatarDiaPorExtensoComSemana(new Date())}
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-auto px-6 py-6">
        <div className="cartao">
          <div className="px-[18px] py-10 text-center">
            <p className="mb-1 text-[14px] font-medium text-texto-2">
              Fundação de pé.
            </p>
            <p className="text-[12.5px] text-texto-3">
              Ainda não há cliente, caso nem andamento para exibir. O cadastro
              entra na Sprint 1; os andamentos e a pasta única, na Sprint 2.
            </p>
          </div>
        </div>

        <div className="aviso aviso-info mt-4">
          <span aria-hidden="true">▲</span>
          <div>
            <b>Pendências do escritório que travam as próximas sprints.</b> A
            lista de status de andamento (Anexo II, 3.5) trava a Sprint 2; os
            modelos de contrato, procuração e declaração (3.1) e as credenciais
            da plataforma de assinatura (3.3) travam a Sprint 3; a logo em vetor
            e as cores institucionais (3.2), a Sprint 5.
          </div>
        </div>
      </div>
    </>
  )
}
