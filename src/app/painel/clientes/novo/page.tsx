import type { Metadata } from 'next'

import { TopoDaPagina } from '@/componentes/topo-da-pagina'
import { exigirSessaoDaEquipe } from '@/lib/sessao'
import { cadastrarCliente } from '../acoes'
import { FormularioDeCliente, VALORES_VAZIOS } from '../formulario-de-cliente'

export const metadata: Metadata = {
  title: 'Novo cliente — E. Ferreira Advogados',
}

export default async function PaginaDeNovoCliente() {
  await exigirSessaoDaEquipe()

  return (
    <>
      <TopoDaPagina
        titulo="Novo cliente"
        subtitulo="Passo 1 — o CPF ou CNPJ é a chave de identificação em todo o sistema"
      />

      <div className="flex-1 overflow-auto px-6 py-6">
        <FormularioDeCliente
          acao={cadastrarCliente}
          valores={VALORES_VAZIOS}
          rotuloDoBotao="Salvar cliente"
          hrefCancelar="/painel/clientes"
          reconhecerAoDigitar
        />
      </div>
    </>
  )
}
