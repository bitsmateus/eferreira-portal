import type { Metadata } from 'next'
import { PerfilUsuario } from '@prisma/client'

import { TopoDaPagina } from '@/componentes/topo-da-pagina'
import { VERSAO_DA_API } from '@/lib/api'
import { PREFIXO_PRODUCAO, prefixoDoAmbiente } from '@/lib/chave-de-api'
import { listarCredenciais } from '@/lib/credenciais'
import { exigirSessaoDaEquipe } from '@/lib/sessao'
import { ListaDeCredenciais, NovaCredencial } from './credenciais'

export const metadata: Metadata = {
  title: 'API do escritório — E. Ferreira Advogados',
}

const ENDPOINTS = [
  {
    metodo: 'GET',
    caminho: '/api/v1/credencial',
    faz: 'Confere a chave e diz o que ela pode',
    permissao: 'qualquer',
  },
  {
    metodo: 'GET',
    caminho: '/api/v1/consulta?documento=',
    faz: 'Andamento por CPF ou CNPJ',
    permissao: 'Consultar',
  },
  {
    metodo: 'GET',
    caminho: '/api/v1/status',
    faz: 'Lista de situações do escritório',
    permissao: 'Consultar',
  },
  {
    metodo: 'POST',
    caminho: '/api/v1/clientes',
    faz: 'Cadastrar cliente',
    permissao: 'Cadastrar',
  },
  {
    metodo: 'PUT',
    caminho: '/api/v1/clientes/{id}',
    faz: 'Atualizar cliente',
    permissao: 'Cadastrar',
  },
  {
    metodo: 'POST',
    caminho: '/api/v1/casos',
    faz: 'Cadastrar caso',
    permissao: 'Cadastrar',
  },
  {
    metodo: 'POST',
    caminho: '/api/v1/casos/{id}/andamentos',
    faz: 'Lançar andamento',
    permissao: 'Cadastrar',
  },
] as const

const EXEMPLO = `# requisição
GET /api/v1/consulta?documento=52998224725
Authorization: Bearer ef_live_••••••••••••

# resposta
{
  "cliente": {
    "id": "clx…",
    "nome": "Nome do cliente",
    "documento": "52998224725",
    "documentoFormatado": "529.982.247-25",
    "tipoPessoa": "FISICA",
    "contratoAssinadoEm": "2026-02-12"
  },
  "casos": [
    {
      "id": "clx…",
      "processo": "0012845-63.2026.8.26.0100",
      "assunto": "Ação de cobrança",
      "vara": "3ª Vara Cível — Foro Central/SP",
      "situacao": "EM_ANDAMENTO",
      "situacaoRotulo": "Em andamento",
      "andamento": {
        "data": "2026-08-31",
        "status": "Juntada de petição",
        "descricao": "Petição de réplica juntada aos autos."
      }
    }
  ]
}`

export default async function PaginaDaApi() {
  const sessao = await exigirSessaoDaEquipe()

  // CLAUDE.md, perfis: gestão de usuários e das credenciais da API é do
  // administrador. `listarCredenciais` exige o mesmo — a decisão não está aqui,
  // está no domínio; esta tela só evita o erro feio para o operador.
  if (sessao.perfil !== PerfilUsuario.ADMINISTRADOR) {
    return (
      <>
        <TopoDaPagina
          titulo="API do escritório"
          subtitulo="Anexo I, itens 3.b e 3.c"
        />
        <div className="flex-1 overflow-auto px-6 py-6">
          <div className="aviso aviso-atencao">
            <span aria-hidden="true">▲</span>
            <div>
              As credenciais da API são geridas pelo <b>administrador</b>. Fale com
              quem tem esse perfil no escritório.
            </div>
          </div>
        </div>
      </>
    )
  }

  const credenciais = await listarCredenciais(sessao)
  const emProducao = prefixoDoAmbiente() === PREFIXO_PRODUCAO

  return (
    <>
      <TopoDaPagina
        titulo="API do escritório"
        subtitulo={
          <>
            Credenciais próprias da E. Ferreira · versão {VERSAO_DA_API} ·{' '}
            {emProducao ? 'ambiente de produção' : 'ambiente de testes'}
          </>
        }
      />

      <div className="flex-1 overflow-auto px-6 py-6">
        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <div className="cartao mb-4">
              <div className="cartao-cabecalho">
                <h2>Consulta por CPF ou CNPJ</h2>
                <span className="ml-auto text-[12px] text-texto-2">GET</span>
              </div>
              <div className="cartao-corpo">
                <pre className="mono overflow-x-auto rounded-md border border-borda bg-prata-100 p-3 text-[11.5px] leading-relaxed">
                  {EXEMPLO}
                </pre>
              </div>
            </div>

            <div className="cartao">
              <div className="cartao-cabecalho">
                <h2>Endpoints</h2>
              </div>
              <div className="rolagem-lateral">
                <table className="tabela">
                  <thead>
                    <tr>
                      <th>Método</th>
                      <th>Caminho</th>
                      <th>O que faz</th>
                      <th>Permissão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ENDPOINTS.map((endpoint) => (
                      <tr key={`${endpoint.metodo} ${endpoint.caminho}`}>
                        <td className="whitespace-nowrap font-semibold">
                          {endpoint.metodo}
                        </td>
                        <td className="mono whitespace-nowrap text-[12px]">
                          {endpoint.caminho}
                        </td>
                        <td>{endpoint.faz}</td>
                        <td className="whitespace-nowrap text-[12px] text-texto-2">
                          {endpoint.permissao}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="aviso aviso-info mt-4">
              <span aria-hidden="true">▲</span>
              <div>
                <b>A referência completa está em `docs/api.md`</b> — autenticação,
                corpo de cada requisição, códigos de erro e exemplos prontos de
                <span className="mono"> curl</span>. É esse arquivo que se manda
                para quem vai integrar.
              </div>
            </div>
          </div>

          <div>
            <div className="mb-4">
              <NovaCredencial />
            </div>

            <div className="mb-4">
              <ListaDeCredenciais credenciais={credenciais} />
            </div>

            <div className={`aviso ${emProducao ? 'aviso-atencao' : 'aviso-info'}`}>
              <span aria-hidden="true">▲</span>
              <div>
                {emProducao ? (
                  <>
                    <b>Esta instalação é a de produção.</b> As chaves geradas aqui
                    saem com <span className="mono">ef_live_</span> e enxergam dados
                    reais de cliente. Para testar uma integração, gere a chave na
                    instalação de homologação.
                  </>
                ) : (
                  <>
                    <b>Esta é a instalação de testes</b> (Anexo I, 3.c). As chaves
                    geradas aqui saem com <span className="mono">ef_test_</span> e
                    valem só aqui — não funcionam em produção, e as de produção não
                    funcionam aqui.
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
