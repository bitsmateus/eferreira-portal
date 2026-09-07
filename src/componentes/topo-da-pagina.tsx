/** O cabeçalho de página do protótipo: título, subtítulo e ações à direita. */
export function TopoDaPagina({
  titulo,
  subtitulo,
  monoNoTitulo = false,
  acoes,
}: {
  titulo: string
  subtitulo?: React.ReactNode
  /** Número de processo no título sai em números tabulares, como no protótipo. */
  monoNoTitulo?: boolean
  acoes?: React.ReactNode
}) {
  return (
    <header className="flex flex-wrap items-center gap-3.5 border-b border-borda bg-superficie px-6 py-4">
      <div className="min-w-0">
        <h1
          className={[
            'text-[17px] font-semibold tracking-[-0.01em]',
            monoNoTitulo ? 'mono' : '',
          ].join(' ')}
        >
          {titulo}
        </h1>
        {subtitulo !== undefined && (
          <p className="mt-0.5 text-[12.5px] text-texto-2">{subtitulo}</p>
        )}
      </div>

      {acoes !== undefined && (
        <div className="ml-auto flex flex-wrap items-center gap-2">{acoes}</div>
      )}
    </header>
  )
}
