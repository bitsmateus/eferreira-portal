import type { Metadata } from 'next'
import Link from 'next/link'
import { TipoPessoa } from '@prisma/client'

import { MenuDoCliente } from '@/componentes/menu-do-cliente'
import { EtiquetaDeAcesso } from '@/componentes/situacoes'
import { TopoDaPagina } from '@/componentes/topo-da-pagina'
import {
  LIMITE_DA_LISTA,
  algumFiltroDeClienteAtivo,
  contarClientes,
  lerFiltrosDeCliente,
  listarClientes,
} from '@/lib/clientes'
import { formatarData } from '@/lib/datas'
import { formatarDocumento } from '@/lib/documento'
import { exigirSessaoDaEquipe } from '@/lib/sessao'

export const metadata: Metadata = {
  title: 'Clientes — E. Ferreira Advogados',
}

type Consulta = {
  busca?: string
  tipo?: string
  acesso?: string
  casos?: string
}

export default async function PaginaDeClientes({
  searchParams,
}: {
  searchParams: Promise<Consulta>
}) {
  // Regra 2: a sessão do servidor é quem monta o filtro da consulta. Os
  // filtros da tela entram por dentro dele e só conseguem estreitar.
  const sessao = await exigirSessaoDaEquipe()

  const consulta = await searchParams
  const termo = consulta.busca ?? ''
  const filtros = lerFiltrosDeCliente(consulta)
  const filtrando = termo !== '' || algumFiltroDeClienteAtivo(filtros)

  const [lista, total] = await Promise.all([
    listarClientes(sessao, termo, filtros),
    contarClientes(sessao),
  ])

  const clientes = lista.linhas
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
            {/*
              Formulário GET simples: os filtros ficam na URL, então a tela
              filtrada pode ser recarregada, guardada nos favoritos e mandada
              para um colega. Sem JavaScript nenhum.
            */}
            <form className="flex flex-wrap items-end gap-2.5" method="get">
              <div className="min-w-[220px] flex-1">
                <label className="campo-rotulo" htmlFor="busca">
                  Buscar
                </label>
                <input
                  id="busca"
                  type="search"
                  name="busca"
                  defaultValue={termo}
                  placeholder="Nome, CPF ou CNPJ…"
                  className="campo-entrada"
                />
              </div>

              <div className="w-[150px]">
                <label className="campo-rotulo" htmlFor="tipo">
                  Tipo
                </label>
                <select
                  id="tipo"
                  name="tipo"
                  defaultValue={filtros.tipo}
                  className="campo-entrada"
                >
                  <option value="">Todos</option>
                  <option value={TipoPessoa.FISICA}>Pessoa física</option>
                  <option value={TipoPessoa.JURIDICA}>Pessoa jurídica</option>
                </select>
              </div>

              <div className="w-[190px]">
                <label className="campo-rotulo" htmlFor="acesso">
                  Acesso ao portal
                </label>
                <select
                  id="acesso"
                  name="acesso"
                  defaultValue={filtros.acesso}
                  className="campo-entrada"
                >
                  <option value="">Todos</option>
                  <option value="liberado">Liberado</option>
                  <option value="aguardando">Aguardando assinatura</option>
                  <option value="sem_email">Sem e-mail no cadastro</option>
                </select>
              </div>

              <div className="w-[150px]">
                <label className="campo-rotulo" htmlFor="casos">
                  Casos
                </label>
                <select
                  id="casos"
                  name="casos"
                  defaultValue={filtros.casos}
                  className="campo-entrada"
                >
                  <option value="">Todos</option>
                  <option value="com">Com caso</option>
                  <option value="sem">Sem caso</option>
                </select>
              </div>

              <button type="submit" className="botao botao-secundario">
                Filtrar
              </button>
              {filtrando && (
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
              {filtrando
                ? 'Nenhum cliente com estes filtros.'
                : 'Nenhum cliente cadastrado ainda.'}
            </p>
            <p className="text-[12.5px] text-texto-3">
              {filtrando ? (
                <>
                  A busca aceita nome, CPF ou CNPJ, com ou sem pontuação —{' '}
                  <Link
                    href="/painel/clientes"
                    className="text-info underline underline-offset-2"
                  >
                    limpar os filtros
                  </Link>
                  .
                </>
              ) : (
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
                    /*
                      A linha inteira abre a ficha. O link mora na primeira
                      célula e se estica por cima da linha com `after:inset-0`,
                      em vez de um `onClick` na linha: assim continua sendo um
                      link de verdade — abre em nova aba com o botão do meio,
                      aparece no teclado e o navegador mostra o endereço.
                    */
                    <tr key={cliente.id} className="relative hover:bg-prata-100/60">
                      <td className="font-semibold">
                        <Link
                          href={`/painel/clientes/${cliente.id}`}
                          className="after:absolute after:inset-0 after:content-['']"
                        >
                          {cliente.nome}
                        </Link>
                      </td>
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
                      {/*
                        `relative z-10`: sem isto, o `::after` esticado do link
                        da primeira célula fica por cima deste botão — clicar
                        nos três pontinhos abriria a ficha em vez do menu,
                        porque o pseudo-elemento intercepta o clique primeiro.
                      */}
                      <td className="relative z-10 text-right">
                        <MenuDoCliente clienteId={cliente.id} nome={cliente.nome} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {lista.truncada && (
          <div className="aviso aviso-atencao mt-4">
            <span aria-hidden="true">▲</span>
            <div>
              <b>A lista está cortada.</b> Mostrando os {LIMITE_DA_LISTA} primeiros de{' '}
              {total} cadastrados, em ordem alfabética. Use a busca ou os filtros
              para chegar a quem não aparece aqui.
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
