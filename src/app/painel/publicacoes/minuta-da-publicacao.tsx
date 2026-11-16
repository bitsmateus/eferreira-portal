'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { AREAS, ROTULO_DA_AREA } from '@/lib/areas'
import { formatarDataHora } from '@/lib/datas'
import type { LinhaDePublicacao } from '@/lib/publicacoes'

import { pedirMinutaDaPublicacao } from './acoes'

function BotaoGerar({ jaTem }: { jaTem: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className="botao botao-secundario botao-pequeno">
      {pending ? 'Pedindo…' : jaTem ? 'Gerar de novo' : 'Gerar minuta'}
    </button>
  )
}

function BotaoCopiar({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false)
  return (
    <button
      type="button"
      className="botao botao-fantasma botao-pequeno"
      onClick={() => {
        void navigator.clipboard.writeText(texto).then(() => {
          setCopiado(true)
          setTimeout(() => setCopiado(false), 2000)
        })
      }}
    >
      {copiado ? 'Copiada' : 'Copiar minuta'}
    </button>
  )
}

/**
 * A minuta da peça (16/11/2026): escolher a área, gerar sob demanda e ler o
 * rascunho com a nota de revisão e as fontes. Roxo como a análise — tudo o
 * que a IA escreveu se distingue à primeira vista.
 */
export function MinutaDaPublicacao({ publicacao }: { publicacao: LinhaDePublicacao }) {
  const [estado, enviar] = useActionState(pedirMinutaDaPublicacao.bind(null, publicacao.id), undefined)
  const [aberta, setAberta] = useState(false)
  const areaInicial = publicacao.minutaArea ?? publicacao.caso?.area ?? ''
  const temMinuta = publicacao.minuta !== null

  return (
    <div className="mt-3 rounded-md border border-[#DDD3FA] p-3.5">
      <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#6B4FD3]">
        Minuta da IA · rascunho para revisão do advogado
      </div>

      {publicacao.gerandoMinuta ? (
        <p className="text-[12.5px] text-texto-2" role="status">
          Gerando a minuta com pesquisa de jurisprudência… leva alguns minutos, a tela se atualiza sozinha.
        </p>
      ) : (
        <form action={enviar} className="flex flex-wrap items-end gap-2">
          <div>
            <label className="campo-rotulo" htmlFor={`area-${publicacao.id}`}>
              Área
            </label>
            <select
              id={`area-${publicacao.id}`}
              name="area"
              defaultValue={areaInicial}
              className="campo-entrada"
              required
            >
              <option value="" disabled>
                Escolha…
              </option>
              {AREAS.map((area) => (
                <option key={area} value={area}>
                  {ROTULO_DA_AREA[area]}
                </option>
              ))}
            </select>
          </div>
          <BotaoGerar jaTem={temMinuta} />
          {estado?.mensagem !== undefined && (
            <span className="text-[11.5px] text-erro" role="alert">
              {estado.mensagem}
            </span>
          )}
        </form>
      )}

      {publicacao.minutaErro !== null && !publicacao.gerandoMinuta && (
        <p className="mt-2 text-[12px] text-erro">A última tentativa falhou: {publicacao.minutaErro}</p>
      )}

      {temMinuta && (
        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-texto-3">
            <span>
              {publicacao.minutaArea === null ? '' : `${ROTULO_DA_AREA[publicacao.minutaArea]} · `}
              gerada em {publicacao.minutaGeradaEm === null ? '—' : formatarDataHora(publicacao.minutaGeradaEm)}
              {publicacao.minutaBuscas !== null && ` · ${publicacao.minutaBuscas} busca(s) na web`}
            </span>
            <button type="button" className="botao botao-fantasma botao-pequeno" onClick={() => setAberta((v) => !v)}>
              {aberta ? 'Esconder minuta' : 'Ver minuta'}
            </button>
            {publicacao.minuta !== null && <BotaoCopiar texto={publicacao.minuta} />}
          </div>

          {aberta && (
            <>
              <pre className="mt-2.5 max-h-[520px] overflow-auto whitespace-pre-wrap rounded-md border border-[#DDD3FA] bg-[#F4F0FE] p-3 font-sans text-[12.5px] leading-relaxed text-[#2E2152]">
                {publicacao.minuta}
              </pre>

              {publicacao.minutaNota !== null && (
                <div className="mt-2.5">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-texto-2">
                    Nota de revisão
                  </div>
                  <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap rounded-md border border-borda p-3 font-sans text-[12px] leading-relaxed">
                    {publicacao.minutaNota}
                  </pre>
                </div>
              )}

              {publicacao.minutaFontes.length > 0 && (
                <div className="mt-2.5">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-texto-2">
                    Fontes que a pesquisa encontrou (confira cada uma)
                  </div>
                  <ul className="list-disc pl-5 text-[12px]">
                    {publicacao.minutaFontes.map((fonte) => (
                      <li key={fonte.url}>
                        <a href={fonte.url} target="_blank" rel="noreferrer noopener" className="underline-offset-2 hover:underline">
                          {fonte.titulo}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
