import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ExcluirClienteBotao } from '@/componentes/excluir-cliente-botao'
import { TopoDaPagina } from '@/componentes/topo-da-pagina'
import { obterCliente } from '@/lib/clientes'
import { dataParaDiaCivil } from '@/lib/datas'
import { formatarDocumento } from '@/lib/documento'
import { exigirSessaoDaEquipe } from '@/lib/sessao'
import { salvarEdicaoDeCliente } from '../../acoes'
import {
  FormularioDeCliente,
  type ValoresDoCliente,
} from '../../formulario-de-cliente'

export const metadata: Metadata = {
  title: 'Editar cliente — E. Ferreira Advogados',
}

export default async function PaginaDeEdicaoDeCliente({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const sessao = await exigirSessaoDaEquipe()
  const { id } = await params

  const cliente = await obterCliente(sessao, id)
  if (cliente === null) notFound()

  const valores: ValoresDoCliente = {
    documento: formatarDocumento(cliente.documento),
    nome: cliente.nome,
    rg: cliente.rg ?? '',
    dataNascimento:
      cliente.dataNascimento === null ? '' : dataParaDiaCivil(cliente.dataNascimento),
    estadoCivil: cliente.estadoCivil ?? '',
    profissao: cliente.profissao ?? '',
    nacionalidade: cliente.nacionalidade ?? '',
    nomeMae: cliente.nomeMae ?? '',
    email: cliente.email ?? '',
    telefone: cliente.telefone ?? '',
    cep: cliente.cep ?? '',
    endereco: cliente.endereco ?? '',
    cidade: cliente.cidade ?? '',
    uf: cliente.uf ?? '',
  }

  // O id é fixado no servidor. Ainda assim, `atualizarCliente` reconfere o
  // acesso pelo filtro da sessão antes de escrever (regra 2).
  const acao = salvarEdicaoDeCliente.bind(null, cliente.id)

  return (
    <>
      <TopoDaPagina
        titulo="Editar cliente"
        subtitulo={
          <>
            {cliente.nome} ·{' '}
            <span className="mono">{formatarDocumento(cliente.documento)}</span>
          </>
        }
        acoes={<ExcluirClienteBotao clienteId={cliente.id} nome={cliente.nome} />}
      />

      <div className="flex-1 overflow-auto px-6 py-6">
        <FormularioDeCliente
          acao={acao}
          valores={valores}
          rotuloDoBotao="Salvar alterações"
          hrefCancelar={`/painel/clientes/${cliente.id}`}
          reconhecerAoDigitar={false}
        />
      </div>
    </>
  )
}
