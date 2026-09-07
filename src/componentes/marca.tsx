/**
 * A marca, exatamente como no protótipo aprovado.
 *
 * ATENÇÃO: este é o desenho do protótipo, não a logo definitiva. A logo em
 * vetor e as cores institucionais são dependência do escritório (Anexo II,
 * item 3.2) e ainda não chegaram. Quando chegarem, troque só este arquivo —
 * nenhuma tela desenha a marca por conta própria.
 */

type Props = {
  tamanho?: 'normal' | 'pequena'
  /** `clara` = prata sobre fundo grafite. `escura` = grafite sobre fundo claro. */
  variante?: 'clara' | 'escura'
}

export function Marca({ tamanho = 'normal', variante = 'clara' }: Props) {
  const pequena = tamanho === 'pequena'
  const escura = variante === 'escura'
  const idGradiente = escura ? undefined : 'gradiente-marca'
  const traco = escura ? '#3C3C3C' : `url(#${idGradiente})`

  return (
    <div className="flex items-center gap-[11px]">
      <svg
        viewBox="0 0 64 64"
        aria-hidden="true"
        className={pequena ? 'h-6 w-6 flex-none' : 'h-[30px] w-[30px] flex-none'}
      >
        {!escura && (
          <defs>
            <linearGradient id={idGradiente} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FFFFFF" />
              <stop offset=".42" stopColor="#9E9E9E" />
              <stop offset=".58" stopColor="#E2E2E2" />
              <stop offset="1" stopColor="#6E6E6E" />
            </linearGradient>
          </defs>
        )}
        <rect
          x="4"
          y="4"
          width="56"
          height="56"
          fill="none"
          stroke={traco}
          strokeWidth="2.6"
        />
        <path
          d="M15 19H39M15 32H33M15 45H39"
          stroke={traco}
          strokeWidth="2.6"
          fill="none"
          strokeLinecap="square"
        />
        <path d="M47 15V49" stroke={traco} strokeWidth="2.6" />
      </svg>

      <span className="flex flex-col leading-none">
        <b
          className={[
            'font-serif font-semibold tracking-[0.03em]',
            pequena ? 'text-[15px]' : 'text-[18px]',
            escura
              ? 'text-grafite-800'
              : 'bg-gradient-to-b from-white via-prata-200 to-[#9A9A9A] bg-clip-text text-transparent',
          ].join(' ')}
        >
          E. FERREIRA
        </b>
        <i
          className={[
            'not-italic text-prata-400',
            pequena
              ? 'mt-1 text-[7px] tracking-[0.34em]'
              : 'mt-1 text-[8.5px] tracking-[0.42em]',
          ].join(' ')}
        >
          ADVOGADOS
        </i>
      </span>
    </div>
  )
}
