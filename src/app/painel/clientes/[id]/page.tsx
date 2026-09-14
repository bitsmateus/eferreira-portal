import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { TipoPessoa } from '@prisma/client'

import { PastaDoCliente } from '@/componentes/pasta-do-cliente'
import { RepresentantesLegais } from '@/componentes/representantes-legais'
import { EtiquetaDeAcesso, EtiquetaDeSituacaoDoCaso } from '@/componentes/situacoes'
import { TopoDaPagina } from '@/componentes/topo-da-pagina'
import { obterCliente } from '@/lib/clientes'
import { listarPastaDoCliente } from '@/lib/documentos'
import { formatarData } from '@/lib/datas'
import { formatarDocumento } from '@/lib/documento'
import {
  formatarCep,
  formatarNumeroDeProcesso,
  formatarTelefone,
} from '@/lib/formatos'
import { exigirSessaoDaEquipe } from '@/lib/sessao'

export const metadata: Metadata = {
  title: 'Ficha do cliente — E. Ferreira Advogados',
}

function Dado({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1.5 text-[12.5px] font-medium text-texto-2">{rotulo}</div>
      <div className="text-[13px]">{children}</div>
    </div>
  )
}

export default async function PaginaDaFichaDoCliente({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const sessao = await exigirSessaoDaEquipe()
  const { id } = await params

  // Regra 2: o id vem da URL, mas quem decide se ele pode ser lido é o filtro
  // montado a partir da sessão — nunca um findUnique direto.
  const cliente = await obterCliente(sessao, id)
  if (cliente === null) notFound()

  const documentos = await listarPastaDoCliente(sessao, cliente.id)

  const ehPessoaJuridica = cliente.tipoPessoa === TipoPessoa.JURIDICA

  const temEmail = cliente.email !== null && cliente.email !== ''
  const acessoLiberado = cliente.contratoAssinadoEm !== null

  return (
    <>
      <TopoDaPagina
        titulo={cliente.nome}
        subtitulo={
          <>
            <span className="mono">{formatarDocumento(cliente.documento)}</span> ·{' '}
            {cliente.tipoPessoa === TipoPessoa.FISICA
              ? 'Pessoa física'
              : 'Pessoa jurídica'}{' '}
            · cliente desde {formatarData(cliente.criadoEm)}
          </>
        }
        acoes={
          <>
            <EtiquetaDeAcesso acessoLiberado={acessoLiberado} temEmail={temEmail} />
            <Link
              href={`/painel/clientes/${cliente.id}/editar`}
              className="botao botao-secundario"
            >
              Editar
            </Link>
            <Link
              href={`/painel/clientes/${cliente.id}/casos/novo`}
              className="botao"
            >
              + Novo caso
            </Link>
          </>
        }
      />

      <div className="flex-1 overflow-auto px-6 py-6">
        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <div>
            <div className="cartao">
              <div className="cartao-cabecalho">
                <h2>Casos vinculados</h2>
                <span className="ml-auto text-[12px] text-texto-2">
                  {cliente.casos.length === 1
                    ? '1 caso'
                    : `${cliente.casos.length} casos`}
                </span>
              </div>

              {cliente.casos.length === 0 ? (
                <div className="px-[18px] py-9 text-center">
                  <p className="mb-1 text-[13.5px] font-medium text-texto-2">
                    Nenhum caso vinculado.
                  </p>
                  <p className="text-[12.5px] text-texto-3">
                    Um cliente pode ter vários casos, cada um com o seu número de
                    processo —{' '}
                    <Link
                      href={`/painel/clientes/${cliente.id}/casos/novo`}
                      className="text-info underline underline-offset-2"
                    >
                      cadastrar o primeiro
                    </Link>
                    .
                  </p>
                </div>
              ) : (
                <div className="rolagem-lateral">
                  <table className="tabela">
                    <thead>
                      <tr>
                        <th>Número do processo</th>
                        <th>Assunto</th>
                        <th>Situação</th>
                        <th>Último andamento</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {cliente.casos.map((caso) => {
                        const ultimo = caso.andamentos[0]
                        return (
                          <tr key={caso.id}>
                            <td className="mono whitespace-nowrap font-semibold">
                              {caso.numeroProcesso === null ? (
                                <span className="font-normal text-texto-3">
                                  sem número ainda
                                </span>
                              ) : (
                                formatarNumeroDeProcesso(caso.numeroProcesso)
                              )}
                            </td>
                            <td>{caso.assunto}</td>
                            <td>
                              <EtiquetaDeSituacaoDoCaso situacao={caso.situacao} />
                            </td>
                            <td className="text-[12px] text-texto-2">
                              {ultimo === undefined ? '—' : formatarData(ultimo.data)}
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
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {ehPessoaJuridica && (
              <div className="mt-4">
                <RepresentantesLegais
                  empresaId={cliente.id}
                  representantes={cliente.representantes.map((vinculo) => ({
                    pessoaFisicaId: vinculo.pessoaFisica.id,
                    nome: vinculo.pessoaFisica.nome,
                    documento: vinculo.pessoaFisica.documento,
                    qualificacao: vinculo.qualificacao,
                    qualificacaoCompleta:
                      vinculo.pessoaFisica.rg !== null &&
                      vinculo.pessoaFisica.nomeMae !== null,
                  }))}
                />
              </div>
            )}

            <div className="mt-4">
              <PastaDoCliente clienteId={cliente.id} documentos={documentos} />
            </div>
          </div>

          <div>
            <div className="cartao mb-4">
              <div className="cartao-cabecalho">
                <h2>Qualificação</h2>
              </div>
              <div className="cartao-corpo">
                <Dado rotulo="RG ou inscrição estadual">
                  {cliente.rg ?? <span className="text-texto-3">—</span>}
                </Dado>
                <Dado
                  rotulo={
                    cliente.tipoPessoa === TipoPessoa.FISICA
                      ? 'Data de nascimento'
                      : 'Data de fundação'
                  }
                >
                  {cliente.dataNascimento === null ? (
                    <span className="text-texto-3">—</span>
                  ) : (
                    <span className="mono">{formatarData(cliente.dataNascimento)}</span>
                  )}
                </Dado>
                <Dado rotulo="Estado civil">
                  {cliente.estadoCivil ?? <span className="text-texto-3">—</span>}
                </Dado>
                <Dado rotulo="Profissão">
                  {cliente.profissao ?? <span className="text-texto-3">—</span>}
                </Dado>
                <Dado rotulo="Nacionalidade">
                  {cliente.nacionalidade ?? <span className="text-texto-3">—</span>}
                </Dado>
                {!ehPessoaJuridica && (
                  <Dado rotulo="Nome da mãe">
                    {cliente.nomeMae ?? <span className="text-texto-3">—</span>}
                  </Dado>
                )}
              </div>
            </div>

            <div className="cartao mb-4">
              <div className="cartao-cabecalho">
                <h2>Contato</h2>
              </div>
              <div className="cartao-corpo">
                <Dado rotulo="E-mail">
                  {temEmail ? (
                    cliente.email
                  ) : (
                    <span className="text-erro">
                      não informado — o cliente não recebe o código de acesso
                    </span>
                  )}
                </Dado>
                <Dado rotulo="Telefone">
                  {cliente.telefone === null ? (
                    <span className="text-texto-3">—</span>
                  ) : (
                    <span className="mono">{formatarTelefone(cliente.telefone)}</span>
                  )}
                </Dado>
                <Dado rotulo="Endereço">
                  {cliente.endereco === null && cliente.cep === null ? (
                    <span className="text-texto-3">—</span>
                  ) : (
                    <>
                      {cliente.endereco}
                      {cliente.cep !== null && (
                        <>
                          <br />
                          <span className="mono">{formatarCep(cliente.cep)}</span>
                        </>
                      )}
                    </>
                  )}
                </Dado>
              </div>
            </div>

            <div className="cartao">
              <div className="cartao-cabecalho">
                <h2>Acesso do cliente</h2>
              </div>
              <div className="cartao-corpo">
                <div className="mb-3 flex items-center gap-2.5">
                  <EtiquetaDeAcesso
                    acessoLiberado={acessoLiberado}
                    temEmail={temEmail}
                  />
                  {acessoLiberado && cliente.contratoAssinadoEm !== null && (
                    <span className="text-[12px] text-texto-2">
                      desde {formatarData(cliente.contratoAssinadoEm)}
                    </span>
                  )}
                </div>
                <p className="text-[12px] leading-relaxed text-texto-2">
                  {acessoLiberado
                    ? 'Entra com CPF ou CNPJ e código enviado ao e-mail cadastrado.'
                    : 'O acesso do cliente é liberado apenas depois que o contrato for assinado (Anexo I, 1.d). O registro da assinatura entra na Sprint 3, e a área de consulta, na Sprint 4.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
