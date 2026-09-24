'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import type { TipoGeravel } from '@/lib/geracao'

import { gerarEArquivar } from './acoes'

function BotaoGerar() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="botao" disabled={pending}>
      {pending ? 'Gerando o PDF…' : 'Gerar e arquivar na pasta'}
    </button>
  )
}

export function FormularioDeGeracao({
  clienteId,
  tipo,
  casoId,
  advogadoId,
}: {
  clienteId: string
  tipo: TipoGeravel
  casoId: string | null
  advogadoId: string
}) {
  const [estado, enviar] = useActionState(
    gerarEArquivar.bind(null, clienteId),
    undefined,
  )

  return (
    <form action={enviar}>
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="casoId" value={casoId ?? ''} />
      <input type="hidden" name="advogadoId" value={advogadoId} />

      {estado?.mensagem !== undefined && (
        <div className="aviso aviso-erro mb-3" role="alert">
          <span aria-hidden="true">▲</span>
          <div>
            {estado.mensagem}
            {estado.faltando !== undefined && (
              <ul className="mt-1.5 list-disc pl-4">
                {estado.faltando.map((campo) => (
                  <li key={campo}>{campo}</li>
                ))}
              </ul>
            )}
            {estado.ondePreencher !== undefined && (
              <Link
                href={estado.ondePreencher}
                className="mt-2 inline-block underline underline-offset-2"
              >
                Completar o cadastro
              </Link>
            )}
          </div>
        </div>
      )}

      <BotaoGerar />
      <p className="dica">
        O PDF é arquivado na pasta do cliente e sai por link temporário, como
        qualquer outro documento.
      </p>
    </form>
  )
}
