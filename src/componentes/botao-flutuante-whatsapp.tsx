import { linkDoWhatsapp } from '@/lib/formatos'

/**
 * O botão de WhatsApp das telas do cliente — fixo no canto inferior direito,
 * sempre visível, com o círculo verde e o ícone de telefone que qualquer
 * visitante já reconhece desse tipo de botão. Pedido do escritório em
 * 22/09/2026, no lugar do link de texto que ficava no topo da tela.
 *
 * A cor é o verde de marca do WhatsApp (#25D366) de propósito: é o único
 * lugar do sistema com essa cor, e é exatamente por isso que funciona como
 * sinal — todo o resto do produto usa grafite e prata (regra visual
 * aprovada), então este botão se destaca como "isto abre uma conversa".
 */
export function BotaoFlutuanteDoWhatsapp({ numero }: { numero: string }) {
  return (
    <a
      href={linkDoWhatsapp(numero)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Fale conosco pelo WhatsApp"
      title="Fale conosco pelo WhatsApp"
      className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#128C7E]"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" width="26" height="26" aria-hidden="true">
        <path d="M1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 006.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 011.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5z" />
      </svg>
    </a>
  )
}
