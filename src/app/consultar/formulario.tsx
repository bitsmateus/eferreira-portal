'use client'

import { useActionState, useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { SEGUNDOS_ENTRE_PEDIDOS } from '@/lib/acesso'
import { consultar } from './acoes'
import { ESTADO_INICIAL, type EstadoDaConsulta } from './estado'

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

/** Contagem regressiva do reenvio, como no protótipo ("Reenviar em 0:38"). */
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

export function FormularioDeConsulta() {
  const [estado, enviar] = useActionState<EstadoDaConsulta, FormData>(
    consultar,
    ESTADO_INICIAL,
  )

  const noPassoDoCodigo = estado.passo === 'codigo'

  return (
    <form action={enviar}>
      {estado.aviso !== null && (
        <div className="aviso aviso-ok mb-4" role="status" aria-live="polite">
          <span aria-hidden="true">▲</span>
          <div>{estado.aviso}</div>
        </div>
      )}

      {estado.erros['documento'] !== undefined && !noPassoDoCodigo && (
        <div className="aviso aviso-erro mb-4" role="alert" aria-live="polite">
          <span aria-hidden="true">▲</span>
          <div>{estado.erros['documento']}</div>
        </div>
      )}

      {!noPassoDoCodigo ? (
        <>
          <div className="mb-4">
            <label className="campo-rotulo" htmlFor="documento">
              CPF ou CNPJ
            </label>
            <input
              id="documento"
              name="documento"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              required
              defaultValue={estado.documentoFormatado}
              className="campo-entrada mono"
              placeholder="000.000.000-00"
            />
            <p className="dica">
              O mesmo documento que consta no seu contrato com o escritório.
            </p>
          </div>

          <Botao acao="pedir">Receber código por e-mail</Botao>
        </>
      ) : (
        <>
          <input type="hidden" name="documento" value={estado.documento} />

          <div className="mb-1.5">
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
          </div>

          {estado.erros['codigo'] !== undefined && (
            <div className="aviso aviso-erro mb-3 mt-3" role="alert" aria-live="polite">
              <span aria-hidden="true">▲</span>
              <div>{estado.erros['codigo']}</div>
            </div>
          )}

          <div className="mb-4 mt-2">
            <Reenvio pedidoEm={estado.pedidoEm} />
          </div>

          <Botao acao="conferir">Entrar</Botao>

          <p className="mt-3.5 text-center">
            <span className="mono text-[12px] text-texto-3">
              {estado.documentoFormatado}
            </span>
            {' · '}
            <Botao acao="trocar" variante="texto" semValidacao>
              usar outro documento
            </Botao>
          </p>
        </>
      )}
    </form>
  )
}
