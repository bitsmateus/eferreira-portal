import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { TopoDaPagina } from '@/componentes/topo-da-pagina'
import { listarResponsaveis, obterCaso } from '@/lib/casos'
import { formatarNumeroDeProcesso } from '@/lib/formatos'
import { formatarReais } from '@/lib/extenso'
import { dataParaDiaCivil } from '@/lib/datas'
import { exigirSessaoDaEquipe } from '@/lib/sessao'
import { salvarEdicaoDeCaso } from '../../acoes'
import { FormularioDeCaso, type ValoresDoCaso } from '../../formulario-de-caso'

export const metadata: Metadata = {
  title: 'Editar caso — E. Ferreira Advogados',
}

export default async function PaginaDeEdicaoDeCaso({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const sessao = await exigirSessaoDaEquipe()
  const { id } = await params

  const caso = await obterCaso(sessao, id)
  if (caso === null) notFound()

  const responsaveis = await listarResponsaveis(sessao)

  const valores: ValoresDoCaso = {
    numeroProcesso: caso.numeroProcesso ?? '',
    assunto: caso.assunto,
    vara: caso.vara ?? '',
    parteContraria: caso.parteContraria ?? '',
    situacao: caso.situacao,
    responsavelId: caso.responsavelId ?? '',
    honorarios:
      caso.honorariosEmCentavos === null
        ? ''
        : formatarReais(caso.honorariosEmCentavos).replace('R$ ', ''),
    parcelas: caso.parcelas.map((parcela) => ({
      valor: formatarReais(parcela.valorEmCentavos).replace('R$ ', ''),
      vencimento: dataParaDiaCivil(parcela.vencimento),
    })),
  }

  const acao = salvarEdicaoDeCaso.bind(null, caso.id)

  return (
    <>
      <TopoDaPagina
        titulo="Editar caso"
        subtitulo={
          <>
            {caso.numeroProcesso === null ? (
              caso.assunto
            ) : (
              <span className="mono">
                {formatarNumeroDeProcesso(caso.numeroProcesso)}
              </span>
            )}{' '}
            · {caso.cliente.nome}
          </>
        }
      />

      <div className="flex-1 overflow-auto px-6 py-6">
        <FormularioDeCaso
          acao={acao}
          valores={valores}
          responsaveis={responsaveis}
          rotuloDoBotao="Salvar alterações"
          hrefCancelar={`/painel/casos/${caso.id}`}
        />
      </div>
    </>
  )
}
