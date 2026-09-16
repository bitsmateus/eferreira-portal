'use client'

import { useActionState, useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { SEGUNDOS_ENTRE_PEDIDOS } from '@/lib/redefinicao'
import { recuperarSenha } from './acoes'
import { ESTADO_INICIAL, type EstadoDaRecuperacao } from './estado'

function Botao({
  acao,
  children,
  variante = 'principal',
  semValidacao = false,
}: {
  acao: string
  children: React.ReactNode
  variante?: 'principal' | 'secundario' | 'texto'
  semValidacao?: boolean
}) {
  const { pending } = useFormStatus()

  const classe =
    variante === 'principal'
      ? 'botao botao-largo'
      : variante === 'secundario'
        ? 'botao botao-secundario'
        : 'text-[12px] text-texto-2 underline underline-offset-2 hover:text-texto-1'

  return (
    <button
      type="submit"
      name="acao"
      value={acao}
      disabled={pending}
      formNoValidate={semValidacao}
      className={classe}
    >
      {children}
    </button>
  )
}

/** Contagem regressiva do reenvio, no mesmo padrão de `/consultar`. */
function Reenvio({ pedidoEm }: { pedidoEm: number | null }) {
  const [segundos, setSegundos] = useState(() => restante(pedidoEm))

  useEffect(() => {
    setSegundos(restante(pedidoEm))
    const relogio = setInterval(() => setSegundos(restante(pedidoEm)), 1000)
    return () => clearInterval(relogio)
  }, [pedidoEm])

  if (segundos > 0) {
    const minuto = Math.floor(segundos / 60)
    const resto = String(segundos % 60).padStart(2, '0')
    return (
      <span className="text-[12px] text-texto-3">
        Não recebeu? Reenviar em{' '}
        <b className="mono font-semibold">
          {minuto}:{resto}
        </b>
      </span>
    )
  }

  return (
    <Botao acao="reenviar" variante="texto" semValidacao>
      Não recebeu? Enviar outro código
    </Botao>
  )
}

function restante(pedidoEm: number | null): number {
  if (pedidoEm === null) return 0
  const passados = Math.floor((Date.now() - pedidoEm) / 1000)
  return Math.max(0, SEGUNDOS_ENTRE_PEDIDOS - passados)
}

export function FormularioDeRecuperacao() {
  const [estado, enviar] = useActionState<EstadoDaRecuperacao, FormData>(
    recuperarSenha,
    ESTADO_INICIAL,
  )

  if (estado.passo === 'concluida') {
    return (
      <div className="aviso aviso-ok" role="status" aria-live="polite">
        <span aria-hidden="true">▲</span>
        <div>
          Senha redefinida. Já pode{' '}
          <a href="/entrar" className="underline underline-offset-2">
            entrar no painel
          </a>{' '}
          com a senha nova.
        </div>
      </div>
    )
  }

  const noPassoDoCodigo = estado.passo === 'codigo'

  return (
    <form action={enviar}>
      {estado.aviso !== null && (
        <div className="aviso aviso-ok mb-4" role="status" aria-live="polite">
          <span aria-hidden="true">▲</span>
          <div>{estado.aviso}</div>
        </div>
      )}

      {estado.erros['email'] !== undefined && !noPassoDoCodigo && (
        <div className="aviso aviso-erro mb-4" role="alert" aria-live="polite">
          <span aria-hidden="true">▲</span>
          <div>{estado.erros['email']}</div>
        </div>
      )}

      {!noPassoDoCodigo ? (
        <>
          <div className="mb-4">
            <label className="campo-rotulo" htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              defaultValue={estado.email}
              className="campo-entrada"
              placeholder="nome@eferreiraadvogados.com.br"
            />
          </div>

          <Botao acao="pedir">Receber código por e-mail</Botao>
        </>
      ) : (
        <>
          <input type="hidden" name="email" value={estado.email} />

          <div className="mb-4">
            <label className="campo-rotulo" htmlFor="codigo">
              Código recebido por e-mail
            </label>
            <input
              id="codigo"
              name="codigo"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              required
              autoFocus
              className="campo-entrada mono text-center text-[22px] tracking-[0.42em]"
              placeholder="000000"
            />
            {estado.erros['codigo'] !== undefined && (
              <p className="dica dica-erro" role="alert">{estado.erros['codigo']}</p>
            )}
          </div>

          <div className="mb-4">
            <label className="campo-rotulo" htmlFor="senha">
              Senha nova
            </label>
            <input
              id="senha"
              name="senha"
              type="password"
              autoComplete="new-password"
              required
              className="campo-entrada"
              placeholder="••••••••••••"
            />
            {estado.erros['senha'] !== undefined && (
              <p className="dica dica-erro" role="alert">{estado.erros['senha']}</p>
            )}
          </div>

          <div className="mb-4">
            <label className="campo-rotulo" htmlFor="confirmacao">
              Confirmar a senha nova
            </label>
            <input
              id="confirmacao"
              name="confirmacao"
              type="password"
              autoComplete="new-password"
              required
              className="campo-entrada"
              placeholder="••••••••••••"
            />
            {estado.erros['confirmacao'] !== undefined && (
              <p className="dica dica-erro" role="alert">
                {estado.erros['confirmacao']}
              </p>
            )}
          </div>

          <div className="mb-4 mt-2">
            <Reenvio pedidoEm={estado.pedidoEm} />
          </div>

          <Botao acao="redefinir">Redefinir senha</Botao>

          <p className="mt-3.5 text-center">
            <span className="text-[12px] text-texto-3">{estado.email}</span>
            {' · '}
            <Botao acao="trocar" variante="texto" semValidacao>
              usar outro e-mail
            </Botao>
          </p>
        </>
      )}
    </form>
  )
}
