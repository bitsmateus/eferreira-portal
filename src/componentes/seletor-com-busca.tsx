'use client'

/**
 * Um campo de texto que filtra uma lista já carregada e deixa escolher um
 * item clicando ou pelo teclado — no lugar de uma lista suspensa comum,
 * inviável quando a lista cresce. Pedido do escritório em 22/09/2026, para
 * todo lugar do painel que escolhe um CLIENTE, CASO ou PARTE de uma lista
 * (ver `seletor-de-cliente.tsx` e `seletor-de-caso.tsx`, que só decidem o que
 * cada item mostra e como o texto digitado casa com ele).
 *
 * Guarda o próprio estado (não é controlado pelo pai): funciona tanto dentro
 * de um formulário com estado em React quanto dentro de um `<form method="get">`
 * comum, sem JavaScript nenhum no componente pai — é o caso de
 * `/painel/clientes/[id]/gerar`, que é um Server Component. Continua
 * submetendo `name` como qualquer campo de formulário (por um campo
 * escondido); quem decide se ESTA sessão pode usar o id escolhido é sempre o
 * servidor (regra 2), nunca esta tela.
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react'

export function SeletorComBusca<T>({
  id,
  name,
  itens,
  idDoItem,
  rotulo,
  bate,
  valorInicial = '',
  aoEscolher,
  placeholder,
  obrigatorio = false,
}: {
  id: string
  name: string
  itens: readonly T[]
  idDoItem: (item: T) => string
  /** O texto mostrado para o item escolhido e em cada linha da lista. */
  rotulo: (item: T) => string
  /** Se o item corresponde ao termo digitado (já aparado e em minúsculas). */
  bate: (item: T, termo: string) => boolean
  valorInicial?: string
  /** Avisa o componente pai, quando ele precisar reagir à escolha. */
  aoEscolher?: (id: string) => void
  placeholder: string
  obrigatorio?: boolean
}) {
  const [valor, setValor] = useState(valorInicial)
  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState(false)
  const [destacado, setDestacado] = useState(0)
  const raiz = useRef<HTMLDivElement>(null)
  const listaId = useId()

  const itemPorId = useMemo(() => new Map(itens.map((item) => [idDoItem(item), item])), [itens, idDoItem])
  const escolhido = valor === '' ? null : (itemPorId.get(valor) ?? null)

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (termo === '') return itens
    return itens.filter((item) => bate(item, termo))
  }, [busca, itens, bate])

  // Fecha ao clicar fora — mesmo padrão dos menus de linha (menu-do-caso.tsx).
  useEffect(() => {
    function aoClicarFora(evento: MouseEvent): void {
      if (raiz.current !== null && !raiz.current.contains(evento.target as Node)) {
        setAberto(false)
      }
    }
    document.addEventListener('mousedown', aoClicarFora)
    return () => document.removeEventListener('mousedown', aoClicarFora)
  }, [])

  function escolher(item: T): void {
    const escolhidoId = idDoItem(item)
    setValor(escolhidoId)
    aoEscolher?.(escolhidoId)
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

  const textoDoCampo = aberto ? busca : escolhido === null ? '' : rotulo(escolhido)

  return (
    <div className="relative" ref={raiz}>
      {/* O que de fato viaja no formulário — a busca acima é só para achar o id. */}
      <input type="hidden" name={name} value={valor} required={obrigatorio} />
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={aberto}
        aria-controls={listaId}
        aria-autocomplete="list"
        autoComplete="off"
        className="campo-entrada"
        placeholder={placeholder}
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
            <li className="px-3 py-2 text-[12.5px] text-texto-3">Nenhum resultado encontrado.</li>
          ) : (
            filtrados.map((item, indice) => {
              const itemId = idDoItem(item)
              return (
                <li
                  key={itemId}
                  role="option"
                  aria-selected={itemId === valor}
                  className={`cursor-pointer px-3 py-2 text-[13px] ${
                    indice === destacado ? 'bg-prata-100' : ''
                  }`}
                  // `onMouseDown` (não `onClick`): dispara antes do `onBlur` do
                  // input, que senão fecharia a lista antes do clique valer.
                  onMouseDown={(evento) => {
                    evento.preventDefault()
                    escolher(item)
                  }}
                  onMouseEnter={() => setDestacado(indice)}
                >
                  {rotulo(item)}
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}
