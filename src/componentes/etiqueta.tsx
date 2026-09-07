/**
 * A "tag" do protótipo: pílula com um ponto da mesma cor do texto.
 * Usada para situação do caso e situação do acesso do cliente.
 */

type Tom = 'ok' | 'atencao' | 'erro' | 'info' | 'neutra'

const CLASSE: Record<Tom, string> = {
  ok: 'etiqueta-ok',
  atencao: 'etiqueta-atencao',
  erro: 'etiqueta-erro',
  info: 'etiqueta-info',
  neutra: 'etiqueta-neutra',
}

export function Etiqueta({
  tom,
  children,
}: {
  tom: Tom
  children: React.ReactNode
}) {
  return (
    <span className={`etiqueta ${CLASSE[tom]}`}>
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 flex-none rounded-full bg-current"
      />
      {children}
    </span>
  )
}
