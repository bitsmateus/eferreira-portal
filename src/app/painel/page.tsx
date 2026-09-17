/**
 * O painel — visão geral e relatórios.
 *
 * Pedido do escritório (16/09/2026): mais indicadores visíveis, e clicar num
 * indicador (ex.: "Clientes cadastrados") filtra AQUI MESMO, sem sair do
 * painel.
 *
 * Por isso os indicadores não levam mais direto para `/painel/clientes` ou
 * `/painel/casos` — levam para `/painel?secao=clientes&...`, que é esta
 * própria rota com um filtro na query string. A tela lê o filtro e mostra uma
 * tabela reduzida logo abaixo dos indicadores, reaproveitando exatamente os
 * mesmos filtros da lista de Clientes e da lista de Casos: uma lista só de
 * regras, para a tela e o servidor nunca discordarem sobre o que cada filtro
 * significa.
 *
 * "Ver lista completa" leva para a lista de verdade, com os mesmos filtros —
 * o painel mostra só uma amostra, para não virar uma segunda tela de listar.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { SituacaoCaso, SituacaoDoEnvio, TipoPessoa } from '@prisma/client'

import { LinhaDoTempo } from '@/componentes/linha-do-tempo'
import { EtiquetaDeAcesso, EtiquetaDeSituacaoDoCaso } from '@/componentes/situacoes'
import { TopoDaPagina } from '@/componentes/topo-da-pagina'
import { contarAndamentos, listarUltimosAndamentos } from '@/lib/andamentos'
import {
  contarCasos,
  lerFiltrosDeCaso,
  listarCasos,
  type FiltrosDeCaso,
} from '@/lib/casos'
import {
  contarClientes,
  lerFiltrosDeCliente,
  listarClientes,
  type FiltrosDeCliente,
} from '@/lib/clientes'
import { filtroDeCasos, filtroDeClientes, filtroDeDocumentos, type SessaoServidor } from '@/lib/autorizacao'
import { formatarDiaPorExtensoComSemana } from '@/lib/datas'
import { formatarDocumento } from '@/lib/documento'
import { formatarNumeroDeProcesso } from '@/lib/formatos'
import { prisma } from '@/lib/prisma'
import { exigirSessaoDaEquipe } from '@/lib/sessao'

export const metadata: Metadata = {
  title: 'Painel — E. Ferreira Advogados',
}

type Consulta = {
  secao?: string
  tipo?: string
  acesso?: string
  casos?: string
  situacao?: string
  responsavel?: string
  numero?: string
}

/** Monta a query string só com os pares que têm valor — nada de "tipo=". */
function paraQuery(pares: Record<string, string | undefined>): string {
  const busca = new URLSearchParams()
  for (const [chave, valor] of Object.entries(pares)) {
    if (valor !== undefined && valor !== '') busca.set(chave, valor)
  }
  const texto = busca.toString()
  return texto === '' ? '' : `?${texto}`
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

/**
 * Um relatório pequeno: título e uma lista de números. Cada linha com `href`
 * leva ao mesmo filtro nesta própria tela; sem `href` é só o número — hoje
 * só a assinatura eletrônica não tem uma lista própria para filtrar (fica
 * para quando a tela de Documentos existir).
 */
function CardDeRelatorio({
  titulo,
  linhas,
}: {
  titulo: string
  linhas: readonly { rotulo: string; valor: number; href?: string }[]
}) {
  return (
    <div className="cartao min-w-0">
      <div className="cartao-cabecalho">
        <h2>{titulo}</h2>
      </div>
      <div className="cartao-corpo">
        {linhas.map((linha) => {
          const conteudo = (
            <>
              <span className="text-[12.5px] text-texto-2">{linha.rotulo}</span>
              <span className="mono ml-auto text-[14px] font-semibold">{linha.valor}</span>
            </>
          )
          return linha.href === undefined ? (
            <div
              key={linha.rotulo}
              className="flex items-center gap-2 border-b border-prata-100 py-2 last:border-b-0"
            >
              {conteudo}
            </div>
          ) : (
            <Link
              key={linha.rotulo}
              href={linha.href}
              className="flex items-center gap-2 border-b border-prata-100 py-2 last:border-b-0 hover:text-info"
            >
              {conteudo}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function descreverFiltroDeCliente(filtros: FiltrosDeCliente): string | null {
  const partes: string[] = []
  if (filtros.tipo === 'FISICA') partes.push('pessoa física')
  if (filtros.tipo === 'JURIDICA') partes.push('pessoa jurídica')
  if (filtros.acesso === 'liberado') partes.push('acesso liberado')
  if (filtros.acesso === 'aguardando') partes.push('aguardando assinatura do contrato')
  if (filtros.acesso === 'sem_email') partes.push('sem e-mail no cadastro')
  if (filtros.casos === 'com') partes.push('com caso vinculado')
  if (filtros.casos === 'sem') partes.push('sem caso vinculado')
  return partes.length === 0 ? null : partes.join(' · ')
}

function descreverFiltroDeCaso(filtros: FiltrosDeCaso): string | null {
  const partes: string[] = []
  if (filtros.situacao === SituacaoCaso.EM_ANDAMENTO) partes.push('em andamento')
  if (filtros.situacao === SituacaoCaso.ARQUIVADO) partes.push('arquivados')
  if (filtros.responsavel === 'sem') partes.push('sem responsável definido')
  if (filtros.numero === 'com') partes.push('com número de processo')
  if (filtros.numero === 'sem') partes.push('sem número — pré-processual')
  return partes.length === 0 ? null : partes.join(' · ')
}

/** A amostra de clientes, com o mesmo filtro da lista de Clientes. */
async function TabelaDeClientesNoPainel({
  sessao,
  filtros,
}: {
  sessao: SessaoServidor
  filtros: FiltrosDeCliente
}) {
  const LIMITE = 10
  const lista = await listarClientes(sessao, '', filtros)
  const linhas = lista.linhas.slice(0, LIMITE)
  const query = paraQuery({ tipo: filtros.tipo, acesso: filtros.acesso, casos: filtros.casos })
  const descricao = descreverFiltroDeCliente(filtros)

  return (
    <div className="cartao mb-4">
      <div className="cartao-cabecalho">
        <h2>Clientes filtrados</h2>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <span className="text-[12px] text-texto-2">
            {lista.linhas.length === 1 ? '1 resultado' : `${lista.linhas.length} resultados`}
          </span>
          <Link
            href={`/painel/clientes${query}`}
            className="botao botao-secundario botao-pequeno"
          >
            Ver lista completa
          </Link>
          <Link href="/painel" className="botao botao-fantasma botao-pequeno">
            Limpar
          </Link>
        </div>
      </div>

      {descricao !== null && (
        <div className="border-b border-prata-100 px-[18px] py-2 text-[12px] text-texto-2">
          Filtro: {descricao}
        </div>
      )}

      {linhas.length === 0 ? (
        <div className="px-[18px] py-8 text-center text-[13px] text-texto-2">
          Nenhum cliente com este filtro.
        </div>
      ) : (
        <div className="rolagem-lateral">
          <table className="tabela">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>CPF / CNPJ</th>
                <th>Casos</th>
                <th>Acesso</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {linhas.map((cliente) => (
                <tr key={cliente.id}>
                  <td className="font-semibold">{cliente.nome}</td>
                  <td className="mono whitespace-nowrap text-[12px] text-texto-2">
                    {formatarDocumento(cliente.documento)}
                  </td>
                  <td className="mono">{cliente.quantidadeDeCasos}</td>
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
      )}

      {lista.linhas.length > LIMITE && (
        <div className="border-t border-prata-100 px-[18px] py-2.5 text-[12px] text-texto-2">
          Mostrando os {LIMITE} primeiros de {lista.linhas.length} —{' '}
          <Link href={`/painel/clientes${query}`} className="underline underline-offset-2">
            ver todos
          </Link>
          .
        </div>
      )}
    </div>
  )
}

/** A amostra de casos, com o mesmo filtro da lista de Casos. */
async function TabelaDeCasosNoPainel({
  sessao,
  filtros,
}: {
  sessao: SessaoServidor
  filtros: FiltrosDeCaso
}) {
  const LIMITE = 10
  const lista = await listarCasos(sessao, '', filtros)
  const linhas = lista.linhas.slice(0, LIMITE)
  const query = paraQuery({
    situacao: filtros.situacao,
    responsavel: filtros.responsavel,
    numero: filtros.numero,
  })
  const descricao = descreverFiltroDeCaso(filtros)

  return (
    <div className="cartao mb-4">
      <div className="cartao-cabecalho">
        <h2>Casos filtrados</h2>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <span className="text-[12px] text-texto-2">
            {lista.linhas.length === 1 ? '1 resultado' : `${lista.linhas.length} resultados`}
          </span>
          <Link href={`/painel/casos${query}`} className="botao botao-secundario botao-pequeno">
            Ver lista completa
          </Link>
          <Link href="/painel" className="botao botao-fantasma botao-pequeno">
            Limpar
          </Link>
        </div>
      </div>

      {descricao !== null && (
        <div className="border-b border-prata-100 px-[18px] py-2 text-[12px] text-texto-2">
          Filtro: {descricao}
        </div>
      )}

      {linhas.length === 0 ? (
        <div className="px-[18px] py-8 text-center text-[13px] text-texto-2">
          Nenhum caso com este filtro.
        </div>
      ) : (
        <div className="rolagem-lateral">
          <table className="tabela">
            <thead>
              <tr>
                <th>Número do processo</th>
                <th>Assunto</th>
                <th>Cliente</th>
                <th>Situação</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {linhas.map((caso) => (
                <tr key={caso.id}>
                  <td className="mono whitespace-nowrap font-semibold">
                    {caso.numeroProcesso === null ? (
                      <span className="font-normal text-texto-3">sem número ainda</span>
                    ) : (
                      formatarNumeroDeProcesso(caso.numeroProcesso)
                    )}
                  </td>
                  <td>{caso.assunto}</td>
                  <td>
                    <Link
                      href={`/painel/clientes/${caso.cliente.id}`}
                      className="underline decoration-borda underline-offset-2 hover:decoration-texto-2"
                    >
                      {caso.cliente.nome}
                    </Link>
                  </td>
                  <td>
                    <EtiquetaDeSituacaoDoCaso situacao={caso.situacao} />
                  </td>
                  <td className="text-right">
                    <Link
                      href={`/painel/casos/${caso.id}`}
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
      )}

      {lista.linhas.length > LIMITE && (
        <div className="border-t border-prata-100 px-[18px] py-2.5 text-[12px] text-texto-2">
          Mostrando os {LIMITE} primeiros de {lista.linhas.length} —{' '}
          <Link href={`/painel/casos${query}`} className="underline underline-offset-2">
            ver todos
          </Link>
          .
        </div>
      )}
    </div>
  )
}

export default async function PaginaDoPainel({
  searchParams,
}: {
  searchParams: Promise<Consulta>
}) {
  // Segunda barreira, independente do middleware (regra 2).
  const sessao = await exigirSessaoDaEquipe()

  const consulta = await searchParams
  const secao =
    consulta.secao === 'clientes' || consulta.secao === 'casos' ? consulta.secao : null

  const filtrosDeCliente = lerFiltrosDeCliente(consulta)
  const filtrosDeCaso = lerFiltrosDeCaso(consulta)

  const [
    clientes,
    casos,
    semEmail,
    comAcesso,
    andamentos,
    ultimos,
    clientesPF,
    clientesPJ,
    aguardandoAssinaturaDeContrato,
    casosEmAndamento,
    casosArquivados,
    casosSemResponsavel,
    casosSemNumero,
    enviosAguardando,
    enviosAssinados,
  ] = await Promise.all([
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
    prisma.cliente.count({ where: filtroDeClientes(sessao, { tipoPessoa: TipoPessoa.FISICA }) }),
    prisma.cliente.count({ where: filtroDeClientes(sessao, { tipoPessoa: TipoPessoa.JURIDICA }) }),
    prisma.cliente.count({ where: filtroDeClientes(sessao, { contratoAssinadoEm: null }) }),
    prisma.caso.count({ where: filtroDeCasos(sessao, { situacao: SituacaoCaso.EM_ANDAMENTO }) }),
    prisma.caso.count({ where: filtroDeCasos(sessao, { situacao: SituacaoCaso.ARQUIVADO }) }),
    prisma.caso.count({ where: filtroDeCasos(sessao, { responsavelId: null }) }),
    prisma.caso.count({ where: filtroDeCasos(sessao, { numeroProcesso: null }) }),
    prisma.envioParaAssinatura.count({
      where: { documento: filtroDeDocumentos(sessao, {}), situacao: SituacaoDoEnvio.AGUARDANDO },
    }),
    prisma.envioParaAssinatura.count({
      where: { documento: filtroDeDocumentos(sessao, {}), situacao: SituacaoDoEnvio.ASSINADO },
    }),
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
            href="/painel?secao=clientes"
          />
          <Indicador
            rotulo="Casos"
            valor={casos}
            pe="vinculados a um cliente"
            href="/painel?secao=casos"
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
            href="/painel?secao=clientes&acesso=sem_email"
          />
        </div>

        {/*
          Os três cards abaixo são os "relatórios": o mesmo dado dos
          indicadores, quebrado por categoria, e cada linha leva ao filtro
          correspondente nesta mesma tela.
        */}
        <div className="mb-4 grid gap-4 lg:grid-cols-3">
          <CardDeRelatorio
            titulo="Clientes por tipo"
            linhas={[
              {
                rotulo: 'Pessoa física',
                valor: clientesPF,
                href: '/painel?secao=clientes&tipo=FISICA',
              },
              {
                rotulo: 'Pessoa jurídica',
                valor: clientesPJ,
                href: '/painel?secao=clientes&tipo=JURIDICA',
              },
            ]}
          />
          <CardDeRelatorio
            titulo="Acesso ao portal"
            linhas={[
              {
                rotulo: 'Liberado',
                valor: comAcesso,
                href: '/painel?secao=clientes&acesso=liberado',
              },
              {
                rotulo: 'Aguardando assinatura do contrato',
                valor: aguardandoAssinaturaDeContrato,
                href: '/painel?secao=clientes&acesso=aguardando',
              },
              {
                rotulo: 'Sem e-mail no cadastro',
                valor: semEmail,
                href: '/painel?secao=clientes&acesso=sem_email',
              },
            ]}
          />
          <CardDeRelatorio
            titulo="Casos"
            linhas={[
              {
                rotulo: 'Em andamento',
                valor: casosEmAndamento,
                href: '/painel?secao=casos&situacao=EM_ANDAMENTO',
              },
              {
                rotulo: 'Arquivados',
                valor: casosArquivados,
                href: '/painel?secao=casos&situacao=ARQUIVADO',
              },
              {
                rotulo: 'Sem responsável definido',
                valor: casosSemResponsavel,
                href: '/painel?secao=casos&responsavel=sem',
              },
              {
                rotulo: 'Sem número — pré-processual',
                valor: casosSemNumero,
                href: '/painel?secao=casos&numero=sem',
              },
            ]}
          />
        </div>

        {/*
          Sem link: ainda não existe uma lista de envios para filtrar (fica
          para a tela de Documentos, item pendente da lista de melhorias).
        */}
        <div className="mb-4 grid gap-4 sm:grid-cols-2">
          <CardDeRelatorio
            titulo="Assinatura eletrônica"
            linhas={[
              { rotulo: 'Aguardando assinatura', valor: enviosAguardando },
              { rotulo: 'Assinados', valor: enviosAssinados },
            ]}
          />
        </div>

        {secao === 'clientes' && (
          <TabelaDeClientesNoPainel sessao={sessao} filtros={filtrosDeCliente} />
        )}
        {secao === 'casos' && (
          <TabelaDeCasosNoPainel sessao={sessao} filtros={filtrosDeCaso} />
        )}

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
