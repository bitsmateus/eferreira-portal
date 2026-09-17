'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { PermissaoApi } from '@prisma/client'

import { Etiqueta } from '@/componentes/etiqueta'
import { formatarData, formatarDataHora } from '@/lib/datas'
import {
  DESCRICAO_DA_PERMISSAO,
  PERMISSOES_DA_API,
  ROTULO_DA_PERMISSAO,
  type LinhaDeCredencial,
} from '@/lib/permissoes-da-api'
import { gerarCredencial, revogar } from './acoes'

function Botao({
  children,
  variante = 'principal',
}: {
  children: React.ReactNode
  variante?: 'principal' | 'fantasma'
}) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        variante === 'principal'
          ? 'botao botao-pequeno'
          : 'botao botao-fantasma botao-pequeno'
      }
    >
      {children}
    </button>
  )
}

/**
 * Geração da chave.
 *
 * A chave inteira aparece **uma vez só**, aqui, no momento em que é gerada.
 * Depois fica mascarada para sempre — no banco só existe o hash. Se perder,
 * gera outra. É o padrão de mercado e evita que a chave viva num print de tela
 * (protótipo, tela "API do escritório").
 */
export function NovaCredencial() {
  const [estado, criar] = useActionState(gerarCredencial, undefined)
  const [copiada, setCopiada] = useState(false)

  if (estado?.chave !== undefined) {
    return (
      <div className="cartao">
        <div className="cartao-cabecalho">
          <h2>Chave gerada</h2>
        </div>
        <div className="cartao-corpo">
          <div className="aviso aviso-atencao mb-3">
            <span aria-hidden="true">▲</span>
            <div>
              <b>A chave aparece uma vez só.</b> Copie agora e guarde onde a
              integração vai lê-la. Depois desta tela ela fica mascarada para
              sempre — se perder, gere outra e revogue esta.
            </div>
          </div>

          <div className="mono select-all break-all rounded-md border border-borda bg-prata-100 p-3 text-[12.5px]">
            {estado.chave}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="botao botao-secundario botao-pequeno"
              onClick={() => {
                void navigator.clipboard
                  ?.writeText(estado.chave ?? '')
                  .then(() => setCopiada(true))
                  .catch(() => setCopiada(false))
              }}
            >
              {copiada ? 'Copiada' : 'Copiar'}
            </button>
            <a href="/painel/api" className="botao botao-fantasma botao-pequeno">
              Já guardei
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="cartao">
      <div className="cartao-cabecalho">
        <h2>Nova credencial</h2>
      </div>
      <div className="cartao-corpo">
        {estado?.mensagem !== undefined && (
          <div className="aviso aviso-erro mb-3" role="alert">
            <span aria-hidden="true">▲</span>
            <div>{estado.mensagem}</div>
          </div>
        )}

        <form action={criar}>
          <div className="mb-[15px]">
            <label className="campo-rotulo" htmlFor="nome">
              Quem vai usar esta chave
            </label>
            <input
              id="nome"
              name="nome"
              type="text"
              required
              maxLength={120}
              className="campo-entrada"
              placeholder="Site institucional"
            />
            {estado?.erros?.['nome'] !== undefined && (
              <p className="dica dica-erro">{estado.erros['nome']}</p>
            )}
          </div>

          <fieldset className="mb-[15px]">
            <legend className="campo-rotulo">Permissões desta chave</legend>
            {PERMISSOES_DA_API.map((permissao) => (
              <label
                key={permissao}
                className="mt-1.5 flex items-start gap-2.5 text-[13px]"
              >
                <input
                  type="checkbox"
                  name="permissoes"
                  value={permissao}
                  defaultChecked={permissao === PermissaoApi.CONSULTAR}
                  className="mt-0.5"
                />
                <span>
                  <b className="font-medium">{ROTULO_DA_PERMISSAO[permissao]}</b>
                  <br />
                  <span className="text-[12px] text-texto-3">
                    {DESCRICAO_DA_PERMISSAO[permissao]}
                  </span>
                </span>
              </label>
            ))}
            {estado?.erros?.['permissoes'] !== undefined && (
              <p className="dica dica-erro">{estado.erros['permissoes']}</p>
            )}
          </fieldset>

          <Botao>Gerar chave</Botao>
          <p className="dica">
            Dê o mínimo necessário. Uma chave que só consulta não pode estragar
            cadastro por engano.
          </p>
        </form>
      </div>
    </div>
  )
}

function AcoesDaCredencial({ credencial }: { credencial: LinhaDeCredencial }) {
  const [estado, acao] = useActionState(revogar.bind(null, credencial.id), undefined)
  const [confirmando, setConfirmando] = useState(false)

  if (!credencial.ativa) {
    return (
      <span className="text-[11.5px] text-texto-3">
        revogada em{' '}
        <span className="mono">
          {credencial.revogadoEm === null ? '—' : formatarData(credencial.revogadoEm)}
        </span>
      </span>
    )
  }

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="text-[12px] text-erro underline underline-offset-2"
      >
        Revogar
      </button>
    )
  }

  return (
    <form action={acao} className="text-right">
      <input type="hidden" name="confirmacao" value="revogar" />
      {estado?.mensagem !== undefined && (
        <p className="dica dica-erro">{estado.mensagem}</p>
      )}
      <p className="mb-1.5 text-[11.5px] text-texto-2">
        A chave para de funcionar na hora.
      </p>
      <div className="flex justify-end gap-2">
        <Botao variante="fantasma">Confirmar</Botao>
        <button
          type="button"
          onClick={() => setConfirmando(false)}
          className="text-[12px] text-texto-2 underline underline-offset-2"
        >
          cancelar
        </button>
      </div>
    </form>
  )
}

export function ListaDeCredenciais({
  credenciais,
}: {
  credenciais: readonly LinhaDeCredencial[]
}) {
  if (credenciais.length === 0) {
    return (
      <div className="cartao">
        <div className="cartao-cabecalho">
          <h2>Credenciais</h2>
        </div>
        <div className="px-[18px] py-9 text-center">
          <p className="mb-1 text-[13.5px] font-medium text-texto-2">
            Nenhuma credencial gerada.
          </p>
          <p className="text-[12.5px] text-texto-3">
            Gere uma por serviço que for consumir a API — assim dá para revogar
            um sem derrubar os outros.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="cartao">
      <div className="cartao-cabecalho">
        <h2>Credenciais</h2>
        <span className="ml-auto text-[12px] text-texto-2">
          {credenciais.length === 1
            ? '1 credencial'
            : `${credenciais.length} credenciais`}
        </span>
      </div>

      <div className="px-[18px] py-1.5">
        {credenciais.map((credencial) => (
          <div
            key={credencial.id}
            className="flex flex-wrap items-center gap-3 border-b border-prata-100 py-3 last:border-b-0"
          >
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-md bg-prata-100 text-[10px] font-semibold tracking-wide text-texto-2">
              {credencial.ehDeProducao ? 'PR' : 'TS'}
            </div>

            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium">
                {credencial.nome}
              </div>
              <div className="mono mt-0.5 text-[11.5px] text-texto-3">
                {credencial.mascarada}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {credencial.permissoes.map((permissao) => (
                  <Etiqueta key={permissao} tom="neutra">
                    {ROTULO_DA_PERMISSAO[permissao]}
                  </Etiqueta>
                ))}
              </div>
              <div className="mt-1 text-[11.5px] text-texto-3">
                criada em{' '}
                <span className="mono">{formatarData(credencial.criadoEm)}</span>
                {credencial.criadaPor !== null && <> por {credencial.criadaPor}</>}
                {' · '}
                {credencial.ultimoUsoEm === null ? (
                  'nunca usada'
                ) : (
                  <>
                    último uso em{' '}
                    <span className="mono">
                      {formatarDataHora(credencial.ultimoUsoEm)}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="ml-auto flex flex-wrap items-center justify-end gap-2.5">
              {credencial.ativa ? (
                <Etiqueta tom={credencial.ehDeProducao ? 'ok' : 'info'}>
                  {credencial.ehDeProducao ? 'Ativa' : 'Sandbox'}
                </Etiqueta>
              ) : (
                <Etiqueta tom="neutra">Revogada</Etiqueta>
              )}
              <AcoesDaCredencial credencial={credencial} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
