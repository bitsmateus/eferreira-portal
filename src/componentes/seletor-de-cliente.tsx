'use client'

/**
 * Escolher um cliente pesquisando por nome ou CPF/CNPJ, em vez de rolar uma
 * lista suspensa comum — pedido do escritório em 22/09/2026, quando a lista
 * de clientes já não cabe mais numa olhada só.
 *
 * A lista inteira já chega pronta da página (poucos campos, ver
 * `listarClientesParaEscolha`), e o filtro é só no navegador — sem ida ao
 * servidor a cada letra digitada. Continua submetendo `clienteId` como
 * qualquer campo de formulário (campo escondido); quem decide se ESTA sessão
 * pode usar o cliente escolhido é sempre o servidor (regra 2), nunca esta
 * tela.
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react'

import { formatarDocumento } from '@/lib/documento'
import { somenteDigitos } from '@/lib/formatos'

type ClienteParaEscolha = { id: string; nome: string; documento: string }

export function SeletorDeCliente({
  id,
  clientes,
  valor,
  onEscolher,
  obrigatorio = false,
}: {
  id: string
  clientes: readonly ClienteParaEscolha[]
  /** O `clienteId` escolhido, ou "" quando nenhum ainda. */
  valor: string
  onEscolher: (clienteId: string) => void
  obrigatorio?: boolean
}) {
  const clientePorId = useMemo(() => new Map(clientes.map((c) => [c.id, c])), [clientes])
  const escolhido = valor === '' ? null : (clientePorId.get(valor) ?? null)

  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState(false)
  const [destacado, setDestacado] = useState(0)
  const raiz = useRef<HTMLDivElement>(null)
  const listaId = useId()

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (termo === '') return clientes

    const digitos = somenteDigitos(termo)
    return clientes.filter((cliente) => {
      const bateNome = cliente.nome.toLowerCase().includes(termo)
      const bateDocumento = digitos !== '' && cliente.documento.includes(digitos)
      return bateNome || bateDocumento
    })
  }, [busca, clientes])

  // Fecha ao clicar fora — mesmo padrão dos menus de linha (ver menu-do-caso.tsx).
  useEffect(() => {
    function aoClicarFora(evento: MouseEvent): void {
      if (raiz.current !== null && !raiz.current.contains(evento.target as Node)) {
        setAberto(false)
      }
    }
    document.addEventListener('mousedown', aoClicarFora)
    return () => document.removeEventListener('mousedown', aoClicarFora)
  }, [])

  function escolher(cliente: ClienteParaEscolha): void {
    onEscolher(cliente.id)
    setBusca('')
    setAberto(false)
  }

  function aoTeclar(evento: React.KeyboardEvent<HTMLInputElement>): void {
    if (evento.key === 'ArrowDown') {
      evento.preventDefault()
      setAberto(true)
      setDestacado((atual) => Math.min(atual + 1, filtrados.length - 1))
    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault()
      setDestacado((atual) => Math.max(atual - 1, 0))
    } else if (evento.key === 'Enter') {
      const alvo = filtrados[destacado]
      if (aberto && alvo !== undefined) {
        evento.preventDefault()
        escolher(alvo)
      }
    } else if (evento.key === 'Escape') {
      setAberto(false)
    }
  }

  const textoDoCampo = aberto
    ? busca
    : escolhido === null
      ? ''
      : `${escolhido.nome} — ${formatarDocumento(escolhido.documento)}`

  return (
    <div className="relative" ref={raiz}>
      {/* O que de fato viaja no formulário — a busca acima é só para achar o id. */}
      <input type="hidden" name="clienteId" value={valor} required={obrigatorio} />
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={aberto}
        aria-controls={listaId}
        aria-autocomplete="list"
        autoComplete="off"
        className="campo-entrada"
        placeholder="Busque por nome ou CPF/CNPJ…"
        value={textoDoCampo}
        onFocus={() => {
          setAberto(true)
          setBusca('')
          setDestacado(0)
        }}
        onChange={(evento) => {
          setBusca(evento.target.value)
          setDestacado(0)
          setAberto(true)
        }}
        onKeyDown={aoTeclar}
      />
      {aberto && (
        <ul
          id={listaId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-borda bg-superficie shadow-lg"
        >
          {filtrados.length === 0 ? (
            <li className="px-3 py-2 text-[12.5px] text-texto-3">Nenhum cliente encontrado.</li>
          ) : (
            filtrados.map((cliente, indice) => (
              <li
                key={cliente.id}
                role="option"
                aria-selected={cliente.id === valor}
                className={`cursor-pointer px-3 py-2 text-[13px] ${
                  indice === destacado ? 'bg-prata-100' : ''
                }`}
                // `onMouseDown` (não `onClick`): dispara antes do `onBlur` do
                // input, que senão fecharia a lista antes do clique valer.
                onMouseDown={(evento) => {
                  evento.preventDefault()
                  escolher(cliente)
                }}
                onMouseEnter={() => setDestacado(indice)}
              >
                {cliente.nome} — {formatarDocumento(cliente.documento)}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
