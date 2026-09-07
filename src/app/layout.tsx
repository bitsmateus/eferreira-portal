import type { Metadata, Viewport } from 'next'
import { Inter, Cormorant_Garamond } from 'next/font/google'
import './globals.css'

// Fontes do protótipo, servidas pelo próprio domínio (next/font baixa e
// hospeda) — nenhuma requisição do navegador do cliente para terceiros.
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--fonte-sans',
})

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['500', '600'],
  display: 'swap',
  variable: '--fonte-serif',
})

export const metadata: Metadata = {
  title: 'Portal do Cliente — E. Ferreira',
  description:
    'Sistema de Cadastro de Clientes e Acompanhamento de Processos — E. Ferreira Advogados',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${cormorant.variable}`}>
      <body>{children}</body>
    </html>
  )
}
