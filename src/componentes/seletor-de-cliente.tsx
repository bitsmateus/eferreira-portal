'use client'

import { formatarDocumento } from '@/lib/documento'
import { somenteDigitos } from '@/lib/formatos'
import { SeletorComBusca } from './seletor-com-busca'

export type ClienteParaEscolha = { id: string; nome: string; documento: string }

/** Só decide como um cliente aparece e como o texto digitado casa com ele. */
export function SeletorDeCliente({
  id,
  name = 'clienteId',
  clientes,
  valorInicial = '',
  aoEscolher,
  obrigatorio = false,
  opcaoEmBranco,
  placeholder = 'Busque por nome ou CPF/CNPJ…',
}: {
  id: string
  /** O campo que viaja no formulário. `clienteId` por padrão. */
  name?: string
  clientes: readonly ClienteParaEscolha[]
  valorInicial?: string
  aoEscolher?: (clienteId: string) => void
  obrigatorio?: boolean
  /**
   * Quando informado, "nenhum" vira um item de verdade da lista (id vazio) —
   * para campo opcional, como a empresa a que um caso está ligado, ou o
   * filtro "todas as empresas".
   */
  opcaoEmBranco?: string
  placeholder?: string
}) {
  const itens: readonly ClienteParaEscolha[] =
    opcaoEmBranco === undefined
      ? clientes
      : [{ id: '', nome: opcaoEmBranco, documento: '' }, ...clientes]

  return (
    <SeletorComBusca
      id={id}
      name={name}
      itens={itens}
      idDoItem={(cliente) => cliente.id}
      rotulo={(cliente) =>
        cliente.id === ''
          ? cliente.nome
          : `${cliente.nome} — ${formatarDocumento(cliente.documento)}`
      }
      bate={(cliente, termo) => {
        const digitos = somenteDigitos(termo)
        return (
          cliente.nome.toLowerCase().includes(termo) ||
          (digitos !== '' && cliente.documento.includes(digitos))
        )
      }}
      valorInicial={valorInicial}
      aoEscolher={aoEscolher}
      placeholder={placeholder}
      obrigatorio={obrigatorio}
    />
  )
}
