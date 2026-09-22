'use client'

import { formatarDocumento } from '@/lib/documento'
import { somenteDigitos } from '@/lib/formatos'
import { SeletorComBusca } from './seletor-com-busca'

export type ClienteParaEscolha = { id: string; nome: string; documento: string }

/** Só decide como um cliente aparece e como o texto digitado casa com ele. */
export function SeletorDeCliente({
  id,
  clientes,
  valorInicial = '',
  aoEscolher,
  obrigatorio = false,
}: {
  id: string
  clientes: readonly ClienteParaEscolha[]
  valorInicial?: string
  aoEscolher?: (clienteId: string) => void
  obrigatorio?: boolean
}) {
  return (
    <SeletorComBusca
      id={id}
      name="clienteId"
      itens={clientes}
      idDoItem={(cliente) => cliente.id}
      rotulo={(cliente) => `${cliente.nome} — ${formatarDocumento(cliente.documento)}`}
      bate={(cliente, termo) => {
        const digitos = somenteDigitos(termo)
        return (
          cliente.nome.toLowerCase().includes(termo) ||
          (digitos !== '' && cliente.documento.includes(digitos))
        )
      }}
      valorInicial={valorInicial}
      aoEscolher={aoEscolher}
      placeholder="Busque por nome ou CPF/CNPJ…"
      obrigatorio={obrigatorio}
    />
  )
}
