import type { Metadata } from 'next'
import Link from 'next/link'

import { LinhaDoTempo } from '@/componentes/linha-do-tempo'
import { TopoDaPagina } from '@/componentes/topo-da-pagina'
import { contarAndamentos, listarUltimosAndamentos } from '@/lib/andamentos'
import { contarCasos } from '@/lib/casos'
import { contarClientes } from '@/lib/clientes'
import { filtroDeClientes } from '@/lib/autorizacao'
import { formatarDiaPorExtensoComSemana } from '@/lib/datas'
import { prisma } from '@/lib/prisma'
import { exigirSessaoDaEquipe } from '@/lib/sessao'

export const metadata: Metadata = {
  title: 'Painel — E. Ferreira Advogados',
}

function Indicador({
  rotulo,
  valor,
  pe,
  href,
}: {
  rotulo: string
  valor: number
  pe: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="cartao block px-[18px] py-4 transition-colors hover:border-prata-300"
    >
      <div className="text-[12px] text-texto-2">{rotulo}</div>
      <div className="mono mt-1.5 text-[27px] font-semibold tracking-[-0.02em]">
        {valor}
      </div>
      <div className="mt-0.5 text-[11.5px] text-texto-3">{pe}</div>
    </Link>
  )
}

export default async function PaginaDoPainel() {
  // Segunda barreira, independente do middleware (regra 2).
  const sessao = await exigirSessaoDaEquipe()

  const [clientes, casos, semEmail, comAcesso, andamentos, ultimos] = await Promise.all([
    contarClientes(sessao),
    contarCasos(sessao),
    prisma.cliente.count({
      where: filtroDeClientes(sessao, { OR: [{ email: null }, { email: '' }] }),
    }),
    prisma.cliente.count({
      where: filtroDeClientes(sessao, { contratoAssinadoEm: { not: null } }),
    }),
    contarAndamentos(sessao),
    listarUltimosAndamentos(sessao),
  ])

  return (
    <>
      <TopoDaPagina
        titulo="Painel"
        subtitulo={formatarDiaPorExtensoComSemana(new Date())}
      />

      <div className="flex-1 overflow-auto px-6 py-6">
        <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Indicador
            rotulo="Clientes cadastrados"
            valor={clientes}
            pe="por CPF ou CNPJ"
            href="/painel/clientes"
          />
          <Indicador
            rotulo="Casos"
            valor={casos}
            pe="vinculados a um cliente"
            href="/painel/casos"
          />
          <Indicador
            rotulo="Andamentos"
            valor={andamentos}
            pe="lançados pela equipe"
            href="/painel/casos"
          />
          <Indicador
            rotulo="Sem e-mail"
            valor={semEmail}
            pe="não recebem o código de acesso"
            href="/painel/clientes"
          />
        </div>

        <div className="cartao">
          <div className="cartao-cabecalho">
            <h2>Últimos andamentos lançados</h2>
            <span className="ml-auto text-[12px] text-texto-2">
              {comAcesso === 1
                ? '1 cliente com acesso liberado'
                : `${comAcesso} clientes com acesso liberado`}
            </span>
          </div>
          <div className={ultimos.length === 0 ? '' : 'px-[18px] py-5'}>
            <LinhaDoTempo andamentos={ultimos} mostrarCaso />
          </div>
        </div>
      </div>
    </>
  )
}
