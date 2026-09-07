'use client'

/**
 * Barreira de erro do painel.
 *
 * Sem ela, uma falha inesperada no servidor derruba a tela inteira e, em
 * desenvolvimento, ainda mostra rastro de pilha para quem estiver na frente do
 * computador. Aqui a mensagem é curta e não revela nada do que quebrou.
 */
export default function ErroDoPainel({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="cartao max-w-md px-[18px] py-9 text-center">
        <p className="mb-1 text-[14px] font-medium text-texto-2">
          Alguma coisa não funcionou aqui.
        </p>
        <p className="mb-4 text-[12.5px] text-texto-3">
          A operação não foi concluída. Tente de novo; se continuar, avise o
          responsável técnico com o horário em que aconteceu.
        </p>
        <button type="button" onClick={reset} className="botao botao-secundario">
          Tentar de novo
        </button>
      </div>
    </div>
  )
}
