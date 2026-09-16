'use client'

/**
 * Barreira de erro do painel.
 *
 * Sem ela, uma falha inesperada no servidor derruba a tela inteira e, em
 * desenvolvimento, ainda mostra rastro de pilha para quem estiver na frente do
 * computador. A mensagem é curta e não revela nada do que quebrou.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * O CASO DA PÁGINA VELHA, QUE NÃO É DEFEITO E PARECIA UM
 *
 * Quando o sistema é atualizado, o navegador de quem estava com uma tela
 * aberta continua com a versão anterior carregada. As ações de servidor do
 * Next são identificadas por um código que muda a cada versão publicada — e
 * a ação que aquela aba conhece deixa de existir no servidor novo.
 *
 * O resultado é um erro que não diz nada a quem está usando: a pessoa
 * preenche a ficha inteira, clica em salvar e recebe "alguma coisa não
 * funcionou". Nada foi gravado, nada quebrou, e tentar de novo na mesma aba
 * falha igual — porque `reset()` refaz a tela com o mesmo código velho.
 *
 * Aqui esse caso é reconhecido e recebe o único conselho que resolve:
 * recarregar a página. Aconteceu de verdade em 16/09/2026, minutos depois de
 * uma publicação, e custou a ficha que o operador estava preenchendo.
 * ─────────────────────────────────────────────────────────────────────────
 */

/**
 * O erro tem nome e texto próprios no Next (`UnrecognizedActionError`), mas o
 * código de produção é minificado e o nome pode não sobreviver. Por isso a
 * conferência olha também o texto, que é estável.
 */
function ehVersaoVelhaNaAba(erro: Error): boolean {
  const texto = `${erro.name} ${erro.message}`
  return (
    texto.includes('UnrecognizedActionError') ||
    texto.includes('Server Action') ||
    texto.includes('Failed to find Server Action')
  )
}

export default function ErroDoPainel({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  if (ehVersaoVelhaNaAba(error)) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="cartao max-w-md px-[18px] py-9 text-center">
          <p className="mb-1 text-[14px] font-medium text-texto-2">
            O sistema foi atualizado enquanto esta página estava aberta.
          </p>
          <p className="mb-4 text-[12.5px] leading-relaxed text-texto-3">
            Nada foi gravado e nada se perdeu no sistema — esta aba é que ficou na
            versão anterior. Recarregue para continuar.
          </p>
          <button
            type="button"
            // `reset()` não serve aqui: ele refaz a tela com o mesmo código
            // velho e o erro se repete. Só recarregar busca a versão nova.
            onClick={() => window.location.reload()}
            className="botao"
          >
            Recarregar a página
          </button>
        </div>
      </div>
    )
  }

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
