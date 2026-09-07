import type { Config } from 'tailwindcss'

/**
 * Paleta extraída de docs/prototipo-e-ferreira.html (protótipo aprovado).
 * Tema claro, grafite e prata nos acentos. Os valores abaixo são os mesmos
 * das custom properties do protótipo — não invente tom novo: se faltar um,
 * confira o protótipo antes de acrescentar.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        grafite: {
          900: '#161616',
          800: '#212121',
          700: '#2E2E2E',
          600: '#3C3C3C',
          500: '#565656',
        },
        prata: {
          400: '#8E8E8E',
          300: '#B4B4B4',
          200: '#D8D8D8',
          100: '#EDEDED',
        },
        fundo: '#F4F4F5',
        superficie: '#FFFFFF',
        borda: '#E3E3E6',
        texto: {
          DEFAULT: '#1B1B1D',
          2: '#6B6B72',
          3: '#95959C',
        },
        ok: { DEFAULT: '#1F6F4A', fundo: '#E8F3ED', borda: '#C6E2D3' },
        atencao: { DEFAULT: '#8A6100', fundo: '#FBF2DE', borda: '#EDDCB2' },
        erro: { DEFAULT: '#A32B24', fundo: '#FBECEB', borda: '#F0D2D0' },
        info: { DEFAULT: '#28506E', fundo: '#E9F0F6', borda: '#CFDEEA' },
      },
      fontFamily: {
        sans: [
          'var(--fonte-sans)',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        serif: [
          'var(--fonte-serif)',
          'Cormorant Garamond',
          'Georgia',
          'Times New Roman',
          'serif',
        ],
      },
      borderRadius: {
        cartao: '10px',
      },
      boxShadow: {
        cartao: '0 1px 2px rgba(0,0,0,.05), 0 8px 24px -12px rgba(0,0,0,.18)',
      },
      fontSize: {
        base: ['14px', '1.5'],
      },
    },
  },
  plugins: [],
}

export default config
