import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { BotaoFlutuanteDoWhatsapp } from '@/componentes/botao-flutuante-whatsapp'
import { Marca } from '@/componentes/marca'
import { SemAutorizacao } from '@/lib/autorizacao'
import { formatarDocumento } from '@/lib/documento'
import { ESCRITORIO } from '@/lib/escritorio'
import { prisma } from '@/lib/prisma'
import { exigirSessaoDeCliente } from '@/lib/sessao'
import { sairDaConsulta } from './acoes'

export const metadata: Metadata = {
  title: 'Seus processos — Portal do Cliente E. Ferreira',
}

export default async function LayoutDaAreaDoCliente({
  children,
}: {
  children: React.ReactNode
}) {
  // Regra 2 e regra 3: a barreira que vale é esta. O middleware apenas evita
  // que a página comece a montar; quem confirma perfil, vínculo e contrato
  // assinado é o banco, a cada requisição.
  let sessao
  try {
    sessao = await exigirSessaoDeCliente()
  } catch (erro) {
    if (erro instanceof SemAutorizacao) redirect('/consultar')
    throw erro
  }

  const cliente = await prisma.cliente.findUnique({
    where: { id: sessao.clienteId },
    select: { documento: true },
  })

  return (
    <div className="flex min-h-screen flex-col bg-fundo">
      <header className="flex flex-wrap items-center gap-3 bg-grafite-800 px-5 py-3.5">
        <Marca tamanho="pequena" />

        <div className="ml-auto text-right text-[11.5px] leading-snug text-[#8A8A92]">
          <b className="block text-[12.5px] text-[#E4E4E8]">{sessao.nome}</b>
          <span className="mono">
            {cliente === null ? '' : formatarDocumento(cliente.documento)}
          </span>
          {' · '}
          <form action={sairDaConsulta} className="inline">
            <button
              type="submit"
              className="underline underline-offset-2 hover:text-[#EDEDED]"
            >
              Sair
            </button>
          </form>
        </div>
      </header>

      {children}

      <BotaoFlutuanteDoWhatsapp numero={ESCRITORIO.whatsappDeSuporte} />
    </div>
  )
}
