/**
 * Novo caso a partir da lista de Casos.
 *
 * O caso também nasce dentro da ficha do cliente (`/painel/clientes/[id]/casos/novo`),
 * e lá o dono já está decidido. Aqui ele não está — por isso o formulário
 * ganha o seletor de cliente, e ele é obrigatório: caso sem cliente não tem
 * de quem seja o processo nem para quem mostrar o andamento.
 */

import type { Metadata } from 'next'
import Link from 'next/link'

import { TopoDaPagina } from '@/componentes/topo-da-pagina'
import { listarResponsaveis } from '@/lib/casos'
import { listarClientesParaEscolha } from '@/lib/clientes'
import { exigirSessaoDaEquipe } from '@/lib/sessao'
import { cadastrarCaso } from '@/app/painel/casos/acoes'
import {
  FormularioDeCaso,
  VALORES_VAZIOS,
} from '@/app/painel/casos/formulario-de-caso'

export const metadata: Metadata = {
  title: 'Novo caso — E. Ferreira Advogados',
}

export default async function PaginaDeNovoCasoAvulso() {
  const sessao = await exigirSessaoDaEquipe()

  const [responsaveis, clientes] = await Promise.all([
    listarResponsaveis(sessao),
    listarClientesParaEscolha(sessao),
  ])

  // Sem nenhum cliente não há caso possível, e um seletor vazio só faria a
  // pessoa preencher o formulário inteiro para descobrir isso no fim.
  if (clientes.length === 0) {
    return (
      <>
        <TopoDaPagina titulo="Novo caso" subtitulo="Todo caso pertence a um cliente" />
        <div className="flex-1 overflow-auto px-6 py-6">
          <div className="max-w-[640px]">
            <div className="aviso aviso-atencao">
              <span aria-hidden="true">▲</span>
              <div>
                <b>Nenhum cliente cadastrado ainda.</b> O caso nasce sempre sob um
                cliente, então o cadastro vem primeiro —{' '}
                <Link
                  href="/painel/clientes/novo"
                  className="underline underline-offset-2"
                >
                  cadastrar o primeiro cliente
                </Link>
                .
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <TopoDaPagina
        titulo="Novo caso"
        subtitulo="Escolha o cliente e descreva o caso"
        acoes={
          <Link href="/painel/casos" className="botao botao-secundario">
            Voltar aos casos
          </Link>
        }
      />

      <div className="flex-1 overflow-auto px-6 py-6">
        <FormularioDeCaso
          // Nulo: o cliente vem do seletor, e quem confere se esta sessão
          // pode usá-lo é `criarCaso`, pelo filtro da sessão (regra 2).
          acao={cadastrarCaso.bind(null, null)}
          valores={VALORES_VAZIOS}
          responsaveis={responsaveis}
          clientes={clientes}
          rotuloDoBotao="Salvar caso"
          hrefCancelar="/painel/casos"
        />
      </div>
    </>
  )
}
