import type { Metadata } from 'next'
import Link from 'next/link'

import { EtiquetaDeAcesso } from '@/componentes/situacoes'
import { TopoDaPagina } from '@/componentes/topo-da-pagina'
import { contarClientes, listarClientes } from '@/lib/clientes'
import { formatarData } from '@/lib/datas'
import { formatarDocumento } from '@/lib/documento'
import { exigirSessaoDaEquipe } from '@/lib/sessao'

export const metadata: Metadata = {
  title: 'Clientes — E. Ferreira Advogados',
}

export default async function PaginaDeClientes({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string }>
}) {
  // Regra 2: a sessão do servidor é quem monta o filtro da consulta.
  const sessao = await exigirSessaoDaEquipe()

  const { busca } = await searchParams
  const termo = busca ?? ''

  const [clientes, total] = await Promise.all([
    listarClientes(sessao, termo),
    contarClientes(sessao),
  ])

  const semEmail = clientes.filter((cliente) => !cliente.temEmail).length

  return (
    <>
      <TopoDaPagina
        titulo="Clientes"
        subtitulo={
          total === 1
            ? '1 cadastrado · organizados por CPF ou CNPJ'
            : `${total} cadastrados · organizados por CPF ou CNPJ`
        }
        acoes={
          <Link href="/painel/clientes/novo" className="botao">
            + Novo cliente
          </Link>
        }
      />

      <div className="flex-1 overflow-auto px-6 py-6">
        <div className="cartao mb-4">
          <div className="px-4 py-3.5">
            <form className="flex flex-wrap gap-2.5" method="get">
              <input
                type="search"
                name="busca"
                defaultValue={termo}
                aria-label="Buscar cliente"
                placeholder="Buscar por nome, CPF ou CNPJ…"
                className="campo-entrada min-w-0 flex-1"
              />
              <button type="submit" className="botao botao-secundario">
                Buscar
              </button>
              {termo !== '' && (
                <Link href="/painel/clientes" className="botao botao-fantasma">
                  Limpar
                </Link>
              )}
            </form>
          </div>
        </div>

        {clientes.length === 0 ? (
          <div className="cartao px-[18px] py-10 text-center">
            <p className="mb-1 text-[14px] font-medium text-texto-2">
              {termo === ''
                ? 'Nenhum cliente cadastrado ainda.'
                : 'Nenhum cliente encontrado para esta busca.'}
            </p>
            <p className="text-[12.5px] text-texto-3">
              {termo === '' ? (
                <>
                  O cadastro é o passo 1 do fluxo —{' '}
                  <Link
                    href="/painel/clientes/novo"
                    className="text-info underline underline-offset-2"
                  >
                    cadastrar o primeiro cliente
                  </Link>
                  .
                </>
              ) : (
                'A busca aceita nome, CPF ou CNPJ, com ou sem pontuação.'
              )}
            </p>
          </div>
        ) : (
          <div className="cartao">
            <div className="rolagem-lateral">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>CPF / CNPJ</th>
                    <th>Casos</th>
                    <th>Último andamento</th>
                    <th>Acesso</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {clientes.map((cliente) => (
                    <tr key={cliente.id}>
                      <td className="font-semibold">{cliente.nome}</td>
                      <td className="mono whitespace-nowrap text-[12px] text-texto-2">
                        {formatarDocumento(cliente.documento)}
                      </td>
                      <td className="mono">{cliente.quantidadeDeCasos}</td>
                      <td className="text-[12px] text-texto-2">
                        {cliente.ultimoAndamentoEm === null
                          ? '—'
                          : formatarData(cliente.ultimoAndamentoEm)}
                      </td>
                      <td>
                        <EtiquetaDeAcesso
                          acessoLiberado={cliente.acessoLiberado}
                          temEmail={cliente.temEmail}
                        />
                      </td>
                      <td className="text-right">
                        <Link
                          href={`/painel/clientes/${cliente.id}`}
                          className="botao botao-secundario botao-pequeno"
                        >
                          Abrir
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {semEmail > 0 && (
          <div className="aviso aviso-info mt-4">
            <span aria-hidden="true">▲</span>
            <div>
              <b>Sem e-mail, sem acesso.</b> O código de entrada do cliente vai por
              e-mail.{' '}
              {semEmail === 1
                ? 'Um cadastro desta lista está'
                : `${semEmail} cadastros desta lista estão`}{' '}
              sem e-mail válido e nunca vai virar consulta enquanto assim ficar.
            </div>
          </div>
        )}
      </div>
    </>
  )
}
