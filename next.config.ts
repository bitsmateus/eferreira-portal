import type { NextConfig } from 'next'

const config: NextConfig = {
  reactStrictMode: true,
  // Lê o PDF para achar onde cada um assina (src/lib/posicao-da-assinatura.ts):
  // biblioteca de Node, que não deve ser empacotada junto do código do Next.
  serverExternalPackages: ['pdfjs-dist'],
  poweredByHeader: false,
  experimental: {
    // O anexo da pasta do cliente sobe pela ação de servidor, e o limite
    // padrão do Next é 1 MB. Acompanha TAMANHO_TOTAL_MAXIMO_BYTES (vários arquivos por envio, 25/09/2026;
    // cada arquivo continua limitado a TAMANHO_MAXIMO_BYTES, 25 MB) em
    // src/lib/documentos.ts — se um mudar, o outro muda junto.
    serverActions: { bodySizeLimit: '100mb' },
  },
  // Regra 5: nenhum arquivo é público. Nada é servido a partir de /public
  // sem passar pela camada de autorização — os documentos saem por URL
  // pré-assinada de validade curta gerada no servidor.
  async headers() {
    return [
      {
        source: '/:caminho*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // SAMEORIGIN, não DENY: a prévia de documento em
          // src/app/painel/clientes/[id]/gerar/page.tsx embute o PDF da
          // própria rota num <iframe> — DENY bloqueava isso mesmo sendo a
          // mesma origem, e o navegador não mostra erro nenhum, só um
          // quadro em branco. SAMEORIGIN continua recusando qualquer site
          // de fora tentar embutir o portal.
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains',
          },
        ],
      },
    ]
  },
}

export default config
